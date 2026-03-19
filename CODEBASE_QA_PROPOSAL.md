# Codebase Q&A Service - Solution Proposal

## Overview
A team-deployed service where developers ask questions about their codebase and get intelligent answers from Copilot SDK agents.

**Example Questions:**
- "How does authentication work in this project?"
- "Where is the payment processing logic?"
- "What patterns are used for error handling?"
- "How do I add a new API endpoint?"
- "Find all database queries that don't use transactions"

## Architecture

```
┌─────────────────────────────────────────────────────┐
│               Team Members                          │
│         (Web Browser - http://localhost:3000)       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Frontend (React/Next.js)               │
│  - Chat UI                                          │
│  - Repository selector                              │
│  - Streaming responses                              │
│  - Agent activity visualization                     │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP/WebSocket
                        ▼
┌─────────────────────────────────────────────────────┐
│           Backend API (Node.js/TypeScript)          │
│  ┌───────────────────────────────────────────────┐  │
│  │  API Layer                                    │  │
│  │  - /api/repositories (list available repos)  │  │
│  │  - /api/ask (submit question)                │  │
│  │  - /api/stream (SSE for responses)           │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Copilot SDK Integration                     │  │
│  │  - Session management                        │  │
│  │  - Custom agents (explorer, analyzer, etc)  │  │
│  │  - Event streaming                           │  │
│  └───────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│            Local Repositories                       │
│  /repos/                                            │
│    ├── project-a/                                   │
│    ├── project-b/                                   │
│    └── project-c/                                   │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Next.js 15** with App Router
- **Tailwind CSS** for styling
- **Server-Sent Events (SSE)** for streaming
- **React Markdown** for formatted responses

### Backend
- **Node.js 20** with TypeScript
- **@github/copilot-sdk** (latest)
- **Express** or **Fastify** for API
- **WebSocket/SSE** for real-time streaming

### Infrastructure
- **Docker Compose** for local deployment
- **Volume mounts** for repository access
- **Redis** (optional) for session caching

## Docker Setup

### Project Structure
```
copilot-qa-service/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.ts
│   │   ├── api/
│   │   │   ├── ask.controller.ts
│   │   │   └── repositories.controller.ts
│   │   ├── services/
│   │   │   ├── copilot.service.ts
│   │   │   └── session-manager.ts
│   │   └── agents/
│   │       ├── explorer.agent.ts
│   │       ├── analyzer.agent.ts
│   │       └── architect.agent.ts
│   └── .env
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── page.tsx
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── RepositorySelector.tsx
│   │   │   ├── AgentActivity.tsx
│   │   │   └── StreamingResponse.tsx
│   │   └── api/
│   │       └── proxy routes
│   └── .env.local
└── repos/  # Mounted volume for team repositories
    ├── .gitkeep
    └── README.md
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: ../Dockerfile.backend
    container_name: copilot-qa-backend
    ports:
      - "3001:3001"
    volumes:
      - ./repos:/repos:ro  # Read-only access to repositories
      - copilot-sessions:/app/sessions  # Session persistence
    environment:
      - NODE_ENV=production
      - PORT=3001
      - REPOS_PATH=/repos
      - COPILOT_GITHUB_TOKEN=${COPILOT_GITHUB_TOKEN}
      # Or use BYOK
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: ../Dockerfile.frontend
    container_name: copilot-qa-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - backend
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: copilot-qa-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  copilot-sessions:
  redis-data:
```

### Dockerfile.backend
```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Copilot CLI globally
RUN npm install -g @github/copilot-cli

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY backend/ .

# Build TypeScript
RUN npm run build

# Create sessions directory
RUN mkdir -p /app/sessions

EXPOSE 3001

CMD ["node", "dist/main.js"]
```

### Dockerfile.frontend
```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./
RUN npm ci

# Copy application code
COPY frontend/ .

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## Implementation Details

### Backend: Copilot Service

```typescript
// backend/src/services/copilot.service.ts
import { CopilotClient } from "@github/copilot-sdk";
import path from "path";

export class CopilotService {
  private client: CopilotClient;
  private sessions: Map<string, any> = new Map();

  constructor() {
    this.client = new CopilotClient({
      // Use bundled CLI
      cli: {
        bundled: true,
      },
    });
  }

  async start() {
    await this.client.start();
  }

  async createQASession(repoPath: string, repoName: string) {
    const sessionId = `${repoName}-${Date.now()}`;

    const session = await this.client.createSession({
      model: "gpt-4.1",
      workingDirectory: repoPath,
      customAgents: [
        {
          name: "explorer",
          displayName: "Code Explorer",
          description: "Searches and explores code structure, finds files and patterns",
          tools: ["grep", "glob", "view"],
          prompt: `You are a code exploration expert. Help users find and understand code.
                   Use grep to search content, glob to find files, and view to read code.
                   Be thorough but concise. Always cite file paths and line numbers.`,
        },
        {
          name: "analyzer",
          displayName: "Code Analyzer",
          description: "Analyzes code logic, patterns, and relationships",
          tools: ["grep", "glob", "view"],
          prompt: `You are a code analysis expert. Explain how code works.
                   Trace logic flow, identify patterns, and explain relationships.
                   Reference specific code examples in your explanations.`,
        },
        {
          name: "architect",
          displayName: "Architecture Expert",
          description: "Explains high-level architecture and design patterns",
          tools: ["grep", "glob", "view"],
          prompt: `You are a software architect. Explain system architecture and design.
                   Identify patterns, describe component interactions, and explain decisions.
                   Provide architectural insights and best practices.`,
        },
      ],
      onPermissionRequest: async () => ({ kind: "approved" }),
    });

    this.sessions.set(sessionId, session);
    return { sessionId, session };
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  async cleanup(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.close();
      this.sessions.delete(sessionId);
    }
  }
}
```

### Backend: Ask Controller

```typescript
// backend/src/api/ask.controller.ts
import { Request, Response } from "express";
import { CopilotService } from "../services/copilot.service";

export class AskController {
  constructor(private copilotService: CopilotService) {}

  async ask(req: Request, res: Response) {
    const { repository, question, sessionId } = req.body;

    try {
      // Get or create session
      let session;
      let currentSessionId = sessionId;

      if (sessionId) {
        session = this.copilotService.getSession(sessionId);
      }

      if (!session) {
        const repoPath = `/repos/${repository}`;
        const result = await this.copilotService.createQASession(
          repoPath,
          repository
        );
        session = result.session;
        currentSessionId = result.sessionId;
      }

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream events
      const unsubscribe = session.on((event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Send question
      const response = await session.sendAndWait({
        prompt: question,
      });

      // Send final response
      res.write(
        `data: ${JSON.stringify({
          type: "complete",
          sessionId: currentSessionId,
          response: response.text,
        })}\n\n`
      );

      unsubscribe();
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error.message,
        })}\n\n`
      );
      res.end();
    }
  }

  async listRepositories(req: Request, res: Response) {
    const fs = require("fs").promises;
    const reposPath = process.env.REPOS_PATH || "/repos";

    try {
      const entries = await fs.readdir(reposPath, { withFileTypes: true });
      const repos = entries
        .filter((entry: any) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry: any) => ({
          name: entry.name,
          path: `${reposPath}/${entry.name}`,
        }));

      res.json({ repositories: repos });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

### Frontend: Chat Interface

```typescript
// frontend/app/components/ChatInterface.tsx
"use client";

import { useState, useEffect } from "react";
import { StreamingResponse } from "./StreamingResponse";
import { AgentActivity } from "./AgentActivity";

export function ChatInterface({ repository }: { repository: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<any[]>([]);

  const askQuestion = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setQuestion("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository, question, sessionId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "complete") {
              setSessionId(data.sessionId);
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.response },
              ]);
            } else if (data.type === "subagent.started") {
              setAgentEvents((prev) => [...prev, data]);
            } else if (data.type === "content.delta") {
              assistantMessage += data.data.delta;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* Agent Activity */}
      <AgentActivity events={agentEvents} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg ${
              msg.role === "user"
                ? "bg-blue-100 ml-auto max-w-[80%]"
                : "bg-gray-100 mr-auto max-w-[80%]"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="text-gray-500">Thinking...</div>}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && askQuestion()}
          placeholder="Ask a question about the codebase..."
          className="flex-1 px-4 py-2 border rounded-lg"
          disabled={isLoading}
        />
        <button
          onClick={askQuestion}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
```

### Frontend: Agent Activity Visualization

```typescript
// frontend/app/components/AgentActivity.tsx
"use client";

export function AgentActivity({ events }: { events: any[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold mb-2">Agent Activity</h3>
      <div className="space-y-2">
        {events.map((event, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-medium">{event.data.agentDisplayName}</span>
            <span className="text-gray-600">{event.data.agentDescription}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Setup Instructions

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
docker --version
docker-compose --version

# Get Copilot GitHub token or use BYOK
export COPILOT_GITHUB_TOKEN="your_token"
# OR
export OPENAI_API_KEY="your_openai_key"
```

### 2. Clone and Setup
```bash
# Create project structure
mkdir copilot-qa-service && cd copilot-qa-service

# Create repos directory for team repositories
mkdir -p repos

# Clone your team's repositories into repos/
cd repos
git clone https://github.com/yourteam/project-a
git clone https://github.com/yourteam/project-b
cd ..
```

### 3. Build and Run
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

### 4. Access
```bash
# Open in browser
open http://localhost:3000

# API health check
curl http://localhost:3001/health
```

## Team Usage

### For Team Members:
1. Open http://localhost:3000
2. Select repository from dropdown
3. Ask questions in chat interface
4. See real-time agent activity
5. Get answers with code references

### For Admins:
1. Add new repos to `./repos/` directory
2. Restart backend: `docker-compose restart backend`
3. Monitor logs: `docker-compose logs -f`
4. Update SDK: Rebuild containers

## Features Demonstrated

### 1. Custom Agents ✅
- Explorer agent (finds code)
- Analyzer agent (explains logic)
- Architect agent (system design)

### 2. Multi-Repository Support ✅
- Team can query any mounted repository
- Session persistence per repo
- Easy to add new repos

### 3. Streaming Responses ✅
- Real-time SSE streaming
- Agent activity visualization
- Progress indicators

### 4. Session Management ✅
- Persistent sessions per repo
- Context maintained across questions
- Clean session cleanup

### 5. Production-Ready ✅
- Docker containerized
- Health checks
- Logging and monitoring
- Easy deployment

## Scaling for Team

### Current Setup (Single Server)
- 5-10 concurrent users
- Multiple repositories
- Shared resources

### Future Scaling
- Add more backend replicas
- Use Redis for session sharing
- Add load balancer
- Deploy to AWS/Cloud if needed

## Cost Estimation

### Using GitHub Copilot
- ~$10-20/month per user
- Billed as premium requests

### Using BYOK (OpenAI)
- ~$0.03 per question (GPT-4)
- ~$100-200/month for active team

## Next Steps

1. **Week 1**: Backend + Copilot SDK integration
2. **Week 2**: Frontend chat interface
3. **Week 3**: Docker setup + testing
4. **Week 4**: Team onboarding + docs

## Demo Script

1. Show Docker Compose running
2. Open UI, select repository
3. Ask: "How does authentication work?"
4. Show agent activity in real-time
5. Display answer with code references
6. Ask follow-up: "Where is JWT validation?"
7. Show session context maintained
8. Switch to different repository
9. Show metrics/logs
