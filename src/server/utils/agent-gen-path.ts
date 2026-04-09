import path from "path";

/** Paths containing `.copilot-sdk-demo/agent-gen-results` (per-repo or legacy home layout) for read/download. */
export function isAuthorizedAgentGenFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  const normalized = path.normalize(filePath);
  const marker = path.join(".copilot-sdk-demo", "agent-gen-results");
  return normalized.includes(marker);
}
