import express from "express";
import session from "express-session";
import cors from "cors";
import dotenv from "dotenv";
import { GitHubService } from "./services/github.service";
import { CopilotService } from "./services/copilot.service";
import { SessionManager } from "./services/session-manager";
import { AuthController } from "./api/auth.controller";
import { AskController } from "./api/ask.controller";
import { RepositoriesController } from "./api/repositories.controller";
import { requireAuth } from "./middleware/auth.middleware";
import { CUSTOM_AGENTS } from "./config/agents.config";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Services
const githubService = new GitHubService();
const copilotService = new CopilotService();
const sessionManager = new SessionManager(copilotService);

// Controllers
const authController = new AuthController(githubService);
const askController = new AskController(sessionManager);
const repositoriesController = new RepositoriesController();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes
app.get("/api/auth/login", authController.login.bind(authController));
app.get("/api/auth/callback", authController.callback.bind(authController));
app.get("/api/auth/me", authController.me.bind(authController));
app.post("/api/auth/logout", authController.logout.bind(authController));

// Agents endpoint
app.get("/api/agents", requireAuth, (req, res) => {
  const agents = [
    { name: "auto", displayName: "Auto (let AI decide)" },
    ...CUSTOM_AGENTS.map((a) => ({ name: a.name, displayName: a.displayName })),
  ];
  res.json({ agents });
});

// Protected routes
app.get("/api/repositories", requireAuth, repositoriesController.list.bind(repositoriesController));
app.post("/api/ask", requireAuth, askController.ask.bind(askController));

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Repos path: ${process.env.REPOS_PATH || "/repos"}`);
});
