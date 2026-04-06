import { Request, Response, NextFunction } from "express";
import { isByokMode } from "../../lib/byok.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isByokMode()) {
    return next();
  }
  if (!req.session.userId || !req.session.githubToken) {
    return res.status(401).json({ error: "Unauthorized. Please login." });
  }
  next();
}
