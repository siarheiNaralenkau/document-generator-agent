import { Request, Response } from "express";
import { promises as fs } from "fs";
import { isAuthorizedAgentGenFilePath } from "../utils/agent-gen-path.js";

async function fileStatus(filePath?: string) {
  if (!filePath || !isAuthorizedAgentGenFilePath(filePath)) {
    return { ready: false as const, mtime: undefined as string | undefined };
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { ready: false as const, mtime: undefined as string | undefined };
    }
    return { ready: true as const, mtime: stat.mtime.toISOString() };
  } catch {
    return { ready: false as const, mtime: undefined as string | undefined };
  }
}

export class DocumentStatusController {
  async get(req: Request, res: Response) {
    try {
      const featurePath = (req.query.featurePath as string | undefined)?.trim();
      const finalPath = (req.query.finalPath as string | undefined)?.trim();

      if (!featurePath && !finalPath) {
        return res
          .status(400)
          .json({ error: "featurePath or finalPath query parameter is required" });
      }

      const [feature, final] = await Promise.all([
        fileStatus(featurePath),
        fileStatus(finalPath),
      ]);

      res.json({
        featureReady: feature.ready,
        featureMtime: feature.mtime,
        finalReady: final.ready,
        finalMtime: final.mtime,
      });
    } catch (error: any) {
      console.error("Error in document-status controller:", error);
      res.status(500).json({ error: error.message || "Unknown error" });
    }
  }
}

