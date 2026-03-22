# Security Audit PR 3: MEDIUM Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 medium-severity security vulnerabilities: hostname leak, socket auth, GID range, audit user identity, watcher data broadcast, auth module-load URL, password validation in routes, HSTS header.

**Architecture:** Hardening of existing files. No new files or dependencies. Frontend socket hook gets auth token support.

**Tech Stack:** Node.js ESM, Express, Socket.IO, React, Helmet, Jest

**Spec:** `docs/superpowers/specs/2026-03-22-security-audit-design.md` (PR 3 section)

**Depends on:** PR 2 must be merged first (uses updated `validateInteger` with range)

---

## File Map

- Modify: `server/index.js` — remove hostname from health, enable HSTS
- Modify: `server/middleware/auth.js` — read ACCOUNTS_URL at runtime
- Modify: `server/logger.js` — add user parameter
- Modify: `server/watcher.js` — notification-only broadcast
- Modify: `server/routes/users.js` — pass user to audit, use validatePassword in create
- Modify: `server/routes/groups.js` — pass user to audit, GID range validation
- Modify: `server/routes/sudoers.js` — pass user to audit
- Modify: `client/src/hooks/useSocket.js` — send auth token

---

### Task 1: Remove hostname from health check and enable HSTS

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Fix health check**

In `server/index.js`, update line 44:

```javascript
// Before:
res.json({ status: 'ok', hostname: os.hostname() });
// After:
res.json({ status: 'ok' });
```

Remove the `os` import from line 6 if no longer used elsewhere. Check first — `os` is only used for `os.hostname()` in the health check. Remove the import:

```javascript
// Remove this line:
import os from 'os';
```

- [ ] **Step 2: Enable HSTS in helmet**

In `server/index.js`, update line 25:

```javascript
// Before:
app.use(helmet({ contentSecurityPolicy: false }));
// After:
app.use(helmet({ contentSecurityPolicy: false, hsts: { maxAge: 31536000, includeSubDomains: true } }));
```

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "security: remove hostname from health check and enable HSTS"
```

---

### Task 2: Fix auth middleware to read ACCOUNTS_URL at runtime

**Files:**
- Modify: `server/middleware/auth.js`

- [ ] **Step 1: Move ACCOUNTS_URL read into middleware**

In `server/middleware/auth.js`, remove line 3:

```javascript
// Remove this line:
const ACCOUNTS_URL = process.env.ACCOUNTS_URL;
```

Then inside the middleware function (line 40), change the fetch call:

```javascript
// Before:
const response = await fetch(`${ACCOUNTS_URL}/me`, {
// After:
const response = await fetch(`${process.env.ACCOUNTS_URL}/me`, {
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --testPathPattern=auth`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/middleware/auth.js
git commit -m "security: read ACCOUNTS_URL at request time, not module load"
```

---

### Task 3: Add user identity to audit logs

**Files:**
- Modify: `server/logger.js`
- Modify: `server/routes/users.js`
- Modify: `server/routes/groups.js`
- Modify: `server/routes/sudoers.js`

- [ ] **Step 1: Update auditLog signature**

In `server/logger.js`, update the function:

```javascript
export function auditLog(action, target, ip, success, detail = '', user = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    action, target, ip, success,
    ...(user && { user }),
    ...(detail && { detail }),
  };
  console.log(JSON.stringify(entry));
}
```

- [ ] **Step 2: Update all callers in users.js**

In `server/routes/users.js`, update every `auditLog` call to include user identity. The pattern:

```javascript
// Before:
auditLog('CREATE_USER', username, req.ip, true);
// After:
auditLog('CREATE_USER', username, req.ip, true, '', req.user?.email || req.user?.sub || 'anonymous');
```

For calls that already have a `detail` parameter (error cases):

```javascript
// Before:
auditLog('CREATE_USER', username, req.ip, false, err.message);
// After:
auditLog('CREATE_USER', username, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
```

Apply to ALL auditLog calls in the file.

- [ ] **Step 3: Update all callers in groups.js**

Same pattern for `server/routes/groups.js`.

- [ ] **Step 4: Update all callers in sudoers.js**

Same pattern for `server/routes/sudoers.js`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add server/logger.js server/routes/users.js server/routes/groups.js server/routes/sudoers.js
git commit -m "security: include authenticated user identity in audit logs"
```

---

### Task 4: Change watcher to notification-only broadcast

**Files:**
- Modify: `server/watcher.js`

- [ ] **Step 1: Remove data payload from broadcasts**

In `server/watcher.js`, update the user watcher callback (line 17):

```javascript
// Before:
try { const users = await listUsers(); io.emit('users:changed', { type: 'users', data: users }); }
// After:
try { io.emit('users:changed'); }
```

Update the group watcher callback (line 25):

```javascript
// Before:
try { const groups = await listGroups(); io.emit('groups:changed', { type: 'groups', data: groups }); }
// After:
try { io.emit('groups:changed'); }
```

Remove unused imports:

```javascript
// Before:
import { listUsers } from './services/userService.js';
import { listGroups } from './services/groupService.js';
// After:
// (remove both imports entirely)
```

- [ ] **Step 2: Commit**

```bash
git add server/watcher.js
git commit -m "security: broadcast notification-only events without data payload"
```

---

### Task 5: Add GID range validation

**Files:**
- Modify: `server/routes/groups.js`

- [ ] **Step 1: Update GID validation to use range**

In `server/routes/groups.js`, update the GID validation in `PATCH /:groupname` (line 42):

```javascript
// Before:
if (gid !== undefined && (!Number.isInteger(Number(gid)) || Number(gid) < 0)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'gid must be a positive integer' });
// After:
if (gid !== undefined && !validateInteger(gid, 0, 65535)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'gid must be an integer between 0 and 65535' });
```

Add `validateInteger` to the import:

```javascript
import { validateGroupname, validateUsername, validateInteger } from '../validator.js';
```

Do the same for `POST /` — add GID validation before `createGroup` call:

```javascript
if (gid !== undefined && !validateInteger(gid, 0, 65535)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'gid must be an integer between 0 and 65535' });
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/groups.js
git commit -m "security: add GID range validation (0-65535)"
```

---

### Task 6: Use validatePassword in user creation route

**Files:**
- Modify: `server/routes/users.js`

- [ ] **Step 1: Add password validation to POST / (create user)**

In `server/routes/users.js`, the `POST /` handler should already have `validatePassword` imported (from PR 1). Verify the validation line added in PR 1 exists after gecos validation:

```javascript
if (password && !validatePassword(password)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid password: must be 8-1024 characters, no newlines or colons' });
```

If already present from PR 1, this task is a verification step only. If not, add it.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 3: Commit (only if changes were needed)**

```bash
git add server/routes/users.js
git commit -m "security: ensure password validation in user creation route"
```

---

### Task 7: Send auth token in Socket.IO client

**Files:**
- Modify: `client/src/hooks/useSocket.js`

- [ ] **Step 1: Update socket connection to include auth token**

In `client/src/hooks/useSocket.js`, update imports and the socket creation:

```javascript
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAuth } from '../auth.js';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let token = null;
    try {
      const auth = getAuth();
      token = auth.getAccessToken();
    } catch {
      // Auth not initialized yet
    }

    const socket = io({
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => socket.disconnect();
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { connected, on };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useSocket.js
git commit -m "security: send auth token in Socket.IO client connection"
```
