import { promises as fs } from "fs";
import os from "os";
import path from "path";

/**
 * Root where available repositories are listed and URL clones are stored.
 * Always ~/.copilot-sdk-demo/repos (home = process user, e.g. /root in Docker).
 */
export function getUserReposRoot(): string {
  return path.join(os.homedir(), ".copilot-sdk-demo", "repos");
}

export async function ensureUserReposRoot(): Promise<string> {
  const root = getUserReposRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

function formatDateFolder(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * ~/.copilot-sdk-demo/agent-gen-results/YYYY-MM-DD (server process home).
 */
export function getAgentGenResultsRootForDate(date: Date): string {
  return path.join(
    os.homedir(),
    ".copilot-sdk-demo",
    "agent-gen-results",
    formatDateFolder(date)
  );
}

export async function ensureAgentGenResultsDirForDate(date: Date): Promise<string> {
  const dir = getAgentGenResultsRootForDate(date);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
