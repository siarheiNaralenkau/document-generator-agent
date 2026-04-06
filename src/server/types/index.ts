import { Session as ExpressSession } from "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    githubToken: string;
    username: string;
    oauthState: string;
  }
}

export interface Repository {
  name: string;
  path: string;
}

export interface AskRequest {
  repository: string;
  /** Absolute path to the repository root (required when multiple roots exist). */
  repositoryPath?: string;
  question: string;
  sessionId?: string;
  agent?: string;
  model?: string;
}

export interface CopilotSessionInfo {
  sessionId: string;
  session: any;
  repository: string;
  repositoryPath: string;
  userId: string;
  model: string;
}
