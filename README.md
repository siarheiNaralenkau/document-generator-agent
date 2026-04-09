# Codebase Q&A Service

AI-powered codebase Q&A and document generation service using GitHub Copilot SDK with **BYOK-only** authentication.

## Authentication Model

This service no longer supports GitHub OAuth login.  
All Copilot SDK sessions use provider credentials from environment variables.

- Required: `MODEL_URL`
- Required: `MODEL_API_KEY`
- Optional: `MODEL_PROVIDER` (`openai` | `azure` | `anthropic`)
- Optional: `MODEL_WIRE_API` (`completions` | `responses`)
- Optional: `COPILOT_MODEL`

The server exits on startup if required BYOK variables are missing.

## Architecture

Single Node.js process:

- Express serves `/api/*` and `/health`
- Next.js serves the UI
- Both run on the same port (default `3000`)

## Quick Start

```bash
cp .env.example .env
# Fill MODEL_URL and MODEL_API_KEY in .env

npm install
npm run dev
```

Production-style:

```bash
npm run build
npm start
```

## Docker

```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```

Open: [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example` for full details.

```bash
NODE_ENV=production
PORT=3000
BASE_URL=http://localhost:3000

MODEL_URL=https://api.openai.com/v1
MODEL_API_KEY=your-model-api-key
# MODEL_PROVIDER=openai
# MODEL_WIRE_API=completions
# COPILOT_MODEL=claude-haiku-4.5
```

## Usage

1. Open the app.
2. Add/select a repository.
3. Ask questions or run document generation.

## Repositories

Cloned repositories are stored under:

`~/.copilot-sdk-demo/repos`

## Troubleshooting

### App fails to start
Ensure both `MODEL_URL` and `MODEL_API_KEY` are set.

### No repositories shown
Clone/add a repository from the UI and verify the repo root is writable.

### Runtime API errors
Check app logs and confirm provider URL/key are valid.

## Built With

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Next.js](https://nextjs.org/)
- [Express](https://expressjs.com/)
