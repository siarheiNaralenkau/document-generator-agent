import path from "path";
import { Request, Response } from "express";
import { promises as fs } from "fs";
import os from "os";
import {
  ensureAgentGenResultsDirForRepository,
  getUserReposRoot,
} from "../config/repos.config.js";
import { SessionManager } from "../services/session-manager.js";
import { AskRequest } from "../types/index.js";
import { BYOK_USER_ID, isByokMode } from "../../lib/byok.js";

export class AskController {
  constructor(private sessionManager: SessionManager) {}

  private async fileExists(filePath?: string): Promise<boolean> {
    if (!filePath) return false;
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async resolveGeneratedDocPath(
    expectedPath: string,
    filename: string,
    repoRoot: string
  ): Promise<string> {
    if (await this.fileExists(expectedPath)) {
      return expectedPath;
    }

    const candidateRoots = [
      // Preferred repo-scoped location
      path.join(repoRoot, ".copilot-sdk-demo", "agent-gen-results"),
      // Legacy location from earlier builds
      path.join(os.homedir(), ".copilot-sdk-demo", "agent-gen-results"),
    ];

    for (const root of candidateRoots) {
      const directCandidate = path.join(root, path.basename(path.dirname(expectedPath)), filename);
      if (await this.fileExists(directCandidate)) {
        return directCandidate;
      }
    }

    return expectedPath;
  }

  async ask(req: Request, res: Response) {
    const { repository, repositoryPath, question, sessionId, agent, model } =
      req.body as AskRequest;
    const useByok = isByokMode();
    const userId = useByok ? BYOK_USER_ID : req.session.userId!;
    const githubToken = useByok ? undefined : req.session.githubToken!;

    try {
      // Get or create session
      const sessionInfo = await this.sessionManager.getOrCreateSession(
        userId,
        githubToken,
        repository,
        repositoryPath,
        sessionId,
        model,
        useByok
      );

      // Set up SSE - disable buffering for real-time streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let lastTopLevelContent = "";

      // Subscribe to session events
      const unsubscribe = sessionInfo.session.on((event: any) => {
        // Stream all events to client and flush immediately
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }

        // Track the last top-level assistant message content (not subagent)
        if (
          event.type === "assistant.message" &&
          event.data?.content &&
          !event.data?.parentToolCallId
        ) {
          lastTopLevelContent = event.data.content;
        }
      });

      // Predeclare document-generation metadata so we can include it in the
      // completion event once the Copilot run is finished.
      let docOutputDir: string | undefined;
      let featureDocPath: string | undefined;
      let featureDocFilename: string | undefined;
      let finalDocPath: string | undefined;
      let finalDocFilename: string | undefined;

      try {
        const repoRoot =
          repositoryPath ?? path.join(getUserReposRoot(), repository);

        let taskText = question;
        if (agent === "document-generator") {
          const now = new Date();
          const outputDir = await ensureAgentGenResultsDirForRepository(
            repoRoot,
            now
          );
          const timestamp = `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
            now.getHours()
          ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
            now.getSeconds()
          ).padStart(2, "0")}`;

          const safeRepoName = repository.replace(/[^a-zA-Z0-9-_]/g, "_");

          featureDocFilename = `${safeRepoName}-feature-level-requirements-${timestamp}.txt`;
          finalDocFilename = `${safeRepoName}-FinalCopilot-requirements-response-${timestamp}.md`;

          featureDocPath = path.join(outputDir, featureDocFilename);
          finalDocPath = path.join(outputDir, finalDocFilename);
          docOutputDir = outputDir;

          taskText = `[Context for this request]
Repository root (analyze this codebase): ${repoRoot}
Output directory (write all generated files only under this path for this run): ${outputDir}
Feature-level requirements output file (write exactly to this absolute path): ${featureDocPath}
Final Business Requirements Document output file (write exactly to this absolute path): ${finalDocPath}

${question}`;
        }

        // Build prompt - prefix with agent instruction if specified
        const prompt =
          agent && agent !== "auto"
            ? `Use the @${agent} agent to answer this: ${taskText}`
            : taskText;

        // Send question to Copilot with increased timeout (5 minutes)
        await sessionInfo.session.sendAndWait({ prompt }, 900000);

        // Send completion event with the last top-level response
        const completePayload: any = {
          type: "complete",
          sessionId: sessionInfo.sessionId,
          response: lastTopLevelContent,
        };

        if (
          agent === "document-generator" &&
          docOutputDir &&
          featureDocPath &&
          finalDocPath &&
          featureDocFilename &&
          finalDocFilename
        ) {
          // Resolve actual files on disk in case the model wrote to a compatible
          // repo-scoped/legacy output root different from the initially suggested path.
          const resolvedFeaturePath = await this.resolveGeneratedDocPath(
            featureDocPath,
            featureDocFilename,
            repoRoot
          );
          const resolvedFinalPath = await this.resolveGeneratedDocPath(
            finalDocPath,
            finalDocFilename,
            repoRoot
          );

          completePayload.documents = {
            repo: repository,
            outputDir: docOutputDir,
            feature: {
              filename: featureDocFilename,
              path: resolvedFeaturePath,
            },
            final: {
              filename: finalDocFilename,
              path: resolvedFinalPath,
            },
          };
        }

        res.write(`data: ${JSON.stringify(completePayload)}\n\n`);
      } catch (error: any) {
        console.error("Error during question processing:", error);
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: error.message,
          })}\n\n`
        );
      } finally {
        unsubscribe();
        res.end();
      }
    } catch (error: any) {
      console.error("Error in ask controller:", error);
      res.status(500).json({ error: error.message });
    }
  }
}
