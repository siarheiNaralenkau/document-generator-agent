import { CopilotClient } from "@github/copilot-sdk";
import { CUSTOM_AGENTS } from "../config/agents.config.js";
import { CopilotSessionInfo } from "../types/index.js";
import {
  getByokProviderType,
  getByokWireApi,
} from "../../lib/byok.js";

export class CopilotService {
  private sessions: Map<string, CopilotSessionInfo> = new Map();

  async createSession(
    userId: string,
    githubToken: string | undefined,
    repoPath: string,
    repoName: string,
    model: string,
    useByok: boolean
  ): Promise<CopilotSessionInfo> {
    const sessionId = `${userId}-${repoName}-${model}-${Date.now()}`;

    console.log(`Creating Copilot session for user ${userId} on repo ${repoName}`);

    const client = useByok
      ? new CopilotClient({ useLoggedInUser: false })
      : new CopilotClient({
          githubToken,
          useLoggedInUser: false,
        });

    await client.start();

    const session = useByok
      ? await client.createSession({
          model,
          workingDirectory: repoPath,
          customAgents: CUSTOM_AGENTS,
          onPermissionRequest: async () => ({ kind: "approved" }),
          provider: {
            type: getByokProviderType(),
            baseUrl: process.env.MODEL_URL!.trim(),
            apiKey: process.env.MODEL_API_KEY!.trim(),
            wireApi: getByokWireApi(),
          },
        })
      : await client.createSession({
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
