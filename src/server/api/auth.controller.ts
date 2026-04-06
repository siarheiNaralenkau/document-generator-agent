import { Request, Response } from "express";
import { GitHubService } from "../services/github.service.js";
import crypto from "crypto";

export class AuthController {
  constructor(private githubService: GitHubService) {}

  async login(req: Request, res: Response) {
    try {
      const state = crypto.randomBytes(16).toString("hex");
      req.session.oauthState = state;

      const authUrl = this.githubService.getAuthUrl(state);
      res.json({ url: authUrl });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async callback(req: Request, res: Response) {
    try {
      const { code, state } = req.query;

      // Verify state
      if (state !== req.session.oauthState) {
        return res.status(400).send("Invalid state parameter");
      }

      // Exchange code for token
      const token = await this.githubService.exchangeCodeForToken(code as string);

      // Get user info
      const user = await this.githubService.getUserInfo(token);

      // Store in session
      req.session.userId = user.id;
      req.session.githubToken = token;
      req.session.username = user.login;

      // Redirect to app
      res.redirect("/chat");
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.status(500).send("Authentication failed");
    }
  }

  async me(req: Request, res: Response) {
    if (!req.session.userId) {
      return res.status(401).json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      userId: req.session.userId,
      username: req.session.username,
    });
  }

  async logout(req: Request, res: Response) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  }
}
