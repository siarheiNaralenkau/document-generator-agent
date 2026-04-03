import express from "express";
import session from "express-session";
import cors from "cors";
import dotenv from "dotenv";
import { GitHubService } from "./services/github.service.js";
import { CopilotService } from "./services/copilot.service.js";
import { SessionManager } from "./services/session-manager.js";
import { AuthController } from "./api/auth.controller.js";
import { AskController } from "./api/ask.controller.js";
import { RepositoriesController } from "./api/repositories.controller.js";
import { DocumentStatusController } from "./api/document-status.controller.js";
import { GeneratedDocumentController } from "./api/generated-document.controller.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { CUSTOM_AGENTS } from "./config/agents.config.js";
import { getUserReposRoot } from "./config/repos.config.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isHttpsBaseUrl = (process.env.BASE_URL || "").startsWith("https://");
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE
  ? process.env.SESSION_COOKIE_SECURE === "true"
  : isHttpsBaseUrl;

// Services
const githubService = new GitHubService();
const copilotService = new CopilotService();
const sessionManager = new SessionManager(copilotService);

// Controllers
const authController = new AuthController(githubService);
const askController = new AskController(sessionManager);
const repositoriesController = new RepositoriesController();
const documentStatusController = new DocumentStatusController();
const generatedDocumentController = new GeneratedDocumentController();

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
      secure: sessionCookieSecure,
      sameSite: "lax",
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
app.get(
  "/api/repositories",
  requireAuth,
  repositoriesController.list.bind(repositoriesController)
);
app.post(
  "/api/repositories/clone",
  requireAuth,
  repositoriesController.clone.bind(repositoriesController)
);
app.post("/api/ask", requireAuth, askController.ask.bind(askController));
app.get(
  "/api/document-status",
  requireAuth,
  documentStatusController.get.bind(documentStatusController)
);
app.post(
  "/api/generated-document/preview",
  requireAuth,
  generatedDocumentController.preview.bind(generatedDocumentController)
);
app.post(
  "/api/generated-document/download",
  requireAuth,
  generatedDocumentController.download.bind(generatedDocumentController)
);

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Repositories root: ${getUserReposRoot()}`);
});
