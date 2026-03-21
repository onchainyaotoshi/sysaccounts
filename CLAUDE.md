# CLAUDE.md

Project instructions for Claude Code. Read this before making any changes.

## Project Overview

SysAccounts — Linux server user management web app. Backend executes system commands (`useradd`, `userdel`, `groupadd`, `who`, `last`, etc.) via Express API. Frontend is React SPA served statically in production. Authentication via [accounts](https://github.com/onchainyaotoshi/accounts) (OAuth 2.0 PKCE).

## Architecture

- **Monorepo** with npm workspaces: root (`server/`) + `client/`
- **Backend**: Node.js ESM (`"type": "module"`) — Express + Socket.IO on port 9998
- **Frontend**: React 18 + Vite + React Router — builds to `client/dist/`
- **Auth**: OAuth 2.0 PKCE via [`@yaotoshi/auth-sdk`](https://github.com/onchainyaotoshi/accounts) — backend validates tokens, frontend handles login flow
- **Docker**: Multi-stage build, privileged container with host PID
- **Real-time**: Chokidar watches `/etc/passwd` and `/etc/group`, pushes changes via Socket.IO

## Commands

```bash
# Development
npm run dev              # Start backend server
npm run dev:client       # Start Vite dev server for frontend

# Testing
npm test                 # Run Jest tests (uses --experimental-vm-modules)

# Build
npm run build            # Build frontend

# Production
docker compose up -d --build
```

## Code Conventions

- ESM imports everywhere (`import/export`, no `require`)
- Services layer (`server/services/`) handles all Linux command execution via `executor.js`
- Routes layer (`server/routes/`) handles HTTP request/response only
- Frontend components are in `client/src/components/` — one component per file
- API client is centralized in `client/src/api/client.js`
- Shared UI components (e.g. `MultiSelect.jsx`) are reused across forms
- No TypeScript — plain JavaScript throughout
- Tests go in `server/__tests__/` with `.test.js` extension

## Important Patterns

- **Command execution**: Always go through `execute()` in `server/services/executor.js` — never use `child_process` directly in routes
- **Input validation**: Use `server/validator.js` for sanitizing user input before command execution (prevents command injection)
- **Auth middleware**: `server/middleware/auth.js` validates Bearer tokens against accounts service `/me` endpoint with in-memory cache (5 min TTL)
- **Auth proxy**: `/auth/proxy/*` routes forward SDK requests to accounts server — hardcoded path mappings only
- **Auth config**: `GET /auth/config` returns OAuth config to frontend (public endpoint)
- **Rate limiting**: Password change and session kill endpoints have rate limiting (10 req/min)
- **WebSocket events**: `users-changed` and `groups-changed` events are emitted when files change

## Auth

- OAuth 2.0 PKCE via [`@yaotoshi/auth-sdk`](https://github.com/onchainyaotoshi/accounts)
- Config via env vars: `ACCOUNTS_URL`, `OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`, `OAUTH_POST_LOGOUT_REDIRECT_URI`
- Auth middleware conditionally applied — if `ACCOUNTS_URL` not set, auth is skipped (dev mode)
- Frontend SDK singleton in `client/src/auth.js`
- API client sends Bearer token on every request, 401 → clear storage + redirect to login

## Docker Notes

- Container needs `privileged: true` and `pid: "host"` to manage system users
- Mounts: `/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/gshadow`, `/etc/sudoers`, `/etc/sudoers.d`, `/home`, `/var/run/utmp`, `/var/log/wtmp`
- Alpine-based image with `sudo`, `shadow`, `util-linux` packages
- OAuth env vars loaded via `env_file: .env` (see `.env.example`)
