# Full Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 33 issues found in the full security/code audit of SysAccounts

**Architecture:** Fixes are grouped into 5 parallel workstreams: (1) backend input validation, (2) backend security hardening, (3) backend code fixes, (4) frontend fixes, (5) Docker/config fixes

**Tech Stack:** Node.js/Express, React, Docker, Socket.IO

---

### Task 1: Backend Input Validation — Add validation to all route params

**Files:**
- Modify: `server/routes/users.js`
- Modify: `server/routes/groups.js`
- Modify: `server/routes/sudoers.js`
- Modify: `server/routes/sessions.js`
- Modify: `server/validator.js`
- Modify: `server/services/userService.js`

**Issues addressed:** #3 (missing validation on GET/PATCH/DELETE params), #9 (validateShell too permissive), #12 (home not validated), #13 (gecos not sanitized), #14 (aging fields not validated), #15 (getLastLogins limit unbounded), #23 (group rename newName not validated)

- [ ] **Step 1:** Add `validateHome` and `validateGecos` to `server/validator.js`
  - `validateHome`: must start with `/`, only allow `/home/` prefix or common paths, regex `/^\/[a-z0-9/_.-]+$/` and max 255 chars
  - `validateGecos`: disallow colons and newlines, max 255 chars
  - Add `validateAgingField`: must be integer or undefined
  - Update `validateShell` to check against known shells list

- [ ] **Step 2:** Add param validation to all user routes
  - `GET /:username` — validate username
  - `DELETE /:username` — validate username
  - `PATCH /:username` — validate username, home, gecos
  - `POST /:username/password` — validate username, password min length 8
  - `POST /:username/lock` — validate username
  - `PATCH /:username/aging` — validate username, validate aging fields are integers
  - `POST /` — validate home, gecos in addition to existing checks

- [ ] **Step 3:** Add param validation to all group routes
  - `DELETE /:groupname` — validate groupname
  - `PATCH /:groupname` — validate groupname, validate newName with validateGroupname
  - `POST /:groupname/members` — validate groupname, validate each username in array
  - `DELETE /:groupname/members/:username` — validate groupname and username
  - Validate `gid` is positive integer when provided

- [ ] **Step 4:** Add param validation to sudoers routes
  - `PATCH /:username` — validate username
  - `DELETE /:username` — validate username

- [ ] **Step 5:** Cap `getLastLogins` limit to max 500 in sessions route

- [ ] **Step 6:** Run tests `npm test`

- [ ] **Step 7:** Commit

---

### Task 2: Backend Security Hardening

**Files:**
- Modify: `server/index.js`
- Modify: `server/services/sudoService.js`
- Modify: `package.json`

**Issues addressed:** #2 (sudoers rule injection), #10 (no Helmet), #16 (rate limiting gaps), #17 (rate limiter path mismatch), #28 (SPA catch-all serves HTML for API 404)

- [ ] **Step 1:** Install helmet: `npm install helmet`

- [ ] **Step 2:** Add helmet middleware and express.json body limit in `server/index.js`
  ```js
  import helmet from 'helmet';
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  ```

- [ ] **Step 3:** Add API 404 handler before SPA catch-all in `server/index.js`
  ```js
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
  });
  ```

- [ ] **Step 4:** Add global API rate limiter in `server/index.js`
  ```js
  const apiLimiter = rateLimit({ windowMs: 60000, max: 100 });
  app.use('/api', apiLimiter);
  ```
  Remove the broken per-path session kill limiter (it doesn't match wildcard params).

- [ ] **Step 5:** Add sudoers rule validation in `server/services/sudoService.js`
  - Validate rule matches pattern: `ALL=(ALL) ALL`, `ALL=(ALL) NOPASSWD: /path/to/cmd`, etc.
  - Regex: `/^ALL=\([A-Z:, ]+\)\s+(NOPASSWD:\s+)?\/[\w\/,. -]+$/` or similar
  - Reject rules with shell metacharacters

- [ ] **Step 6:** Run tests `npm test`

- [ ] **Step 7:** Commit

---

### Task 3: Backend Code Fixes

**Files:**
- Modify: `server/services/userService.js`
- Modify: `server/index.js`
- Modify: `server/watcher.js`
- Modify: `server/services/sessionService.js`
- Modify: `server/services/sudoService.js`
- Modify: `server/routes/authProxy.js`

**Issues addressed:** #4 (WebSocket no auth), #6 (changePassword bypasses execute()), #11 (port mismatch), #22 (ACCOUNTS_URL at module load), #25-27 (swallowed errors)

- [ ] **Step 1:** Fix `changePassword` to use `execute()` with stdin support
  - Add stdin option to `execute()` function in `executor.js`
  - Refactor `changePassword` to use `execute('chpasswd', [], { stdin: '...' })`

- [ ] **Step 2:** Add WebSocket auth middleware in `server/index.js`
  ```js
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!process.env.ACCOUNTS_URL) return next();
    if (!token) return next(new Error('Authentication required'));
    // validate token...
    next();
  });
  ```

- [ ] **Step 3:** Fix port — change Dockerfile EXPOSE/ENV to use 9995 to match docker-compose default

- [ ] **Step 4:** Fix `ACCOUNTS_URL` in authProxy.js — read from `process.env` at request time, not module load

- [ ] **Step 5:** Add console.error logging to catch blocks in sessionService, sudoService, userService (shadow read) instead of silently swallowing

- [ ] **Step 6:** Run tests `npm test`

- [ ] **Step 7:** Commit

---

### Task 4: Frontend Fixes

**Files:**
- Modify: `client/src/hooks/useSocket.js`
- Modify: `client/src/api/client.js`
- Modify: `client/src/components/UserTable.jsx`
- Modify: `client/src/components/GroupTable.jsx`
- Modify: `client/src/components/SessionList.jsx`
- Modify: `client/src/components/Toast.jsx`

**Issues addressed:** #7 (unstable useSocket.on), #8 (socket ignores search), #18 (URL encoding), #19 (res.json crash), #20 (search debounce), #21 (auth not reactive), #24 (localStorage.clear), #29 (Toast ID collision)

- [ ] **Step 1:** Fix `useSocket.js` — wrap `on` with `useCallback`
  ```js
  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);
  ```

- [ ] **Step 2:** Fix `api/client.js`:
  - Add `encodeURIComponent()` to all URL params
  - Handle non-JSON responses gracefully
  - Replace `localStorage.clear()` with specific key removal

- [ ] **Step 3:** Add search debounce to UserTable and GroupTable (300ms)

- [ ] **Step 4:** Fix socket handler in UserTable/GroupTable — re-fetch from API on socket event instead of using payload directly (respects search/filter)

- [ ] **Step 5:** Fix Toast ID collision — use counter instead of `Date.now()`

- [ ] **Step 6:** Fix SessionList — use ConfirmDialog instead of native `confirm()`

- [ ] **Step 7:** Commit

---

### Task 5: Docker & Config Fixes

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Create: `.dockerignore`

**Issues addressed:** #11 (port mismatch), #30 (.dockerignore), #31 (HEALTHCHECK), #32 (resource limits)

- [ ] **Step 1:** Fix port mismatch — Dockerfile `ENV PORT=9995`, `EXPOSE 9995`

- [ ] **Step 2:** Add `.dockerignore`
  ```
  .git
  .env
  node_modules
  *.md
  docs/
  server/__tests__/
  ```

- [ ] **Step 3:** Add HEALTHCHECK to Dockerfile
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-9995}/api/health || exit 1
  ```

- [ ] **Step 4:** Add resource limits to docker-compose.yml
  ```yaml
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '1.0'
  ```

- [ ] **Step 5:** Commit
