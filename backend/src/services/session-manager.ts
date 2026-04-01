import { CopilotService } from "./copilot.service.js";
import { CopilotSessionInfo } from "../types/index.js";

export class SessionManager {
  constructor(private copilotService: CopilotService) {}

  async getOrCreateSession(
    userId: string,
    githubToken: string,
    repository: string,
    sessionId?: string
  ): Promise<CopilotSessionInfo> {
    // Try to reuse existing session
    if (sessionId) {
      const existing = this.copilotService.getSession(sessionId);
      if (existing && existing.userId === userId && existing.repository === repository) {
        console.log(`Reusing session ${sessionId}`);
        return existing;
      }
    }

    // Create new session
    const repoPath = `${process.env.REPOS_PATH || "/repos"}/${repository}`;
    return await this.copilotService.createSession(
      userId,
      githubToken,
      repoPath,
      repository
    );
  }
}
