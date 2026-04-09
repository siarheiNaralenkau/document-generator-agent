import { Request, Response } from "express";
import { BYOK_USER_ID } from "../../lib/byok.js";

export class AuthController {
  async me(req: Request, res: Response) {
    void req;
    return res.json({
      authenticated: true,
      userId: BYOK_USER_ID,
      username: "BYOK",
      authMode: "byok" as const,
    });
  }

  async logout(req: Request, res: Response) {
    void req;
    res.json({ success: true });
  }
}
