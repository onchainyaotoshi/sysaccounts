# Security Audit Full Fixes — Design Spec

## Goal

Fix all 20 security vulnerabilities found during a full security audit of SysAccounts. Fixes are delivered as 4 separate PRs ordered by severity: CRITICAL, HIGH, MEDIUM, LOW.

## Target

Harden the application for production deployment. All fixes are backward-compatible — no API contract changes, no new dependencies.

## PR Strategy

4 PRs, merged in order:
1. **PR 1: CRITICAL** — 3 fixes (port mismatch, chpasswd injection, sudoers regex)
2. **PR 2: HIGH** — 6 fixes (error leakage, rate limiting, input validation gaps)
3. **PR 3: MEDIUM** — 8 fixes (info disclosure, auth hardening, audit logging)
4. **PR 4: LOW** — 3 fixes (error handling, proxy hardening, test coverage)

---

## PR 1: CRITICAL Fixes

### Fix 1: Port mismatch

**File:** `server/index.js:106`
**Issue:** Default port is `9998`, but Dockerfile and docker-compose both use `9995`.
**Fix:** Change `const PORT = process.env.PORT || 9998` to `const PORT = process.env.PORT || 9995`.

### Fix 2: chpasswd stdin injection

**Files:** `server/validator.js` (new function), `server/routes/users.js` (add validation)
**Issue:** Password containing newline (`\n`) or colon (`:`) can inject additional user:password pairs via chpasswd stdin.
**Fix:**
- Add `validatePassword(password)` to `server/validator.js`: reject newline (`\n`, `\r`), colon (`:`), enforce min 8 chars and max 1024 chars
- Add validation in `POST /api/users` route (when password provided) and `POST /:username/password` route using `validatePassword()`

### Fix 3: Sudoers regex too permissive

**File:** `server/services/sudoService.js:31`
**Issue:** Regex allows `..` in paths and doesn't validate user/group spec in parentheses.
**Fix:**
- Add explicit `if (rule.includes('..')) throw` check before regex
- Tighten regex: validate user/group spec inside parentheses matches valid username/group format
- Updated regex: `/^ALL=\(([a-z_][a-z0-9_-]*|ALL)(:[a-z_][a-z0-9_-]*|:ALL)?\)\s+(NOPASSWD:\s*)?(ALL|\/[a-z0-9\/_.-]+(\s*,\s*\/[a-z0-9\/_.-]+)*)$/`

---

## PR 2: HIGH Fixes

### Fix 4: Error messages expose system details

**Files:** All route files (`server/routes/users.js`, `groups.js`, `sudoers.js`, `sessions.js`)
**Issue:** `err.message` from system commands returned to clients in 500 responses.
**Fix:**
- Replace `err.message` in 500 responses with generic `"Command failed"`
- Add `console.error` logging before sending response
- Keep `err.message` in 400/409 responses (input validation errors are safe to return)

### Fix 5: Rate limit DELETE operations

**File:** `server/index.js`
**Issue:** No rate limiting on destructive DELETE endpoints.
**Fix:** Add `destructiveLimiter` rate limiter (5 req/min) applied to:
- `DELETE /api/users/:username`
- `DELETE /api/groups/:groupname`
- `DELETE /api/sudoers/:username`
- `DELETE /api/sessions/:terminal`

Implementation: single rate limiter middleware applied via method-checking wrapper before protected routes.

### Fix 6: Groups array not validated per-item

**File:** `server/routes/users.js` (POST `/` handler)
**Issue:** `groups` array passed to `createUser()` without validating each group name.
**Fix:** Loop through `groups` array and validate each with `validateGroupname()` before calling service.

### Fix 7: Query limit/offset without range validation

**File:** `server/routes/users.js` (GET `/` handler)
**Issue:** `limit` and `offset` query params not clamped to safe ranges.
**Fix:**
- Parse with `parseInt(..., 10)`, fallback to defaults if NaN
- Clamp `limit` to 1–500, `offset` to min 0

### Fix 8: Home path regex allows `..`

**File:** `server/validator.js`
**Issue:** `HOME_RE` regex doesn't prevent `..` path traversal.
**Fix:** Add `if (home.includes('..')) return false` check in `validateHome()`.

### Fix 9: Integer validator without range check

**File:** `server/validator.js`
**Issue:** `validateInteger()` only checks if value is integer, no range bounds.
**Fix:**
- Add optional `min`/`max` parameters: `validateInteger(value, min, max)`
- Update aging route callers to pass range (0–99999)
- Backward compatible: existing callers without min/max still work

---

## PR 3: MEDIUM Fixes

### Fix 10: Health check exposes hostname

**File:** `server/index.js:44`
**Issue:** `/api/health` returns `os.hostname()`.
**Fix:** Remove `hostname` from response. Return only `{ status: 'ok' }`.

### Fix 11: Socket client doesn't send auth token

**File:** `client/src/hooks/useSocket.js:9`
**Issue:** Socket.IO client connects without auth token.
**Fix:** Add `auth` option to `io()` call that passes the current access token from the auth SDK.

### Fix 12: GID without range validation

**File:** `server/routes/groups.js:42`
**Issue:** GID validation only checks integer >= 0, no upper bound.
**Fix:** Use `validateInteger(gid, 0, 65535)` (leveraging the updated validator from PR 2).

### Fix 13: Audit log missing user identity

**File:** `server/logger.js`, all route files
**Issue:** Audit logs don't include the authenticated user who performed the action.
**Fix:**
- Add `user` parameter to `auditLog()` function
- Update all callers in route files to pass `req.user?.email || req.user?.sub || 'anonymous'`

### Fix 14: Watcher broadcasts full data payload

**File:** `server/watcher.js`
**Issue:** File change events broadcast full user/group list to all clients.
**Fix:** Change to notification-only: `io.emit('users:changed')` and `io.emit('groups:changed')` without data payload. Frontend already refetches via API after receiving the event.

### Fix 15: Auth middleware reads ACCOUNTS_URL at module load

**File:** `server/middleware/auth.js:3`
**Issue:** `const ACCOUNTS_URL = process.env.ACCOUNTS_URL` is evaluated once at import time.
**Fix:** Move to inside the middleware function: `const accountsUrl = process.env.ACCOUNTS_URL` read on each request.

### Fix 16: Password max length and newline validation in route

**File:** `server/routes/users.js`
**Issue:** Password route only checks min 8 chars, no max or character restriction.
**Fix:** Use `validatePassword()` (added in PR 1) in both password-related routes. This replaces the inline `password.length < 8` check.

### Fix 17: HSTS header not configured

**File:** `server/index.js:25`
**Issue:** Helmet doesn't configure HSTS.
**Fix:** Add `hsts: { maxAge: 31536000, includeSubDomains: true }` to helmet config.

---

## PR 4: LOW Fixes

### Fix 18: Error status via string matching

**Files:** New `server/errors.js`, `server/services/userService.js`, `server/services/groupService.js`, `server/services/sudoService.js`, route files
**Issue:** HTTP status codes determined by matching error message strings (e.g. `err.message.includes('already exists')`).
**Fix:**
- Create `CommandError` class extending `Error` with `code` property
- Service layer throws `CommandError` with codes like `USER_EXISTS`, `GROUP_NOT_FOUND`
- Route layer maps `err.code` to HTTP status without string matching

### Fix 19: Auth proxy forwards content-type unfiltered

**File:** `server/routes/authProxy.js:24`
**Issue:** Content-Type from auth server forwarded without validation.
**Fix:** Hardcode response content-type to `application/json` since all auth endpoints return JSON.

### Fix 20: Test coverage gaps

**File:** `server/__tests__/` (new and existing test files)
**Issue:** Missing negative test cases for validators and new functionality.
**Fix:**
- Add negative validator tests: long strings, special chars, `..` in paths, newlines/colons in password
- Add tests for `CommandError` class
- Add tests for `validatePassword()` function

---

## Files Changed Summary

| File | PRs |
|------|-----|
| `server/index.js` | 1, 2, 3 |
| `server/validator.js` | 1, 2 |
| `server/services/sudoService.js` | 1 |
| `server/services/userService.js` | 4 |
| `server/services/groupService.js` | 4 |
| `server/routes/users.js` | 2, 3 |
| `server/routes/groups.js` | 2, 3 |
| `server/routes/sudoers.js` | 2, 3 |
| `server/routes/sessions.js` | 2, 3 |
| `server/routes/authProxy.js` | 4 |
| `server/middleware/auth.js` | 3 |
| `server/logger.js` | 3 |
| `server/watcher.js` | 3 |
| `server/errors.js` (new) | 4 |
| `client/src/hooks/useSocket.js` | 3 |
| `server/__tests__/*.test.js` | 4 |

## Out of Scope

- No new dependencies
- No API contract changes (same endpoints, same response shapes for success cases)
- No frontend UI changes (except socket auth token)
- No Docker config changes
- Token storage in localStorage (requires SDK changes, out of scope)
- Secrets rotation documentation (operational concern, not code)
