# CLAUDE.md

Project instructions for Claude Code. Read this before making any changes.

## Project Overview

SysAccounts — Linux server user management web app. Backend executes system commands (`useradd`, `userdel`, `groupadd`, `who`, `last`, etc.) via Express API. Frontend is React SPA served statically in production. Authentication via [accounts](https://github.com/onchainyaotoshi/accounts) (OAuth 2.0 PKCE).

## Architecture

- **Monorepo** with npm workspaces: root (`server/`) + `client/`
- **Backend**: Node.js ESM (`"type": "module"`) — Express + Socket.IO on configurable port (default 9995 via `PORT` env var)
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

- **Command execution**: Always go through `execute()` in `server/services/executor.js` — never use `child_process` directly in routes. `execute()` supports stdin via `options.stdin` for commands like `chpasswd`
- **Input validation**: Use `server/validator.js` for sanitizing user input before command execution. Validators: `validateUsername`, `validateGroupname`, `validateShell` (allowlist), `validateHome`, `validateGecos`, `validateInteger`, `validateTerminal`, `validateRequired`. All route params (GET/PATCH/DELETE, not just POST) must be validated
- **Security headers**: Helmet middleware enabled (CSP disabled for SPA compatibility)
- **Auth middleware**: `server/middleware/auth.js` validates Bearer tokens against accounts service `/me` endpoint with in-memory cache (5 min TTL)
- **Auth proxy**: `/auth/proxy/*` routes forward SDK requests to accounts server — hardcoded path mappings only. `ACCOUNTS_URL` is read at request time, not module load
- **Auth config**: `GET /auth/config` returns OAuth config to frontend (public endpoint)
- **Rate limiting**: Global API rate limit (60 req/min), password change endpoint (10 req/min)
- **WebSocket auth**: Socket.IO connections require valid Bearer token when `ACCOUNTS_URL` is configured
- **WebSocket events**: `users:changed` and `groups:changed` events are emitted when files change
- **Sudoers validation**: Sudo rules must match standard format regex — no arbitrary rule content allowed
- **API 404**: `/api/*` routes that don't match return JSON 404, not SPA index.html

## Auth

- OAuth 2.0 PKCE via [`@yaotoshi/auth-sdk`](https://github.com/onchainyaotoshi/accounts)
- Config via env vars: `ACCOUNTS_URL`, `OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`, `OAUTH_POST_LOGOUT_REDIRECT_URI`
- Auth middleware conditionally applied — if `ACCOUNTS_URL` not set, auth is skipped (dev mode)
- Frontend SDK singleton in `client/src/auth.js`
- API client sends Bearer token on every request, 401 → clear auth-specific storage keys + redirect to login
- WebSocket connections send token via `socket.handshake.auth.token`

### @yaotoshi/auth-sdk gotchas

**1. CORS trap:** SDK's `apiUrl()` method constructs URLs as `accountsUrl + apiPathPrefix + path`. This means API calls (token exchange, /me, logout) go cross-origin to the accounts server, which will fail CORS because accounts server doesn't set `Access-Control-Allow-Origin` headers.

**Fix:** Override `apiUrl()` after init to use relative paths through our backend auth proxy:

```javascript
authInstance = new YaotoshiAuth({ accountsUrl: config.accountsUrl, ... });
authInstance.apiUrl = (path) => `/auth/proxy${path}`;
```

This makes:
- API calls (token, /me, logout) → `/auth/proxy/*` (same-origin, no CORS) → backend forwards to accounts server
- Login redirect → `accountsUrl/authorize` (browser redirect, not fetch — CORS doesn't apply)

**Do NOT use `apiPathPrefix` config option** — it still prepends `accountsUrl`, causing cross-origin requests. The `apiUrl()` override is the only way to get relative paths.

**2. Accounts API path:** `accounts.yaotoshi.xyz` is a Next.js frontend, not the API directly. The NestJS API sits behind it, proxied via `/api/proxy/*`. So the backend auth proxy must forward to `/api/proxy/token`, `/api/proxy/me`, `/api/proxy/logout` — NOT `/token`, `/me`, `/logout` (those return Next.js 404). This applies to both `authProxy.js` routes and auth middleware token validation.

## Docker Notes

- Container needs `privileged: true` and `pid: "host"` to manage system users
- Mounts: `/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/gshadow`, `/etc/sudoers`, `/etc/sudoers.d`, `/home`, `/var/run/utmp`, `/var/log/wtmp`
- Alpine-based image with `sudo`, `shadow`, `util-linux` packages
- OAuth env vars loaded via `env_file: .env` (see `.env.example`)
- Port configurable via `PORT` env var — Dockerfile, docker-compose.yml, and app all default to `9995`
- HEALTHCHECK polls `/api/health` every 30s
- Resource limits: 512MB memory, 1 CPU
- Log rotation: json-file driver, 10MB max x 3 files
- `.dockerignore` excludes `.git`, `.env`, `node_modules`, tests, docs from build context
