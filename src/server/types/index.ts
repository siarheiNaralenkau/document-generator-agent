export interface Repository {
  name: string;
  path: string;
}

export interface GenerateRequirementsRequest {
  repository: string;
  /** Absolute path to the repository root (required when multiple roots exist). */
  repositoryPath?: string;
  requirementsPrompt: string;
  sessionId?: string;
  agent?: string;
  model?: string;
}

// Backward-compatible alias for existing imports while transitioning names.
export type AskRequest = GenerateRequirementsRequest;

export interface CopilotSessionInfo {
  sessionId: string;
  session: any;
  repository: string;
  repositoryPath: string;
  userId: string;
  model: string;
}
