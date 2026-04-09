# Implementation Guide (BYOK-Only)

## Overview

The service runs in BYOK-only mode. GitHub OAuth flow has been removed from both backend and frontend.

Copilot SDK provider credentials are configured via environment:

- `MODEL_URL` (required)
- `MODEL_API_KEY` (required)
- `MODEL_PROVIDER` (optional)
- `MODEL_WIRE_API` (optional)
- `COPILOT_MODEL` (optional)

## Runtime Flow

1. Server starts and validates `MODEL_URL` + `MODEL_API_KEY`.
2. Frontend root redirects directly to `/chat`.
3. `/api/auth/me` returns a synthetic BYOK user.
4. `/api/ask` creates/reuses sessions keyed by repository/model.
5. `CopilotService` always creates sessions with provider config from BYOK env vars.

## Backend Notes

- `AuthController` is BYOK-only (`/api/auth/me`, `/api/auth/logout` no-op success).
- `requireAuth` is pass-through in BYOK mode.
- GitHub OAuth service/routes are removed.
- `RepositoriesController` supports cloning public `https://github.com/*/*` repositories.

## Frontend Notes

- Login page is removed.
- Home route redirects to `/chat`.
- Chat page uses synthetic BYOK user display.
- Logout button is removed.

## Environment

Example:

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

## Docker

`docker-compose.yml` passes BYOK variables into the app container.  
GitHub OAuth-related variables are not used.

## Validation Checklist

- App does not start without `MODEL_URL` and `MODEL_API_KEY`.
- `/` redirects to `/chat`.
- `/api/auth/me` returns authenticated BYOK identity.
- Ask and document generation flows work with configured provider credentials.
