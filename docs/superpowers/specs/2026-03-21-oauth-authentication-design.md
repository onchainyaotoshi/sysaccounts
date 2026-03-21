# OAuth Authentication Integration Design

**Date:** 2026-03-21
**Status:** Approved
**Provider:** Yaotoshi Accounts (onchainyaotoshi/accounts)

## Overview

Integrate OAuth 2.0 PKCE authentication into server-user-management using the Yaotoshi Accounts service and `@yaotoshi/auth-sdk`. All users who authenticate get full access (no role-based access control). All configuration is domain-agnostic via environment variables.

## Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `ACCOUNTS_URL` | Yes | `https://accounts.example.com` |
| `OAUTH_CLIENT_ID` | Yes | `my-client-id` |
| `OAUTH_REDIRECT_URI` | Yes | `http://localhost:9998/auth/callback` |
| `OAUTH_POST_LOGOUT_REDIRECT_URI` | Yes | `http://localhost:9998` |

These should be stored in a `.env` file (added to `.gitignore`) and referenced via `env_file:` in docker-compose.yml to avoid committing credentials.

## Authentication Flow

1. User opens app → not authenticated → login page with "Login with Yaotoshi" button
2. Click login → SDK redirects to `{ACCOUNTS_URL}/authorize` with PKCE challenge
3. User authenticates at accounts service
4. Accounts redirects back to `/auth/callback` with authorization code
5. Frontend SDK exchanges code for access token via `/auth/proxy/token`
6. SDK stores token in localStorage, fetches user info via `/auth/proxy/me`
7. All subsequent API calls include `Authorization: Bearer <token>` header
8. Backend auth middleware validates token by calling accounts `/me` endpoint
9. Token validation cached in-memory (TTL: 5 minutes) to reduce latency
10. Logout → SDK calls `/auth/proxy/logout` → token cleared → redirect to app

## Backend Changes

### New Files

#### `server/middleware/auth.js` — Auth middleware
- Intercepts all `/api/*` requests except `/api/health`
- Reads `Authorization: Bearer <token>` from request header
- Validates token by calling `GET {ACCOUNTS_URL}/me` with Bearer token
- In-memory cache: `Map<tokenHash, { userInfo, expiresAt }>`, TTL 5 minutes
- Token hashed with SHA-256 before using as cache key (don't store raw tokens)
- Periodic cache cleanup every 10 minutes (sweep expired entries) to prevent unbounded growth
- Returns 401 `{ error: 'UNAUTHORIZED', message: 'Authentication required' }` if invalid
- Attaches `req.user` (email, sub) on success for audit logging

#### `server/routes/authProxy.js` — Proxy routes for SDK
- Uses fixed hardcoded path mappings (NOT dynamic path forwarding):
  - `POST /auth/proxy/token` → `{ACCOUNTS_URL}/token`
  - `GET /auth/proxy/me` → `{ACCOUNTS_URL}/me`
  - `POST /auth/proxy/logout` → `{ACCOUNTS_URL}/logout`
- These paths match what the SDK requests when `apiPathPrefix` is set to `/auth/proxy` (SDK appends `/token`, `/me`, `/logout` to the prefix)
- Forward request body, relevant headers (Authorization, Content-Type)
- Return response status + body as-is
- Uses native `fetch()` (Node 18+), no extra dependencies

#### `GET /auth/config` — Public config endpoint
- Returns OAuth config for frontend SDK initialization
- Response: `{ accountsUrl, clientId, redirectUri, postLogoutRedirectUri }`
- No authentication required (frontend needs this before login)

### Modified Files

#### `server/index.js`
- **Mount order matters.** The order must be:
  1. `GET /auth/config` (public, no auth)
  2. `/auth/proxy` routes (proxy, no auth)
  3. Auth middleware on `/api/*` (except `/api/health`)
  4. `/api/*` routes (protected)
  5. Static file serving + `app.get('*')` catch-all (LAST)
- This ensures auth proxy and config are reachable in production (before the SPA catch-all)

### Proxy Design

The SDK defaults `apiPathPrefix` to `/api/proxy`, but we use `/auth/proxy` to avoid collision with our `/api/*` namespace. The SDK config will set `apiPathPrefix: '/auth/proxy'`.

Proxy forwards these headers from client to accounts server:
- `Authorization` (for `/me` and `/logout`)
- `Content-Type` (for `/token` and `/logout`)

Proxy does NOT forward cookies, host, or origin headers. Proxy only forwards to the configured `ACCOUNTS_URL` with hardcoded path suffixes — no dynamic URL construction from user input.

## Frontend Changes

### New Files

#### `client/src/auth.js` — SDK singleton
- Exports async `initAuth()` — fetches config from `GET /auth/config`, creates `YaotoshiAuth` instance
- Exports `getAuth()` — returns the initialized instance (throws if not initialized)
- `apiPathPrefix` set to `/auth/proxy`
- If config fetch fails → `initAuth()` throws, app shows error state with retry

#### `client/src/components/LoginPage.jsx` — Login page
- Simple page with app title and "Login with Yaotoshi" button
- Button calls `auth.login()` which redirects to accounts

#### `client/src/components/AuthCallback.jsx` — OAuth callback handler
- Mounted at `/auth/callback`
- Calls `auth.handleCallback()` on mount
- On success → redirect to `/`
- On error → show error message with retry button

### Modified Files

#### `client/src/App.jsx`
- Add `/auth/callback` route
- On mount, call `initAuth()` — while loading, show a loading spinner/state
- If `initAuth()` fails → show error state with retry button (not stuck forever)
- Once initialized: if `!auth.isAuthenticated()` → render `LoginPage`
- If authenticated → render normal app (Layout + routes)

#### `client/src/api/client.js`
- Add `Authorization: Bearer <token>` header to every request
- Headers must be **merged** (not replaced): `{ 'Content-Type': 'application/json', 'Authorization': \`Bearer ${token}\`, ...options.headers }`
- On 401 response → use a singleton `isRedirecting` flag to prevent multiple concurrent 401s from all triggering redirects simultaneously. First 401 sets the flag, clears storage, and redirects to login. Subsequent 401s are ignored.

#### `client/src/components/Layout.jsx`
- Add logout button in header/navbar
- Logout calls `auth.logout()`

#### `client/vite.config.js`
- Add `/auth` to proxy config alongside existing `/api` and `/socket.io` proxies
- Without this, auth flow is completely broken during development

## SDK Installation

The `@yaotoshi/auth-sdk` package will be installed as a client dependency:
```
npm install @yaotoshi/auth-sdk --workspace=client
```

If the package is not published to npm, it can be installed from the git repo:
```
npm install github:onchainyaotoshi/accounts#main --workspace=client
```

Or the SDK source files (zero dependencies, ~5KB) can be vendored into `client/src/lib/auth-sdk/`.

## Security Considerations

- Token validation cache uses SHA-256 hash of token as key (raw tokens never stored as cache keys)
- Cache TTL of 5 minutes balances security vs performance; periodic sweep every 10 minutes prevents unbounded growth
- Proxy routes use hardcoded path mappings only — no open redirect or dynamic URL construction
- `/auth/config` endpoint only exposes public OAuth config (no secrets)
- Health endpoint remains unauthenticated for monitoring
- CSRF on proxy token endpoint: mitigated by PKCE `code_verifier` requirement — an attacker would need both the authorization code AND the code verifier (stored in sessionStorage) to exchange for a token. The PKCE state parameter protects against authorization code injection, while the verifier protects the token exchange.
- **Known risk:** Tokens stored in localStorage are accessible to any JavaScript on the page (XSS). For this phase, this is accepted. A future enhancement could move token storage to httpOnly cookies via backend proxy.
- **No CORS changes needed:** Current `cors({ origin: false })` is correct since SDK requests go through same-origin proxy routes.

## WebSocket Authentication

**Deferred to future enhancement.** WebSocket connections currently have no authentication. This is an accepted risk for this phase — the WebSocket only broadcasts change notifications (user/group file changed events), not sensitive data. It does NOT broadcast password hashes, shadow data, or PII. A future phase should add token-based WebSocket auth (pass token as query param on connect, validate in `io.on('connection')` handler).

## Testing

- **Auth middleware:** Unit tests with mocked `fetch` to accounts server — test valid token, expired token, missing token, invalid token, cache hit, cache miss
- **Proxy routes:** Unit tests with mocked `fetch` — test forwarding behavior, error handling, header forwarding
- **Local development without accounts server:** Tests mock the fetch calls; manual testing requires a running accounts instance or a lightweight mock server

## Docker Changes

Create a `.env` file (gitignored):
```
ACCOUNTS_URL=https://accounts.example.com
OAUTH_CLIENT_ID=your-client-id
OAUTH_REDIRECT_URI=http://localhost:9998/auth/callback
OAUTH_POST_LOGOUT_REDIRECT_URI=http://localhost:9998
```

Update `docker-compose.yml`:
```yaml
env_file:
  - .env
environment:
  - PORT=9998
  - HOST=0.0.0.0
```

Add `.env` to `.gitignore` and provide a `.env.example` with placeholder values.
