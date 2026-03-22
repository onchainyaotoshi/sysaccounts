# Security Audit PR 2: HIGH Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 high-severity security vulnerabilities: error message leakage, missing rate limits on DELETE, groups validation, query param validation, home path traversal, integer range validation.

**Architecture:** Hardening of existing route handlers and validators. No new files. All changes backward-compatible.

**Tech Stack:** Node.js ESM, Express, express-rate-limit, Jest

**Spec:** `docs/superpowers/specs/2026-03-22-security-audit-design.md` (PR 2 section)

**Depends on:** PR 1 must be merged first (uses `validatePassword` from PR 1)

---

## File Map

- Modify: `server/validator.js` — add `..` check to `validateHome()`, add range to `validateInteger()`
- Modify: `server/index.js` — add destructive operation rate limiter
- Modify: `server/routes/users.js` — fix error leakage, add groups validation, clamp limit/offset
- Modify: `server/routes/groups.js` — fix error leakage
- Modify: `server/routes/sudoers.js` — fix error leakage
- Modify: `server/routes/sessions.js` — fix error leakage
- Modify: `server/__tests__/validator.test.js` — add tests for home path and integer range

---

### Task 1: Fix home path traversal and integer range validation

**Files:**
- Modify: `server/validator.js`
- Modify: `server/__tests__/validator.test.js`

- [ ] **Step 1: Write failing tests**

Add to `server/__tests__/validator.test.js`:

```javascript
import { validateHome, validateInteger } from '../validator.js';

describe('validateHome', () => {
  it('accepts valid home paths', () => {
    expect(validateHome('/home/jdoe')).toBe(true);
    expect(validateHome('/var/lib/service')).toBe(true);
  });
  it('rejects path traversal', () => {
    expect(validateHome('/home/../etc/shadow')).toBe(false);
    expect(validateHome('/home/user/../../root')).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(validateHome(123)).toBe(false);
    expect(validateHome(null)).toBe(false);
  });
});

describe('validateInteger with range', () => {
  it('accepts integers within range', () => {
    expect(validateInteger(0, 0, 99999)).toBe(true);
    expect(validateInteger(99999, 0, 99999)).toBe(true);
    expect(validateInteger(500, 0, 99999)).toBe(true);
    expect(validateInteger('42', 0, 99999)).toBe(true);
  });
  it('rejects integers outside range', () => {
    expect(validateInteger(-1, 0, 99999)).toBe(false);
    expect(validateInteger(100000, 0, 99999)).toBe(false);
  });
  it('still works without range (backward compat)', () => {
    expect(validateInteger(42)).toBe(true);
    expect(validateInteger(-5)).toBe(true);
    expect(validateInteger('abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=validator`
Expected: FAIL — `validateHome` accepts `..`, `validateInteger` doesn't support range params

- [ ] **Step 3: Implement fixes**

In `server/validator.js`, update `validateHome`:

```javascript
export function validateHome(home) {
  if (typeof home !== 'string') return false;
  if (home.length > 255) return false;
  if (home.includes('..')) return false;
  return HOME_RE.test(home);
}
```

Update `validateInteger`:

```javascript
export function validateInteger(value, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=validator`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/validator.js server/__tests__/validator.test.js
git commit -m "security: add path traversal check to validateHome and range to validateInteger"
```

---

### Task 2: Add rate limiter for destructive DELETE operations

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add destructive operation rate limiter**

In `server/index.js`, after the existing `passwordLimiter` (line 51), add:

```javascript
const destructiveLimiter = rateLimit({ windowMs: 60000, max: 5, standardHeaders: true, legacyHeaders: false });
app.delete('/api/users/:username', destructiveLimiter);
app.delete('/api/groups/:groupname', destructiveLimiter);
app.delete('/api/sudoers/:username', destructiveLimiter);
app.delete('/api/sessions/:terminal(*)', destructiveLimiter);
```

**Important:** These must go BEFORE the `app.use('/api', createAuthMiddleware())` line and BEFORE the route registrations, because Express processes middleware in order.

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "security: add rate limiting for destructive DELETE operations (5/min)"
```

---

### Task 3: Fix error message leakage in all routes

**Files:**
- Modify: `server/routes/users.js`
- Modify: `server/routes/groups.js`
- Modify: `server/routes/sudoers.js`
- Modify: `server/routes/sessions.js`

- [ ] **Step 1: Fix users.js error responses**

In `server/routes/users.js`, update ALL catch blocks that return status 500. The pattern is:

```javascript
// Before:
res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
// After:
console.error(`${ACTION_NAME} failed:`, err.message);
res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
```

Apply this to EVERY 500 response in the file. Keep the `err.message` in 400/409 responses (those are validation errors and safe to return).

Specifically update these catch blocks:
- `GET /` (line 26): `console.error('List users failed:', err.message);`
- `GET /:username` (line 37): `console.error('Get user detail failed:', err.message);`
- `POST /` (line 56): Keep `err.message` in audit log, but replace in response. Keep 409 response as-is.
- `DELETE /:username` (line 70): `console.error('Delete user failed:', err.message);`
- `PATCH /:username` (line 87): `console.error('Modify user failed:', err.message);`
- `POST /:username/password` (line 102): `console.error('Change password failed:', err.message);`
- `POST /:username/lock` (line 117): `console.error('Lock user failed:', err.message);`
- `PATCH /:username/aging` (line 136): `console.error('Change aging failed:', err.message);`

For the `POST /` handler (create user), special case — keep 409 with detail but fix 500:

```javascript
} catch (err) {
  auditLog('CREATE_USER', username, req.ip, false, err.message);
  if (err.message.includes('already exists')) {
    res.status(409).json({ error: 'USER_EXISTS', message: err.message });
  } else {
    console.error('Create user failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
}
```

- [ ] **Step 2: Fix groups.js error responses**

Same pattern for all catch blocks in `server/routes/groups.js`. Replace every `res.status(500).json({ error: 'COMMAND_FAILED', message: err.message })` with the logged + generic version.

- [ ] **Step 3: Fix sudoers.js error responses**

Same pattern for `server/routes/sudoers.js`. Keep the `SUDOERS_SYNTAX` 400 response as-is (validation error), fix the 500s.

- [ ] **Step 4: Fix sessions.js error responses**

Same pattern for `server/routes/sessions.js`.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add server/routes/users.js server/routes/groups.js server/routes/sudoers.js server/routes/sessions.js
git commit -m "security: replace system error details with generic messages in API responses"
```

---

### Task 4: Add per-item groups validation and clamp query params

**Files:**
- Modify: `server/routes/users.js`

- [ ] **Step 1: Add groups validation in POST /**

In `server/routes/users.js`, in the `POST /` handler, after the `gecos` validation (line 47), add:

```javascript
if (groups) {
  if (!Array.isArray(groups)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'groups must be an array' });
  for (const group of groups) {
    if (!validateGroupname(group)) return res.status(400).json({ error: 'INVALID_INPUT', message: `Invalid group name: ${group}` });
  }
}
```

Add `validateGroupname` to the import:

```javascript
import { validateUsername, validateShell, validateRequired, validateHome, validateGecos, validateInteger, validatePassword, validateGroupname } from '../validator.js';
```

- [ ] **Step 2: Clamp limit/offset in GET /**

In `server/routes/users.js`, update the `GET /` handler. Replace line 14:

```javascript
// Before:
const { system, search, limit = 50, offset = 0 } = req.query;
// After:
const { system, search } = req.query;
const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
```

- [ ] **Step 3: Update aging route to use range-bounded validateInteger**

In `server/routes/users.js`, in the `PATCH /:username/aging` handler, update each aging field validation to include range:

```javascript
// Before:
if (minDays !== undefined && !validateInteger(minDays)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'minDays must be an integer' });
// After:
if (minDays !== undefined && !validateInteger(minDays, 0, 99999)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'minDays must be an integer (0-99999)' });
```

Apply the same pattern to `maxDays`, `warnDays`, and `inactiveDays` (all use range 0-99999).

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/users.js
git commit -m "security: validate groups array per-item, clamp query params, bound aging integers"
```
