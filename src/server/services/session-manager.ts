import path from "path";
import { getUserReposRoot } from "../config/repos.config.js";
import { CopilotService } from "./copilot.service.js";
import { CopilotSessionInfo } from "../types/index.js";

export class SessionManager {
  constructor(private copilotService: CopilotService) {}

  async getOrCreateSession(
    userId: string,
    repository: string,
    repositoryPath: string | undefined,
    sessionId?: string,
    model?: string
  ): Promise<CopilotSessionInfo> {
    const repoPath =
      repositoryPath ?? path.join(getUserReposRoot(), repository);

    const selectedModel =
      model ||
      process.env.COPILOT_MODEL ||
      "claude-haiku-4.5";

    // Try to reuse existing session
    if (sessionId) {
      const existing = this.copilotService.getSession(sessionId);
      if (
        existing &&
        existing.userId === userId &&
        existing.repository === repository &&
        existing.repositoryPath === repoPath &&
        existing.model === selectedModel
      ) {
        console.log(`Reusing session ${sessionId}`);
        return existing;
      }
    }

    return await this.copilotService.createSession(
      userId,
      repoPath,
      repository,
      selectedModel
    );
  }
}
