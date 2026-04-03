import { CopilotClient } from "@github/copilot-sdk";
import { CUSTOM_AGENTS } from "../config/agents.config.js";
import { CopilotSessionInfo } from "../types/index.js";

export class CopilotService {
  private sessions: Map<string, CopilotSessionInfo> = new Map();

  async createSession(
    userId: string,
    githubToken: string,
    repoPath: string,
    repoName: string,
    model: string
  ): Promise<CopilotSessionInfo> {
    const sessionId = `${userId}-${repoName}-${model}-${Date.now()}`;

    console.log(`Creating Copilot session for user ${userId} on repo ${repoName}`);

    // Set GitHub token in environment for this client
    process.env.GITHUB_TOKEN = githubToken;

    // Create client with bundled CLI
    const client = new CopilotClient();

    await client.start();

    // Create session with custom agents
    const session = await client.createSession({
      model,
      workingDirectory: repoPath,
      customAgents: CUSTOM_AGENTS,
      onPermissionRequest: async () => ({ kind: "approved" }),
    });

    const sessionInfo: CopilotSessionInfo = {
      sessionId,
      session,
      repository: repoName,
      repositoryPath: repoPath,
      userId,
      model,
    };

    this.sessions.set(sessionId, sessionInfo);

    console.log(`Session ${sessionId} created successfully`);

    return sessionInfo;
  }

  getSession(sessionId: string): CopilotSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo) {
      await sessionInfo.session.close();
      this.sessions.delete(sessionId);
      console.log(`Session ${sessionId} closed`);
    }
  }

  async closeUserSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );

    await Promise.all(
      userSessions.map((s) => this.closeSession(s.sessionId))
    );

    console.log(`Closed ${userSessions.length} sessions for user ${userId}`);
  }
}
