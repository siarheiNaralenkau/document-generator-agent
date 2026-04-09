import express from "express";
import cors from "cors";
import { CopilotService } from "./services/copilot.service.js";
import { SessionManager } from "./services/session-manager.js";
import { AuthController } from "./api/auth.controller.js";
import { RequirementsController } from "./api/requirements.controller.js";
import { RepositoriesController } from "./api/repositories.controller.js";
import { DocumentStatusController } from "./api/document-status.controller.js";
import { GeneratedDocumentController } from "./api/generated-document.controller.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { CUSTOM_AGENTS } from "./config/agents.config.js";

export function createApp(): express.Application {
  const app = express();
  const corsOrigin =
    process.env.FRONTEND_URL ||
    process.env.BASE_URL ||
    "http://localhost:3000";

  // Services
  const copilotService = new CopilotService();
  const sessionManager = new SessionManager(copilotService);

  // Controllers
  const authController = new AuthController();
  const requirementsController = new RequirementsController(sessionManager);
  const repositoriesController = new RepositoriesController();
  const documentStatusController = new DocumentStatusController();
  const generatedDocumentController = new GeneratedDocumentController();

  // Middleware
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  // Routes
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth routes
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
  app.post(
    "/api/generate-requirements",
    requireAuth,
    requirementsController.generateRequirements.bind(requirementsController)
  );
  // No requireAuth: polling uses long encoded paths; session cookies can be flaky on some hosts.
  // Only file mtimes for paths under agent-gen-results (see isAuthorizedAgentGenFilePath).
  app.get("/api/document-status", documentStatusController.get.bind(documentStatusController));
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

  return app;
}
