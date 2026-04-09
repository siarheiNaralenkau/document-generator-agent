import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // BYOK-only mode: all requests use server-side provider credentials.
  void req;
  void res;
  next();
}
