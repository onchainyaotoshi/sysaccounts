# Security Audit PR 1: CRITICAL Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical security vulnerabilities: port mismatch, chpasswd stdin injection, and sudoers regex bypass.

**Architecture:** Direct fixes to existing files. New `validatePassword()` function in validator. Tightened sudoers regex with explicit `..` check. All changes backward-compatible.

**Tech Stack:** Node.js ESM, Jest (--experimental-vm-modules)

**Spec:** `docs/superpowers/specs/2026-03-22-security-audit-design.md` (PR 1 section)

---

## File Map

- Modify: `server/index.js` — fix default port
- Modify: `server/validator.js` — add `validatePassword()`
- Modify: `server/routes/users.js` — use `validatePassword()` in password routes
- Modify: `server/services/sudoService.js` — tighten sudo regex + `..` check
- Modify: `server/__tests__/validator.test.js` — add password validation tests
- Modify: `server/__tests__/sudoService.test.js` — add sudo regex tests

---

### Task 1: Fix default port mismatch

**Files:**
- Modify: `server/index.js:106`

- [ ] **Step 1: Fix the port default**

In `server/index.js`, change line 106:

```javascript
// Before:
const PORT = process.env.PORT || 9998;
// After:
const PORT = process.env.PORT || 9995;
```

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "fix: change default port from 9998 to 9995 to match Docker config"
```

---

### Task 2: Add password validation

**Files:**
- Modify: `server/validator.js` — add `validatePassword()`
- Modify: `server/__tests__/validator.test.js` — add tests
- Modify: `server/routes/users.js` — use `validatePassword()`

- [ ] **Step 1: Write failing tests for validatePassword**

Add to `server/__tests__/validator.test.js`:

```javascript
import { validatePassword } from '../validator.js';

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('securepass123')).toBe(true);
    expect(validatePassword('a'.repeat(1024))).toBe(true);
    expect(validatePassword('p@$$w0rd!')).toBe(true);
  });
  it('rejects passwords with newlines', () => {
    expect(validatePassword('pass\nword')).toBe(false);
    expect(validatePassword('pass\rword')).toBe(false);
    expect(validatePassword('user:pass\nanother:pass')).toBe(false);
  });
  it('rejects passwords with colons', () => {
    expect(validatePassword('user:password')).toBe(false);
  });
  it('rejects passwords too short', () => {
    expect(validatePassword('short')).toBe(false);
    expect(validatePassword('1234567')).toBe(false);
  });
  it('rejects passwords too long', () => {
    expect(validatePassword('a'.repeat(1025))).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(validatePassword(12345678)).toBe(false);
    expect(validatePassword(null)).toBe(false);
    expect(validatePassword(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=validator`
Expected: FAIL — `validatePassword` is not exported

- [ ] **Step 3: Implement validatePassword**

Add to `server/validator.js`:

```javascript
export function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 1024) return false;
  if (/[\n\r:]/.test(password)) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=validator`
Expected: All PASS

- [ ] **Step 5: Update routes to use validatePassword**

In `server/routes/users.js`, add import:

```javascript
import { validateUsername, validateShell, validateRequired, validateHome, validateGecos, validateInteger, validatePassword } from '../validator.js';
```

Replace the password check in `POST /:username/password` (line 95):

```javascript
// Before:
if (!password || password.length < 8) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Password must be at least 8 characters' });
// After:
if (!password || !validatePassword(password)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid password: must be 8-1024 characters, no newlines or colons' });
```

Add password validation in `POST /` (after line 47, before `createUser` call):

```javascript
if (password && !validatePassword(password)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid password: must be 8-1024 characters, no newlines or colons' });
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add server/validator.js server/routes/users.js server/__tests__/validator.test.js
git commit -m "security: add password validation to prevent chpasswd stdin injection"
```

---

### Task 3: Tighten sudoers regex

**Files:**
- Modify: `server/services/sudoService.js:31` — update regex + add `..` check
- Modify: `server/__tests__/sudoService.test.js` — add regex tests

- [ ] **Step 1: Write failing tests for tightened sudo validation**

Add to `server/__tests__/sudoService.test.js`:

```javascript
import { grantSudo } from '../services/sudoService.js';

describe('grantSudo validation', () => {
  it('rejects rules with path traversal', async () => {
    await expect(grantSudo('testuser', 'ALL=(ALL) /usr/../bin/bash')).rejects.toThrow('Invalid sudo rule');
  });
  it('rejects rules with .. in paths', async () => {
    await expect(grantSudo('testuser', 'ALL=(ALL) NOPASSWD: /home/../../etc/shadow')).rejects.toThrow('Invalid sudo rule');
  });
  it('rejects rules with invalid user spec in parens', async () => {
    await expect(grantSudo('testuser', 'ALL=(ALL; rm -rf /) ALL')).rejects.toThrow('Invalid sudo rule');
  });
  it('accepts valid standard rules', async () => {
    // These will fail at the execute/write step since we can't actually write sudoers in test,
    // but they should NOT fail at the validation step.
    // We test validation by checking the error message - validation errors say "Invalid sudo rule format"
    // while execution errors say something else.
    try {
      await grantSudo('testuser', 'ALL=(ALL) ALL');
    } catch (err) {
      expect(err.message).not.toMatch(/Invalid sudo rule/);
    }
    try {
      await grantSudo('testuser', 'ALL=(ALL) NOPASSWD: /usr/bin/apt');
    } catch (err) {
      expect(err.message).not.toMatch(/Invalid sudo rule/);
    }
    try {
      await grantSudo('testuser', 'ALL=(root:wheel) NOPASSWD: /usr/bin/systemctl');
    } catch (err) {
      expect(err.message).not.toMatch(/Invalid sudo rule/);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify path traversal tests fail**

Run: `npm test -- --testPathPattern=sudoService`
Expected: FAIL — path traversal rules are currently accepted by the regex

- [ ] **Step 3: Tighten the regex and add .. check**

In `server/services/sudoService.js`, replace line 31 and update `grantSudo`:

```javascript
const SUDO_RULE_RE = /^ALL=\(([a-z_][a-z0-9_-]*|ALL)(:[a-z_][a-z0-9_-]*|:ALL)?\)\s+(NOPASSWD:\s*)?(ALL|\/[a-z0-9\/_.-]+(\s*,\s*\/[a-z0-9\/_.-]+)*)$/;

export async function grantSudo(username, rule) {
  if (rule.includes('..')) {
    throw new Error('Invalid sudo rule format: path traversal not allowed');
  }
  if (!SUDO_RULE_RE.test(rule)) {
    throw new Error('Invalid sudo rule format. Expected: ALL=(ALL) ALL or ALL=(ALL) NOPASSWD: /path/to/cmd');
  }
  const content = `${username} ${rule}\n`;
  const filePath = `/etc/sudoers.d/${username}`;
  await writeFile(filePath, content, { mode: 0o440 });
  try { await execute('visudo', ['-c', '-f', filePath]); }
  catch (err) { await unlink(filePath); throw new Error(`Invalid sudoers syntax: ${err.message}`); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=sudoService`
Expected: All PASS

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add server/services/sudoService.js server/__tests__/sudoService.test.js
git commit -m "security: tighten sudoers regex and reject path traversal"
```
