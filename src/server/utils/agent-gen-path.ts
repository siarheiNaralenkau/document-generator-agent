import path from "path";

/** Paths under ~/.copilot-sdk-demo/agent-gen-results are allowed for read/download. */
export function isAuthorizedAgentGenFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  const normalized = path.normalize(filePath);
  const marker = path.join(".copilot-sdk-demo", "agent-gen-results");
  return normalized.includes(marker);
}
