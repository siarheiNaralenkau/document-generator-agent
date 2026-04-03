import { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import { createReadStream } from "fs";
import { isAuthorizedAgentGenFilePath } from "../utils/agent-gen-path.js";

const PREVIEW_MAX_WORDS = 220;
const READ_MAX_BYTES = 8 * 1024 * 1024;

function markdownPreview(text: string, maxWords: number): { preview: string; truncated: boolean } {
  const trimmed = text.replace(/^\uFEFF/, "");
  const words = trimmed.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return { preview: trimmed, truncated: false };
  }
  return {
    preview: words.slice(0, maxWords).join(" ").trim(),
    truncated: true,
  };
}

export class GeneratedDocumentController {
  async preview(req: Request, res: Response) {
    try {
      const filePath = (req.body as { path?: string })?.path?.trim();
      if (!filePath || !isAuthorizedAgentGenFilePath(filePath)) {
        res.status(400).json({ error: "Invalid or missing path" });
        return;
      }

      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        res.status(404).json({ error: "Not a file" });
        return;
      }
      if (stat.size > READ_MAX_BYTES) {
        res.status(413).json({ error: "File too large" });
        return;
      }

      const raw = await fs.readFile(filePath, "utf8");
      const { preview, truncated } = markdownPreview(raw, PREVIEW_MAX_WORDS);

      res.json({
        preview,
        truncated,
        filename: path.basename(filePath),
      });
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        res.status(404).json({ error: "File not found" });
        return;
      }
      console.error("generated-document preview:", e);
      res.status(500).json({ error: e?.message || "Failed to read file" });
    }
  }

  async download(req: Request, res: Response) {
    try {
      const filePath = (req.body as { path?: string })?.path?.trim();
      if (!filePath || !isAuthorizedAgentGenFilePath(filePath)) {
        res.status(400).json({ error: "Invalid or missing path" });
        return;
      }

      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        res.status(404).json({ error: "Not a file" });
        return;
      }
      if (stat.size > READ_MAX_BYTES) {
        res.status(413).json({ error: "File too large" });
        return;
      }

      const filename = path.basename(filePath);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");

      const stream = createReadStream(filePath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      stream.pipe(res);
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        res.status(404).json({ error: "File not found" });
        return;
      }
      console.error("generated-document download:", e);
      res.status(500).json({ error: e?.message || "Failed to read file" });
    }
  }
}
