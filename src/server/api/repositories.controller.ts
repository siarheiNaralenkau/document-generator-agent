import { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { ensureUserReposRoot, getUserReposRoot } from "../config/repos.config.js";

async function listRepoDirectories(root: string): Promise<{ name: string; path: string }[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({
        name: entry.name,
        path: path.join(root, entry.name),
      }));
  } catch {
    return [];
  }
}

function getAllowedCloneHosts(): Set<string> {
  return new Set<string>(["github.com"]);
}

function parseGithubOwnerRepoFromHttps(url: URL): { owner: string; repo: string } | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  let repo = parts[1];
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  if (!owner || !repo) return null;
  return { owner, repo };
}

function runGit(args: string[], options: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `git exited with ${code}`));
    });
  });
}

export class RepositoriesController {
  async list(req: Request, res: Response) {
    try {
      await ensureUserReposRoot();
      const userRoot = getUserReposRoot();
      const repositories = (await listRepoDirectories(userRoot)).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      res.json({ repositories });
    } catch (error: any) {
      console.error("Error listing repositories:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async clone(req: Request, res: Response) {
    try {
      const rawUrl = (req.body as { url?: string })?.url;
      if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
        res.status(400).json({ error: "Missing url" });
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl.trim());
      } catch {
        res.status(400).json({ error: "Invalid URL" });
        return;
      }

      if (parsed.protocol !== "https:") {
        res.status(400).json({ error: "Only https:// repository URLs are supported" });
        return;
      }

      const allowed = getAllowedCloneHosts();
      if (!allowed.has(parsed.hostname.toLowerCase())) {
        res.status(400).json({ error: "Host is not allowed for cloning" });
        return;
      }

      const ownerRepo = parseGithubOwnerRepoFromHttps(parsed);
      if (!ownerRepo) {
        res.status(400).json({ error: "Could not parse owner/repo from URL" });
        return;
      }

      const cloneUrl = `https://${parsed.hostname}/${ownerRepo.owner}/${ownerRepo.repo}.git`;
      try {
        // Fast, auth-free reachability check. Private repos are inaccessible in BYOK-only mode.
        await runGit(["ls-remote", "--heads", cloneUrl]);
      } catch (e: any) {
        console.error("Repository reachability check failed:", e);
        res.status(400).json({ error: "Repository not found or not accessible (public https GitHub repos only)" });
        return;
      }

      const userRoot = await ensureUserReposRoot();
      const targetDirName = `${ownerRepo.owner}-${ownerRepo.repo}`;
      const targetPath = path.join(userRoot, targetDirName);

      try {
        await fs.access(path.join(targetPath, ".git"));
        await runGit(["pull"], { cwd: targetPath });
      } catch {
        await fs.rm(targetPath, { recursive: true, force: true }).catch(() => {});
        await runGit(["clone", "--depth", "1", cloneUrl, targetPath]);
      }

      const addedAfter = await listRepoDirectories(userRoot);
      const repositories = addedAfter.sort((a, b) => a.name.localeCompare(b.name));
      const entry =
        repositories.find((r) => r.path === targetPath) ?? {
          name: targetDirName,
          path: targetPath,
        };

      res.json({ repository: entry });
    } catch (error: any) {
      console.error("Error cloning repository:", error);
      res.status(500).json({ error: error.message || "Clone failed" });
    }
  }
}
