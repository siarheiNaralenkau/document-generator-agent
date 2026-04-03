# Codebase Q&A Service - Implementation Guide (GitHub OAuth)

## Overview
Complete implementation where each team member authenticates with their GitHub account and uses their own Copilot license.

## Architecture

```
Team Member Browser
       ↓
   Login with GitHub
       ↓
GitHub OAuth Flow
       ↓
Backend receives user token
       ↓
Create Copilot session with user's token
       ↓
User asks questions using their Copilot license
```

## Step 1: Create GitHub OAuth App

### 1.1 Register OAuth App
1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: `Codebase Q&A Service`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback`
4. Click "Register application"
5. Click "Generate a new client secret"
6. **Save these values:**
   - Client ID (e.g., `Iv1.1234567890abcdef`)
   - Client Secret (e.g., `1234567890abcdef1234567890abcdef12345678`)

### 1.2 Create .env Files

**Root .env file:**
```bash
# .env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=generate_random_string_here
```

Generate session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2: Project Structure

```
copilot-qa-service/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env
├── .gitignore
├── README.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   ├── api/
│   │   │   ├── auth.controller.ts
│   │   │   ├── ask.controller.ts
│   │   │   └── repositories.controller.ts
│   │   ├── services/
│   │   │   ├── copilot.service.ts
│   │   │   ├── session-manager.ts
│   │   │   └── github.service.ts
│   │   └── config/
│   │       └── agents.config.ts
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── chat/
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── RepositorySelector.tsx
│   │   │   ├── AgentActivity.tsx
│   │   │   └── MessageList.tsx
│   │   └── api/
│   │       └── [...all proxy routes]
│   └── .env.local
└── repos/
    └── README.md
```

## Step 3: Backend Implementation

### 3.1 package.json
```json
{
  "name": "copilot-qa-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@github/copilot-sdk": "^1.0.0",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.10",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0"
  }
}
```

### 3.2 tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 3.3 src/types/index.ts
```typescript
import { Session as ExpressSession } from "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    githubToken: string;
    username: string;
  }
}

export interface Repository {
  name: string;
  path: string;
}

export interface AskRequest {
  repository: string;
  question: string;
  sessionId?: string;
}

export interface CopilotSessionInfo {
  sessionId: string;
  session: any;
  repository: string;
  userId: string;
}
```

### 3.4 src/config/agents.config.ts
```typescript
export const CUSTOM_AGENTS = [
  {
    name: "explorer",
    displayName: "🔍 Code Explorer",
    description: "Searches and explores code structure, finds files and patterns",
    tools: ["grep", "glob", "view"],
    prompt: `You are a code exploration expert. Your role is to help users find and understand code.

Key responsibilities:
- Use grep to search for content across files
- Use glob to find files by patterns
- Use view to read and analyze code
- Always cite file paths and line numbers in your responses
- Be thorough but concise

When answering:
1. Start by exploring the codebase structure
2. Search for relevant files and code
3. Provide specific references (file:line)
4. Explain what you found clearly`,
  },
  {
    name: "analyzer",
    displayName: "🧠 Code Analyzer",
    description: "Analyzes code logic, patterns, and relationships between components",
    tools: ["grep", "glob", "view"],
    prompt: `You are a code analysis expert. Your role is to explain how code works.

Key responsibilities:
- Trace logic flow through the codebase
- Identify design patterns and architectural decisions
- Explain relationships between components
- Analyze data flow and dependencies

When answering:
1. Read and understand the relevant code
2. Trace the execution flow
3. Identify key patterns and decisions
4. Explain with concrete code examples
5. Highlight important details and edge cases`,
  },
  {
    name: "architect",
    displayName: "🏗️ Architecture Expert",
    description: "Explains high-level architecture, system design, and best practices",
    tools: ["grep", "glob", "view"],
    prompt: `You are a software architect. Your role is to explain system architecture and design.

Key responsibilities:
- Explain high-level system architecture
- Identify architectural patterns (MVC, microservices, etc.)
- Describe component interactions and boundaries
- Discuss design decisions and trade-offs
- Suggest architectural best practices

When answering:
1. Start with the big picture
2. Identify key architectural components
3. Explain how components interact
4. Discuss design decisions
5. Reference specific code to support your explanation`,
  },
];
```

### 3.5 src/services/github.service.ts
```typescript
import axios from "axios";

export class GitHubService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID!;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET!;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${process.env.BASE_URL || "http://localhost:3000"}/api/auth/callback`,
      scope: "read:user",
      state,
    });

    return `${process.env.GITHUB_OAUTH_BASE_URL || "https://github.com"}/login/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await axios.post(
      `${process.env.GITHUB_OAUTH_BASE_URL || "https://github.com"}/login/oauth/access_token`,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    return response.data.access_token;
  }

  async getUserInfo(token: string): Promise<{ id: string; login: string }> {
    const response = await axios.get(
      `${process.env.GITHUB_API_BASE_URL || "https://api.github.com"}/user`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    return {
      id: response.data.id.toString(),
      login: response.data.login,
    };
  }
}
```

### 3.6 src/services/copilot.service.ts
```typescript
import { CopilotClient } from "@github/copilot-sdk";
import { CUSTOM_AGENTS } from "../config/agents.config";
import { CopilotSessionInfo } from "../types";

export class CopilotService {
  private sessions: Map<string, CopilotSessionInfo> = new Map();

  async createSession(
    userId: string,
    githubToken: string,
    repoPath: string,
    repoName: string
  ): Promise<CopilotSessionInfo> {
    const sessionId = `${userId}-${repoName}-${Date.now()}`;

    console.log(`Creating Copilot session for user ${userId} on repo ${repoName}`);

    // Create client with user's GitHub token
    const client = new CopilotClient({
      auth: {
        githubToken, // User's token from OAuth
      },
    });

    await client.start();

    // Create session with custom agents
    const session = await client.createSession({
      model: "gpt-4o",
      workingDirectory: repoPath,
      customAgents: CUSTOM_AGENTS,
      onPermissionRequest: async () => ({ kind: "approved" }),
    });

    const sessionInfo: CopilotSessionInfo = {
      sessionId,
      session,
      repository: repoName,
      userId,
    };

    this.sessions.set(sessionId, sessionInfo);

    console.log(`Session ${sessionId} created successfully`);

    return sessionInfo;
  }

  getSession(sessionId: string): CopilotSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo) {
      await sessionInfo.session.close();
      this.sessions.delete(sessionId);
      console.log(`Session ${sessionId} closed`);
    }
  }

  async closeUserSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );

    await Promise.all(
      userSessions.map((s) => this.closeSession(s.sessionId))
    );

    console.log(`Closed ${userSessions.length} sessions for user ${userId}`);
  }
}
```

### 3.7 src/services/session-manager.ts
```typescript
import { CopilotService } from "./copilot.service";
import { CopilotSessionInfo } from "../types";

export class SessionManager {
  constructor(private copilotService: CopilotService) {}

  async getOrCreateSession(
    userId: string,
    githubToken: string,
    repository: string,
    sessionId?: string
  ): Promise<CopilotSessionInfo> {
    // Try to reuse existing session
    if (sessionId) {
      const existing = this.copilotService.getSession(sessionId);
      if (existing && existing.userId === userId && existing.repository === repository) {
        console.log(`Reusing session ${sessionId}`);
        return existing;
      }
    }

    // Create new session
    const repoPath = `${process.env.REPOS_PATH || "/repos"}/${repository}`;
    return await this.copilotService.createSession(
      userId,
      githubToken,
      repoPath,
      repository
    );
  }
}
```

### 3.8 src/middleware/auth.middleware.ts
```typescript
import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.githubToken) {
    return res.status(401).json({ error: "Unauthorized. Please login." });
  }
  next();
}
```

### 3.9 src/api/auth.controller.ts
```typescript
import { Request, Response } from "express";
import { GitHubService } from "../services/github.service";
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
```

### 3.10 src/api/repositories.controller.ts
```typescript
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
```

### 3.11 src/api/ask.controller.ts
```typescript
import { Request, Response } from "express";
import { SessionManager } from "../services/session-manager";
import { AskRequest } from "../types";

export class AskController {
  constructor(private sessionManager: SessionManager) {}

  async ask(req: Request, res: Response) {
    const { repository, question, sessionId } = req.body as AskRequest;
    const userId = req.session.userId!;
    const githubToken = req.session.githubToken!;

    try {
      // Get or create session
      const sessionInfo = await this.sessionManager.getOrCreateSession(
        userId,
        githubToken,
        repository,
        sessionId
      );

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let responseText = "";

      // Subscribe to session events
      const unsubscribe = sessionInfo.session.on((event: any) => {
        // Stream all events to client
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        // Accumulate response text
        if (event.type === "content.delta" && event.data?.delta) {
          responseText += event.data.delta;
        }
      });

      try {
        // Send question to Copilot
        await sessionInfo.session.sendAndWait({
          prompt: question,
        });

        // Send completion event
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            sessionId: sessionInfo.sessionId,
            response: responseText,
          })}\n\n`
        );
      } catch (error: any) {
        console.error("Error during question processing:", error);
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: error.message,
          })}\n\n`
        );
      } finally {
        unsubscribe();
        res.end();
      }
    } catch (error: any) {
      console.error("Error in ask controller:", error);
      res.status(500).json({ error: error.message });
    }
  }
}
```

### 3.12 src/main.ts
```typescript
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

// Protected routes
app.get("/api/repositories", requireAuth, repositoriesController.list.bind(repositoriesController));
app.post("/api/ask", requireAuth, askController.ask.bind(askController));

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Repos path: ${process.env.REPOS_PATH || "/repos"}`);
});
```

## Step 4: Frontend Implementation

### 4.1 package.json
```json
{
  "name": "copilot-qa-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.3.0"
  }
}
```

### 4.2 next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

### 4.3 tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### 4.4 app/layout.tsx
```typescript
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Codebase Q&A Service',
  description: 'Ask questions about your codebase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### 4.5 app/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4.6 app/page.tsx
```typescript
import { LoginPage } from './components/LoginPage';

export default function Home() {
  return <LoginPage />;
}
```

### 4.7 app/components/LoginPage.tsx
```typescript
'use client';

export function LoginPage() {
  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        credentials: 'include',
      });
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Codebase Q&A
          </h1>
          <p className="text-gray-600">
            Ask questions about your codebase using AI
          </p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Login with GitHub
        </button>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Requires GitHub Copilot license</p>
        </div>
      </div>
    </div>
  );
}
```

### 4.8 app/chat/page.tsx
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '../components/ChatInterface';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/');
        } else {
          setUser(data);
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return <ChatInterface user={user} />;
}
```

### 4.9 app/components/ChatInterface.tsx
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { RepositorySelector } from './RepositorySelector';
import { MessageList } from './MessageList';
import { AgentActivity } from './AgentActivity';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatInterface({ user }: { user: any }) {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/repositories', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setRepositories(data.repositories);
        if (data.repositories.length > 0) {
          setSelectedRepo(data.repositories[0].name);
        }
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/';
  };

  const askQuestion = async () => {
    if (!question.trim() || !selectedRepo) return;

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setQuestion('');
    setAgentEvents([]);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repository: selectedRepo,
          question,
          sessionId,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'complete') {
                setSessionId(data.sessionId);
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: data.response },
                ]);
              } else if (data.type === 'subagent.started') {
                setAgentEvents((prev) => [...prev, data]);
              } else if (data.type === 'subagent.completed') {
                setAgentEvents((prev) =>
                  prev.map((e) =>
                    e.data.toolCallId === data.data.toolCallId
                      ? { ...e, completed: true }
                      : e
                  )
                );
              } else if (data.type === 'content.delta') {
                assistantMessage += data.data.delta;
              } else if (data.type === 'error') {
                console.error('Error:', data.error);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">
              Codebase Q&A
            </h1>
            <RepositorySelector
              repositories={repositories}
              selected={selectedRepo}
              onChange={setSelectedRepo}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
        {/* Agent Activity */}
        {agentEvents.length > 0 && (
          <AgentActivity events={agentEvents} />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">
                  Ask a question about {selectedRepo}
                </p>
                <p className="text-sm">
                  Example: "How does authentication work?"
                </p>
              </div>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && askQuestion()}
              placeholder="Ask a question about the codebase..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={askQuestion}
              disabled={isLoading || !question.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Thinking...' : 'Ask'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.10 app/components/RepositorySelector.tsx
```typescript
'use client';

interface Repository {
  name: string;
  path: string;
}

interface Props {
  repositories: Repository[];
  selected: string;
  onChange: (repo: string) => void;
}

export function RepositorySelector({ repositories, selected, onChange }: Props) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {repositories.map((repo) => (
        <option key={repo.name} value={repo.name}>
          {repo.name}
        </option>
      ))}
    </select>
  );
}
```

### 4.11 app/components/MessageList.tsx
```typescript
'use client';

import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <p>{msg.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4.12 app/components/AgentActivity.tsx
```typescript
'use client';

export function AgentActivity({ events }: { events: any[] }) {
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <div className="flex gap-4">
          {events.map((event, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-medium text-blue-900">
                {event.data.agentDisplayName}
              </span>
              {event.completed && (
                <span className="ml-2 text-green-600">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Step 5: Docker Setup

### 5.1 docker-compose.yml
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: copilot-qa-backend
    ports:
      - "3001:3001"
    volumes:
      - ./repos:/repos:ro
      - sessions-data:/app/sessions
    environment:
      - NODE_ENV=production
      - PORT=3001
      - REPOS_PATH=/repos
      - FRONTEND_URL=http://localhost:3000
      - BASE_URL=http://localhost:3000
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: copilot-qa-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  sessions-data:
```

### 5.2 Dockerfile.backend
```dockerfile
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Copilot CLI
RUN npm install -g @github/copilot-cli

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend code
COPY backend/ .

# Build TypeScript
RUN npm run build

# Create directories
RUN mkdir -p /app/sessions

EXPOSE 3001

CMD ["node", "dist/main.js"]
```

### 5.3 Dockerfile.frontend
```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend code
COPY frontend/ .

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### 5.4 .gitignore
```
node_modules/
dist/
.next/
.env
.env.local
repos/*
!repos/README.md
sessions-data/
*.log
```

## Step 6: Deployment

### 6.1 Setup Script
```bash
#!/bin/bash
# setup.sh

echo "🚀 Setting up Codebase Q&A Service"

# Create directory structure
mkdir -p backend/src/{api,services,middleware,config,types}
mkdir -p frontend/app/{components,chat,api}
mkdir -p repos

# Create .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
EOF
    echo "✅ .env file created. Please update with your GitHub OAuth credentials."
else
    echo "⚠️  .env file already exists. Skipping."
fi

# Create repos README
cat > repos/README.md << EOF
# Repositories Directory

Place your team's repositories here for the Q&A service to access.

## Example:
\`\`\`bash
cd repos
git clone https://github.com/yourorg/project-a
git clone https://github.com/yourorg/project-b
\`\`\`
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your GitHub OAuth credentials"
echo "2. Clone repositories into ./repos/"
echo "3. Run: docker-compose build"
echo "4. Run: docker-compose up -d"
```

### 6.2 Quick Start
```bash
# 1. Clone/create project
mkdir copilot-qa-service && cd copilot-qa-service

# 2. Run setup
chmod +x setup.sh
./setup.sh

# 3. Update .env with your GitHub OAuth credentials

# 4. Clone repositories
cd repos
git clone https://github.com/yourorg/project-a
git clone https://github.com/yourorg/project-b
cd ..

# 5. Build and run
docker-compose build
docker-compose up -d

# 6. Check logs
docker-compose logs -f

# 7. Access application
open http://localhost:3000
```

## Testing

### Test Authentication Flow
1. Open http://localhost:3000
2. Click "Login with GitHub"
3. Authorize the OAuth app
4. Should redirect to /chat

### Test Q&A
1. Select a repository
2. Ask: "What is the main purpose of this project?"
3. Observe agent activity
4. Review answer

### Test Session Persistence
1. Ask a question
2. Ask a follow-up (should use same session)
3. Switch repository (should create new session)

## Monitoring

### Check Logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

### Health Check
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Issue: OAuth callback fails
- Verify callback URL in GitHub OAuth app settings
- Check GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env

### Issue: Copilot SDK errors
- Ensure user has active Copilot license
- Check backend logs for authentication errors

### Issue: No repositories shown
- Verify ./repos directory contains git repositories
- Check backend logs for file system errors

## Next Steps

1. Add metrics and analytics
2. Implement rate limiting
3. Add caching for common questions
4. Deploy to production (AWS/GCP/Azure)
5. Add Slack integration
6. Implement team management

## Cost Estimation

- Each question = 1 Copilot premium request
- Average team (10 users): ~500-1000 questions/month
- Cost: Included in team members' Copilot licenses
