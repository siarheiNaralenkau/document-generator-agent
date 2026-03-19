import { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";

export class RepositoriesController {
  async list(req: Request, res: Response) {
    try {
      const reposPath = process.env.REPOS_PATH || "/repos";
      const entries = await fs.readdir(reposPath, { withFileTypes: true });

      const repos = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => ({
          name: entry.name,
          path: path.join(reposPath, entry.name),
        }));

      res.json({ repositories: repos });
    } catch (error: any) {
      console.error("Error listing repositories:", error);
      res.status(500).json({ error: error.message });
    }
  }
}
