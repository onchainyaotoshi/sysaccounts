# Security Audit PR 4: LOW Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 low-severity security vulnerabilities: error status string matching, auth proxy content-type forwarding, and test coverage gaps.

**Architecture:** New `CommandError` class in `server/errors.js`. Service layer uses it for typed errors. Route layer maps error codes to HTTP status. Auth proxy hardcodes JSON content-type. New test cases for validators.

**Tech Stack:** Node.js ESM, Jest

**Spec:** `docs/superpowers/specs/2026-03-22-security-audit-design.md` (PR 4 section)

**Depends on:** PR 3 must be merged first

---

## File Map

- Create: `server/errors.js` — `CommandError` class
- Modify: `server/services/userService.js` — throw `CommandError` with codes
- Modify: `server/services/groupService.js` — throw `CommandError` with codes
- Modify: `server/services/sudoService.js` — throw `CommandError` with codes
- Modify: `server/routes/users.js` — use `err.code` instead of string matching
- Modify: `server/routes/groups.js` — use `err.code`
- Modify: `server/routes/sudoers.js` — use `err.code`
- Modify: `server/routes/authProxy.js` — hardcode JSON content-type
- Modify: `server/__tests__/validator.test.js` — add negative test cases

---

### Task 1: Create CommandError class

**Files:**
- Create: `server/errors.js`

- [ ] **Step 1: Create the CommandError class**

Create `server/errors.js`:

```javascript
export class CommandError extends Error {
  constructor(message, code = 'COMMAND_FAILED') {
    super(message);
    this.name = 'CommandError';
    this.code = code;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/errors.js
git commit -m "feat: add CommandError class for typed error handling"
```

---

### Task 2: Use CommandError in service layer

**Files:**
- Modify: `server/services/userService.js`
- Modify: `server/services/groupService.js`
- Modify: `server/services/sudoService.js`

- [ ] **Step 1: Update userService.js**

In `server/services/userService.js`, add import:

```javascript
import { CommandError } from '../errors.js';
```

Update `createUser` to catch and re-throw with code:

```javascript
export async function createUser({ username, password, shell, home, gecos, groups, createHome }) {
  const args = [];
  if (shell) args.push('-s', shell);
  if (home) args.push('-d', home);
  if (gecos) args.push('-c', gecos);
  if (createHome) args.push('-m');
  if (groups && groups.length > 0) args.push('-G', groups.join(','));
  args.push(username);
  try {
    await execute('useradd', args);
  } catch (err) {
    if (err.message.includes('already exists')) {
      throw new CommandError(err.message, 'USER_EXISTS');
    }
    throw new CommandError(err.message);
  }
  if (password) {
    await changePassword(username, password);
  }
}

export async function deleteUser(username, removeHome = false) {
  const args = removeHome ? ['-r', username] : [username];
  try {
    await execute('userdel', args);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      throw new CommandError(err.message, 'USER_NOT_FOUND');
    }
    throw new CommandError(err.message);
  }
}
```

Other functions (`modifyUser`, `lockUser`, `changePassword`, `changeAging`) just re-throw as `CommandError`:

```javascript
// Wrap each existing execute call in try/catch:
try {
  await execute(...);
} catch (err) {
  throw new CommandError(err.message);
}
```

- [ ] **Step 2: Update groupService.js**

In `server/services/groupService.js`, add import and wrap execute calls:

```javascript
import { CommandError } from '../errors.js';
```

Update `createGroup`:
```javascript
export async function createGroup(name, gid) {
  const args = gid !== undefined ? ['-g', String(gid), name] : [name];
  try {
    await execute('groupadd', args);
  } catch (err) {
    if (err.message.includes('already exists')) {
      throw new CommandError(err.message, 'GROUP_EXISTS');
    }
    throw new CommandError(err.message);
  }
}
```

Update `deleteGroup`:
```javascript
export async function deleteGroup(name) {
  try {
    await execute('groupdel', [name]);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      throw new CommandError(err.message, 'GROUP_NOT_FOUND');
    }
    throw new CommandError(err.message);
  }
}
```

Other functions (`modifyGroup`, `addMember`, `removeMember`) wrap in `CommandError`:

```javascript
try { await execute(...); } catch (err) { throw new CommandError(err.message); }
```

- [ ] **Step 3: Update sudoService.js**

In `server/services/sudoService.js`, add import:

```javascript
import { CommandError } from '../errors.js';
```

Update `grantSudo` error throws:

```javascript
// The validation errors already throw Error — change to CommandError:
if (rule.includes('..')) {
  throw new CommandError('Path traversal not allowed in sudo rules', 'INVALID_SUDO_RULE');
}
if (!SUDO_RULE_RE.test(rule)) {
  throw new CommandError('Invalid sudo rule format. Expected: ALL=(ALL) ALL or ALL=(ALL) NOPASSWD: /path/to/cmd', 'INVALID_SUDO_RULE');
}
// ... and in the catch block:
catch (err) { await unlink(filePath); throw new CommandError(`Invalid sudoers syntax: ${err.message}`, 'SUDOERS_SYNTAX'); }
```

- [ ] **Step 4: Commit**

```bash
git add server/services/userService.js server/services/groupService.js server/services/sudoService.js server/errors.js
git commit -m "refactor: use CommandError with typed codes in service layer"
```

---

### Task 3: Update routes to use error codes

**Files:**
- Modify: `server/routes/users.js`
- Modify: `server/routes/groups.js`
- Modify: `server/routes/sudoers.js`

- [ ] **Step 1: Update users.js**

In `server/routes/users.js`, import CommandError:

```javascript
import { CommandError } from '../errors.js';
```

Update the `POST /` catch block (create user):

```javascript
} catch (err) {
  auditLog('CREATE_USER', username, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
  if (err.code === 'USER_EXISTS') {
    res.status(409).json({ error: 'USER_EXISTS', message: err.message });
  } else {
    console.error('Create user failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
}
```

- [ ] **Step 2: Update groups.js**

In `server/routes/groups.js`, update create group catch:

```javascript
} catch (err) {
  auditLog('CREATE_GROUP', name, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
  if (err.code === 'GROUP_EXISTS') {
    res.status(409).json({ error: 'GROUP_EXISTS', message: err.message });
  } else {
    console.error('Create group failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
}
```

- [ ] **Step 3: Update sudoers.js**

In `server/routes/sudoers.js`, update grant sudo catch:

```javascript
} catch (err) {
  auditLog('GRANT_SUDO', username, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
  if (err.code === 'INVALID_SUDO_RULE' || err.code === 'SUDOERS_SYNTAX') {
    res.status(400).json({ error: err.code, message: err.message });
  } else {
    console.error('Grant sudo failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/users.js server/routes/groups.js server/routes/sudoers.js
git commit -m "refactor: use error codes instead of string matching in route handlers"
```

---

### Task 4: Hardcode JSON content-type in auth proxy

**Files:**
- Modify: `server/routes/authProxy.js`

- [ ] **Step 1: Hardcode content-type**

In `server/routes/authProxy.js`, replace lines 23-24:

```javascript
// Before:
const contentType = response.headers.get('content-type');
if (contentType) res.setHeader('Content-Type', contentType);
// After:
res.setHeader('Content-Type', 'application/json');
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --testPathPattern=authProxy`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/routes/authProxy.js
git commit -m "security: hardcode JSON content-type in auth proxy response"
```

---

### Task 5: Add test coverage for validators and CommandError

**Files:**
- Modify: `server/__tests__/validator.test.js`

- [ ] **Step 1: Add negative test cases for existing validators**

Add to `server/__tests__/validator.test.js`:

```javascript
import { validateGecos, validateRequired } from '../validator.js';

describe('validateUsername edge cases', () => {
  it('rejects null and undefined', () => {
    expect(validateUsername(null)).toBe(false);
    expect(validateUsername(undefined)).toBe(false);
  });
  it('rejects objects and numbers', () => {
    expect(validateUsername({})).toBe(false);
    expect(validateUsername(42)).toBe(false);
  });
});

describe('validateHome edge cases', () => {
  it('rejects strings over 255 chars', () => {
    expect(validateHome('/' + 'a'.repeat(256))).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateHome('')).toBe(false);
  });
  it('rejects relative paths', () => {
    expect(validateHome('home/user')).toBe(false);
  });
});

describe('validateGecos', () => {
  it('accepts valid GECOS', () => {
    expect(validateGecos('John Doe')).toBe(true);
    expect(validateGecos('User, Room 123, x1234')).toBe(true);
  });
  it('rejects GECOS with colon', () => {
    expect(validateGecos('user:info')).toBe(false);
  });
  it('rejects GECOS with newline', () => {
    expect(validateGecos('user\ninfo')).toBe(false);
  });
  it('rejects GECOS over 255 chars', () => {
    expect(validateGecos('a'.repeat(256))).toBe(false);
  });
  it('rejects non-string', () => {
    expect(validateGecos(123)).toBe(false);
    expect(validateGecos(null)).toBe(false);
  });
});

describe('validateRequired', () => {
  it('returns null when all fields present', () => {
    expect(validateRequired({ a: 'x', b: 'y' }, ['a', 'b'])).toBeNull();
  });
  it('returns missing fields message', () => {
    expect(validateRequired({ a: 'x' }, ['a', 'b'])).toContain('b');
  });
  it('rejects empty string values', () => {
    expect(validateRequired({ a: '' }, ['a'])).toContain('a');
  });
  it('rejects null values', () => {
    expect(validateRequired({ a: null }, ['a'])).toContain('a');
  });
});
```

- [ ] **Step 2: Add CommandError tests**

Create or add to test file. Add to `server/__tests__/validator.test.js` (or create a separate file — adding here for simplicity):

```javascript
import { CommandError } from '../errors.js';

describe('CommandError', () => {
  it('creates error with default code', () => {
    const err = new CommandError('something failed');
    expect(err.message).toBe('something failed');
    expect(err.code).toBe('COMMAND_FAILED');
    expect(err.name).toBe('CommandError');
    expect(err instanceof Error).toBe(true);
  });
  it('creates error with custom code', () => {
    const err = new CommandError('user exists', 'USER_EXISTS');
    expect(err.message).toBe('user exists');
    expect(err.code).toBe('USER_EXISTS');
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/validator.test.js
git commit -m "test: add negative test cases for validators and CommandError"
```
