# OAuth Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OAuth 2.0 PKCE authentication via Yaotoshi Accounts so all API endpoints require a valid token.

**Architecture:** Backend Express middleware validates Bearer tokens against the accounts server `/me` endpoint with in-memory caching. Frontend uses `@yaotoshi/auth-sdk` for login/logout flow via proxy routes on the backend. All OAuth config is via environment variables.

**Tech Stack:** Express middleware, native `fetch()`, `@yaotoshi/auth-sdk` (npm), React Router, SHA-256 for cache keys.

**Spec:** `docs/superpowers/specs/2026-03-21-oauth-authentication-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/middleware/auth.js` | Auth middleware — validate Bearer token, cache results |
| Create | `server/routes/authProxy.js` | Proxy `/auth/proxy/*` to accounts server |
| Create | `server/__tests__/auth.test.js` | Tests for auth middleware |
| Create | `server/__tests__/authProxy.test.js` | Tests for proxy routes |
| Create | `client/src/auth.js` | SDK singleton — init, getAuth |
| Create | `client/src/components/LoginPage.jsx` | Login page with button |
| Create | `client/src/components/AuthCallback.jsx` | OAuth callback handler |
| Create | `.env.example` | Example env vars |
| Verify | `.gitignore` | Already exists — verify `.env` is listed |
| Modify | `server/index.js` | Mount auth middleware, proxy, config endpoint |
| Modify | `client/src/api/client.js` | Add Bearer token header, 401 handling |
| Modify | `client/src/App.jsx` | Auth init, loading state, callback route |
| Modify | `client/src/components/Layout.jsx` | Logout button |
| Modify | `client/vite.config.js` | Add `/auth` proxy for dev |
| Modify | `docker-compose.yml` | Add `env_file` |

---

### Task 1: Backend Auth Middleware

**Files:**
- Create: `server/middleware/auth.js`
- Test: `server/__tests__/auth.test.js`

- [ ] **Step 1: Write failing tests for auth middleware**

Create `server/__tests__/auth.test.js`:

```javascript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// We'll test the createAuthMiddleware function directly
// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Dynamically import after setting env
process.env.ACCOUNTS_URL = 'https://accounts.test';

const { createAuthMiddleware } = await import('../middleware/auth.js');

describe('auth middleware', () => {
  let middleware, req, res, next;

  beforeEach(() => {
    middleware = createAuthMiddleware();
    req = { headers: {}, path: '' };
    res = { status: jest.fn(() => res), json: jest.fn() };
    next = jest.fn();
    mockFetch.mockReset();
  });

  it('skips /health (Express strips /api mount prefix)', async () => {
    req.path = '/health';
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header', async () => {
    req.path = '/users';
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    req.path = '/users';
    req.headers.authorization = 'Bearer bad-token';
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next and sets req.user for valid token', async () => {
    req.path = '/users';
    req.headers.authorization = 'Bearer good-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sub: '123', email: 'user@test.com', email_verified: true }),
    });
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ sub: '123', email: 'user@test.com', email_verified: true });
  });

  it('uses cache on second call with same token', async () => {
    req.path = '/users';
    req.headers.authorization = 'Bearer cached-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sub: '456', email: 'cached@test.com', email_verified: true }),
    });
    await middleware(req, res, next);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should use cache
    const req2 = { headers: { authorization: 'Bearer cached-token' }, path: '/users' };
    const res2 = { status: jest.fn(() => res2), json: jest.fn() };
    const next2 = jest.fn();
    await middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1); // no additional fetch
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=auth.test`
Expected: FAIL — `../middleware/auth.js` does not exist

- [ ] **Step 3: Implement auth middleware**

Create `server/middleware/auth.js`:

```javascript
import { createHash } from 'crypto';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthMiddleware() {
  const cache = new Map();

  // Periodic cache cleanup
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now > entry.expiresAt) cache.delete(key);
    }
  }, CLEANUP_INTERVAL);
  cleanupTimer.unref();

  return async (req, res, next) => {
    // Skip health check (Express strips mount prefix, so /api/health becomes /health)
    if (req.path === '/health') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const tokenKey = hashToken(token);

    // Check cache
    const cached = cache.get(tokenKey);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.userInfo;
      return next();
    }

    // Validate against accounts server
    try {
      const response = await fetch(`${ACCOUNTS_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        cache.delete(tokenKey);
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
      }

      const userInfo = await response.json();
      if (!userInfo.sub || !userInfo.email) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid user info' });
      }

      cache.set(tokenKey, { userInfo, expiresAt: Date.now() + CACHE_TTL });
      req.user = userInfo;
      next();
    } catch (err) {
      return res.status(502).json({ error: 'AUTH_UNAVAILABLE', message: 'Authentication service unavailable' });
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=auth.test`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/middleware/auth.js server/__tests__/auth.test.js
git commit -m "feat: add auth middleware with token validation and caching"
```

---

### Task 2: Backend Auth Proxy Routes

**Files:**
- Create: `server/routes/authProxy.js`
- Test: `server/__tests__/authProxy.test.js`

- [ ] **Step 1: Write failing tests for proxy routes**

Create `server/__tests__/authProxy.test.js`:

```javascript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.ACCOUNTS_URL = 'https://accounts.test';

const { default: authProxyRouter } = await import('../routes/authProxy.js');

const app = express();
app.use(express.json());
app.use('/auth/proxy', authProxyRouter);

describe('auth proxy routes', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('POST /auth/proxy/token forwards to accounts /token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, scope: 'openid email' }),
    });

    const res = await request(app).post('/auth/proxy/token').send({ grant_type: 'authorization_code', code: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe('tok');
    expect(mockFetch).toHaveBeenCalledWith('https://accounts.test/token', expect.objectContaining({ method: 'POST' }));
  });

  it('GET /auth/proxy/me forwards to accounts /me', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ sub: '123', email: 'u@t.com' }),
    });

    const res = await request(app).get('/auth/proxy/me').set('Authorization', 'Bearer tok123');
    expect(res.status).toBe(200);
    expect(res.body.sub).toBe('123');
    expect(mockFetch).toHaveBeenCalledWith('https://accounts.test/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
    }));
  });

  it('POST /auth/proxy/logout forwards to accounts /logout', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ message: 'ok' }),
    });

    const res = await request(app).post('/auth/proxy/logout').set('Authorization', 'Bearer tok').send({ token: 'tok' });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith('https://accounts.test/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('returns 502 when accounts server is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app).post('/auth/proxy/token').send({});
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=authProxy.test`
Expected: FAIL — `../routes/authProxy.js` does not exist

- [ ] **Step 3: Implement proxy routes**

Create `server/routes/authProxy.js`:

```javascript
import { Router } from 'express';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL;
const router = Router();

async function proxyRequest(accountsPath, req, res) {
  try {
    const headers = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const options = { method: req.method, headers };
    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(`${ACCOUNTS_URL}${accountsPath}`, options);
    const body = await response.text();

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(response.status).send(body);
  } catch (err) {
    res.status(502).json({ error: 'AUTH_UNAVAILABLE', message: 'Authentication service unavailable' });
  }
}

router.post('/token', (req, res) => proxyRequest('/token', req, res));
router.get('/me', (req, res) => proxyRequest('/me', req, res));
router.post('/logout', (req, res) => proxyRequest('/logout', req, res));

export default router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=authProxy.test`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/authProxy.js server/__tests__/authProxy.test.js
git commit -m "feat: add auth proxy routes for SDK token exchange"
```

---

### Task 3: Mount Auth in server/index.js + Config Endpoint

**Files:**
- Modify: `server/index.js`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create `.env.example`**

```
ACCOUNTS_URL=https://accounts.example.com
OAUTH_CLIENT_ID=your-client-id
OAUTH_REDIRECT_URI=http://localhost:9998/auth/callback
OAUTH_POST_LOGOUT_REDIRECT_URI=http://localhost:9998
```

- [ ] **Step 2: Verify `.gitignore`**

`.gitignore` already exists with `node_modules/`, `client/dist/`, `*.log`, `.env`. No changes needed.

- [ ] **Step 3: Update `server/index.js`**

The full updated file — mount order is critical:
1. `/auth/config` (public)
2. `/auth/proxy` (proxy, no auth)
3. `/api/health` (public)
4. Rate limiters
5. Auth middleware on `/api/*`
6. `/api/*` routes (protected)
7. Static files + SPA catch-all (LAST)

Replace `server/index.js` with:

```javascript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startWatcher } from './watcher.js';
import { createAuthMiddleware } from './middleware/auth.js';
import authProxyRouter from './routes/authProxy.js';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import sudoerRoutes from './routes/sudoers.js';
import sessionRoutes from './routes/sessions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: false } });

app.use(cors({ origin: false }));
app.use(express.json());

// 1. Auth config endpoint (public — frontend needs this before login)
app.get('/auth/config', (req, res) => {
  res.json({
    accountsUrl: process.env.ACCOUNTS_URL,
    clientId: process.env.OAUTH_CLIENT_ID,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
    postLogoutRedirectUri: process.env.OAUTH_POST_LOGOUT_REDIRECT_URI || '',
  });
});

// 2. Auth proxy routes (no auth — SDK uses these for token exchange)
app.use('/auth/proxy', authProxyRouter);

// 3. Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hostname: os.hostname() });
});

// 4. Rate limiters
const passwordLimiter = rateLimit({ windowMs: 60000, max: 10 });
app.use('/api/users/:username/password', passwordLimiter);
const sessionKillLimiter = rateLimit({ windowMs: 60000, max: 10 });
app.use('/api/sessions/:terminal', sessionKillLimiter);

// 5. Auth middleware (protects all /api/* except /api/health)
if (process.env.ACCOUNTS_URL) {
  app.use('/api', createAuthMiddleware());
}

// 6. Protected routes
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sudoers', sudoerRoutes);
app.use('/api/sessions', sessionRoutes);

// 7. Static files + SPA catch-all (LAST)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// WebSocket
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// File watcher
const watchers = startWatcher(io);

// Start server
const PORT = process.env.PORT || 9998;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  watchers.userWatcher.close();
  watchers.groupWatcher.close();
  io.close();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, io, server };
```

Note: Auth middleware is conditionally applied — if `ACCOUNTS_URL` is not set, auth is skipped. This allows running without auth in development when no accounts server is available. **This is a deliberate spec deviation** for developer ergonomics — the spec does not mention a no-auth mode.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS (existing + new auth tests)

- [ ] **Step 5: Commit**

```bash
git add server/index.js .env.example
git commit -m "feat: mount auth middleware, proxy routes, and config endpoint"
```

---

### Task 4: Install SDK + Frontend Auth Module

**Files:**
- Create: `client/src/auth.js`
- Modify: `client/vite.config.js`

- [ ] **Step 1: Install SDK**

```bash
npm install @yaotoshi/auth-sdk --workspace=client
```

- [ ] **Step 2: Add `/auth` proxy to Vite dev config**

Update `client/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:9998',
      '/auth': 'http://localhost:9998',
      '/socket.io': {
        target: 'http://localhost:9998',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 3: Create SDK singleton**

Create `client/src/auth.js`:

```javascript
import { YaotoshiAuth } from '@yaotoshi/auth-sdk';

let authInstance = null;

export async function initAuth() {
  if (authInstance) return authInstance;

  const res = await fetch('/auth/config');
  if (!res.ok) throw new Error('Failed to load auth config');
  const config = await res.json();

  authInstance = new YaotoshiAuth({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri || undefined,
    accountsUrl: config.accountsUrl,
    apiPathPrefix: '/auth/proxy',
  });

  return authInstance;
}

export function getAuth() {
  if (!authInstance) throw new Error('Auth not initialized — call initAuth() first');
  return authInstance;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/auth.js client/vite.config.js client/package.json package-lock.json
git commit -m "feat: install auth SDK and create frontend auth module"
```

---

### Task 5: Login Page + Auth Callback Components

**Files:**
- Create: `client/src/components/LoginPage.jsx`
- Create: `client/src/components/AuthCallback.jsx`

- [ ] **Step 1: Create LoginPage component**

Create `client/src/components/LoginPage.jsx`:

```jsx
import { getAuth } from '../auth.js';

export default function LoginPage() {
  const handleLogin = () => {
    const auth = getAuth();
    auth.login();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
      <h1 style={{ color: 'var(--accent-green, #2ecc71)', fontSize: 24, marginBottom: 8 }}>Server User Management</h1>
      <p style={{ color: 'var(--text-secondary, #888)', marginBottom: 32 }}>Sign in to continue</p>
      <button
        onClick={handleLogin}
        className="primary"
        style={{ padding: '10px 24px', fontSize: 14 }}
      >
        Login with Yaotoshi
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create AuthCallback component**

Create `client/src/components/AuthCallback.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from '../auth.js';

export default function AuthCallback() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      try {
        const auth = getAuth();
        await auth.handleCallback();
        navigate('/', { replace: true });
      } catch (err) {
        setError(err.message);
      }
    };
    handle();
  }, [navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <h2 style={{ color: 'var(--accent-red, #e74c3c)', marginBottom: 16 }}>Authentication Error</h2>
        <p style={{ color: 'var(--text-secondary, #888)', marginBottom: 24 }}>{error}</p>
        <button onClick={() => navigate('/', { replace: true })} className="primary">Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
      <p style={{ color: 'var(--text-secondary, #888)' }}>Authenticating...</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/LoginPage.jsx client/src/components/AuthCallback.jsx
git commit -m "feat: add login page and OAuth callback components"
```

---

### Task 6: Update App.jsx with Auth Flow

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Update App.jsx**

Replace `client/src/App.jsx` with:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { api } from './api/client.js';
import { initAuth, getAuth } from './auth.js';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import UserTable from './components/UserTable.jsx';
import GroupTable from './components/GroupTable.jsx';
import SudoersList from './components/SudoersList.jsx';
import SessionList from './components/SessionList.jsx';
import LoginPage from './components/LoginPage.jsx';
import AuthCallback from './components/AuthCallback.jsx';

function AuthenticatedApp() {
  const { connected, on } = useSocket();
  const [hostname, setHostname] = useState('');
  useEffect(() => { api.getHealth().then(d => setHostname(d.hostname)).catch(() => {}); }, []);

  return (
    <Layout connected={connected} hostname={hostname}>
      <Routes>
        <Route path="/" element={<Navigate to="/users" replace />} />
        <Route path="/users" element={<UserTable socketOn={on} />} />
        <Route path="/groups" element={<GroupTable socketOn={on} />} />
        <Route path="/sudo" element={<SudoersList />} />
        <Route path="/sessions" element={<SessionList />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    initAuth()
      .then(() => setAuthState('ready'))
      .catch(() => setAuthState('error'));
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <p style={{ color: 'var(--text-secondary, #888)' }}>Loading...</p>
      </div>
    );
  }

  if (authState === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <p style={{ color: 'var(--accent-red, #e74c3c)', marginBottom: 16 }}>Failed to load auth configuration</p>
        <button onClick={() => window.location.reload()} className="primary">Retry</button>
      </div>
    );
  }

  const auth = getAuth();
  const authenticated = auth.isAuthenticated();

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={authenticated ? <AuthenticatedApp /> : <LoginPage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: integrate auth flow into App with loading and login states"
```

---

### Task 7: Update API Client with Bearer Token + 401 Handling

**Files:**
- Modify: `client/src/api/client.js`

- [ ] **Step 1: Update API client**

Replace `client/src/api/client.js` with:

```javascript
import { getAuth } from '../auth.js';

const BASE = '/api';

let isRedirecting = false;

function handleUnauthorized() {
  if (isRedirecting) return;
  isRedirecting = true;
  // Don't call auth.logout() — token is already invalid server-side.
  // Just clear local storage and redirect to show login page.
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  window.location.href = '/';
}

async function request(path, options = {}) {
  let token = null;
  try {
    const auth = getAuth();
    token = auth.getAccessToken();
  } catch {
    // Auth not initialized yet (e.g., during config fetch)
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Authentication required');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  getUsers: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/users?${qs}`); },
  getUser: (username) => request(`/users/${username}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  deleteUser: (username, removeHome = false) => request(`/users/${username}?removeHome=${removeHome}`, { method: 'DELETE' }),
  modifyUser: (username, body) => request(`/users/${username}`, { method: 'PATCH', body }),
  changePassword: (username, password) => request(`/users/${username}/password`, { method: 'POST', body: { password } }),
  lockUser: (username, locked) => request(`/users/${username}/lock`, { method: 'POST', body: { locked } }),
  changeAging: (username, body) => request(`/users/${username}/aging`, { method: 'PATCH', body }),
  getGroups: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/groups?${qs}`); },
  createGroup: (body) => request('/groups', { method: 'POST', body }),
  deleteGroup: (name) => request(`/groups/${name}`, { method: 'DELETE' }),
  modifyGroup: (name, body) => request(`/groups/${name}`, { method: 'PATCH', body }),
  addMembers: (groupName, usernames) => request(`/groups/${groupName}/members`, { method: 'POST', body: { usernames } }),
  removeMember: (groupName, username) => request(`/groups/${groupName}/members/${username}`, { method: 'DELETE' }),
  getSudoers: () => request('/sudoers'),
  grantSudo: (body) => request('/sudoers', { method: 'POST', body }),
  modifySudo: (username, rule) => request(`/sudoers/${username}`, { method: 'PATCH', body: { rule } }),
  revokeSudo: (username) => request(`/sudoers/${username}`, { method: 'DELETE' }),
  getSessions: () => request('/sessions'),
  getLogins: (limit = 50) => request(`/sessions/logins?limit=${limit}`),
  killSession: (terminal) => request(`/sessions/${terminal}`, { method: 'DELETE' }),
  getHealth: () => request('/health'),
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/client.js
git commit -m "feat: add Bearer token and 401 redirect to API client"
```

---

### Task 8: Add Logout Button to Layout

**Files:**
- Modify: `client/src/components/Layout.jsx`

- [ ] **Step 1: Update Layout with logout button**

Replace `client/src/components/Layout.jsx` with:

```jsx
import { NavLink } from 'react-router-dom';
import { getAuth } from '../auth.js';
import StatusBar from './StatusBar.jsx';

const navItems = [
  { path: '/users', label: 'Users' },
  { path: '/groups', label: 'Groups' },
  { path: '/sudo', label: 'Sudo' },
  { path: '/sessions', label: 'Sessions' },
];

export default function Layout({ children, connected, hostname }) {
  const handleLogout = () => {
    const auth = getAuth();
    auth.logout();
  };

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent-green)', fontSize: 18 }}>|</span>
          <span style={{ fontWeight: 'bold' }}>Server User Management</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>server: {hostname || '...'}</span>
          <button onClick={handleLogout} style={{ padding: '4px 12px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer' }}>Logout</button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <nav style={{ width: 180, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '12px 0' }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path}
              style={({ isActive }) => ({ display: 'block', padding: '8px 20px', color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)', textDecoration: 'none', borderLeft: isActive ? '3px solid var(--accent-green)' : '3px solid transparent', background: isActive ? 'var(--bg-hover)' : 'transparent', fontSize: 14 })}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</main>
      </div>
      <StatusBar connected={connected} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: add logout button to layout header"
```

---

### Task 9: Update Docker Compose + Final Integration Test

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update docker-compose.yml**

Add `env_file` to docker-compose.yml. The `environment` block keeps `PORT` and `HOST` (non-sensitive), while OAuth vars come from `.env`:

```yaml
services:
  server-user-management:
    build: .
    container_name: server-user-management
    pid: "host"
    privileged: true
    ports:
      - "127.0.0.1:9998:9998"
    volumes:
      - /etc/passwd:/etc/passwd
      - /etc/shadow:/etc/shadow
      - /etc/group:/etc/group
      - /etc/gshadow:/etc/gshadow
      - /etc/login.defs:/etc/login.defs:ro
      - /etc/sudoers:/etc/sudoers
      - /etc/sudoers.d:/etc/sudoers.d
      - /home:/home
      - /var/run/utmp:/var/run/utmp:ro
      - /var/log/wtmp:/var/log/wtmp:ro
    env_file:
      - .env
    environment:
      - PORT=9998
      - HOST=0.0.0.0
    restart: unless-stopped
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests PASS (existing + auth middleware + auth proxy)

- [ ] **Step 3: Build frontend**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add env_file to docker-compose for OAuth config"
```

---

## Post-Implementation Checklist

After all tasks are done:

1. Register an OAuth client at the Yaotoshi Accounts admin panel
2. Create `.env` file with real values
3. Run `sudo docker compose up -d --build`
4. Verify: opening app shows login page
5. Verify: clicking "Login with Yaotoshi" redirects to accounts
6. Verify: after login, redirects back and shows the app
7. Verify: `curl http://localhost:9998/api/users` returns 401
8. Verify: logout button works and returns to login page
