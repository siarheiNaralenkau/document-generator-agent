import { Request, Response } from "express";
import { SessionManager } from "../services/session-manager.js";
import { AskRequest } from "../types/index.js";

export class AskController {
  constructor(private sessionManager: SessionManager) {}

  async ask(req: Request, res: Response) {
    const { repository, question, sessionId, agent } = req.body as AskRequest;
    const userId = req.session.userId!;
    const githubToken = req.session.githubToken!;

    try {
      // Get or create session
      const sessionInfo = await this.sessionManager.getOrCreateSession(
        userId,
        githubToken,
        repository,
        sessionId
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

      try {
        // Build prompt - prefix with agent instruction if specified
        const prompt =
          agent && agent !== "auto"
            ? `Use the @${agent} agent to answer this: ${question}`
            : question;

        // Send question to Copilot with increased timeout (5 minutes)
        await sessionInfo.session.sendAndWait({ prompt }, 300000);

        // Send completion event with the last top-level response
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            sessionId: sessionInfo.sessionId,
            response: lastTopLevelContent,
          })}\n\n`
        );
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
