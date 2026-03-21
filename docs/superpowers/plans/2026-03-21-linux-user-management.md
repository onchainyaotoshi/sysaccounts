# Linux Server User Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based Linux user management tool with terminal-themed React frontend and Node.js backend that manages users, groups, sudo, and sessions via real-time WebSocket updates.

**Architecture:** Express + socket.io backend executes Linux commands (via `execFile` or `nsenter` in Docker) and parses system files. React frontend connects via REST + WebSocket. `chokidar` watches system files for changes and broadcasts updates.

**Tech Stack:** Node.js, Express, socket.io, chokidar, React, Vite, CSS (terminal theme)

**Spec:** `docs/superpowers/specs/2026-03-21-linux-user-management-design.md`

---

## File Map

### Server
| File | Responsibility |
|------|---------------|
| `package.json` | Root: server deps, `"type": "module"`, workspace config |
| `server/index.js` | Express + socket.io setup, CORS, static serving, graceful shutdown |
| `server/services/executor.js` | Docker-aware command execution (nsenter vs direct execFile) |
| `server/validator.js` | Input validation: username, groupname, paths |
| `server/logger.js` | Audit logging to stdout |
| `server/services/userService.js` | Parse /etc/passwd + /etc/shadow, user CRUD commands |
| `server/services/groupService.js` | Parse /etc/group, group CRUD commands |
| `server/services/sudoService.js` | Parse /etc/sudoers + sudoers.d, manage sudo rules |
| `server/services/sessionService.js` | Parse who, w, last output |
| `server/routes/users.js` | User REST endpoints |
| `server/routes/groups.js` | Group REST endpoints |
| `server/routes/sudoers.js` | Sudoers REST endpoints |
| `server/routes/sessions.js` | Session/login REST endpoints |
| `server/watcher.js` | chokidar file watcher, emits socket.io events |

### Client
| File | Responsibility |
|------|---------------|
| `client/package.json` | React/Vite deps |
| `client/vite.config.js` | Vite config with API proxy |
| `client/index.html` | HTML entry point |
| `client/src/main.jsx` | React entry, render App |
| `client/src/App.jsx` | Router, socket provider, layout |
| `client/src/theme/global.css` | Terminal dark theme: colors, fonts, base styles |
| `client/src/api/client.js` | Fetch wrapper with error handling |
| `client/src/hooks/useSocket.js` | socket.io connection + event hook |
| `client/src/components/Layout.jsx` | Sidebar + header + status bar + main content |
| `client/src/components/StatusBar.jsx` | Bottom bar: connection status, hostname |
| `client/src/components/Toast.jsx` | Toast notification component |
| `client/src/components/ConfirmDialog.jsx` | Confirmation modal for destructive actions |
| `client/src/components/UserTable.jsx` | Users list table with system user toggle |
| `client/src/components/UserDetail.jsx` | Single user view: info, groups, sudo, aging |
| `client/src/components/UserForm.jsx` | Create/edit user modal |
| `client/src/components/GroupTable.jsx` | Groups list table |
| `client/src/components/GroupDetail.jsx` | Single group: members, add/remove |
| `client/src/components/GroupForm.jsx` | Create/edit group modal |
| `client/src/components/SudoersList.jsx` | Sudo rules list, grant/revoke/edit |
| `client/src/components/SessionList.jsx` | Active sessions + recent logins |

### Docker
| File | Responsibility |
|------|---------------|
| `Dockerfile` | Multi-stage: build React, run Node.js |
| `docker-compose.yml` | Volume mounts, pid:host, port binding |

### Tests
| File | Responsibility |
|------|---------------|
| `server/__tests__/validator.test.js` | Input validation tests |
| `server/__tests__/executor.test.js` | Command executor tests |
| `server/__tests__/userService.test.js` | User service parsing/command tests |
| `server/__tests__/groupService.test.js` | Group service tests |
| `server/__tests__/sudoService.test.js` | Sudo service tests |
| `server/__tests__/sessionService.test.js` | Session service tests |
| `server/__tests__/routes/users.test.js` | User routes integration tests |
| `server/__tests__/routes/groups.test.js` | Group routes integration tests |
| `server/__tests__/routes/sudoers.test.js` | Sudoers routes integration tests |
| `server/__tests__/routes/sessions.test.js` | Session routes integration tests |

---

## Task 1: Project Scaffolding & Core Infrastructure

**Files:**
- Create: `package.json`
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `server/index.js`

- [ ] **Step 1: Initialize root package.json**

```json
{
  "name": "server-user-management",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "node server/index.js",
    "dev:client": "npm run dev --workspace=client",
    "build": "npm run build --workspace=client",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "start": "NODE_ENV=production node server/index.js"
  },
  "workspaces": ["client"],
  "dependencies": {
    "express": "^4.21.0",
    "socket.io": "^4.7.0",
    "chokidar": "^3.6.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.4.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@jest/globals": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Initialize client package.json**

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create client/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:9998',
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

- [ ] **Step 4: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Server User Management</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create client/src/main.jsx and App.jsx**

`client/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './theme/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`client/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/users" replace />} />
          <Route path="/users" element={<div>Users</div>} />
          <Route path="/groups" element={<div>Groups</div>} />
          <Route path="/sudo" element={<div>Sudo</div>} />
          <Route path="/sessions" element={<div>Sessions</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Create server/index.js**

```js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: false },
});

app.use(cors({ origin: false }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hostname: (await import('os')).hostname() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 9998;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  io.close();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, io, server };
```

- [ ] **Step 7: Install dependencies and verify startup**

Run: `npm install && npm run build && timeout 3 npm start || true`
Expected: server starts on 127.0.0.1:9998

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json client/ server/index.js
git commit -m "feat: project scaffolding with Express, socket.io, React, Vite"
```

---

## Task 2: Validator, Logger & Executor

**Files:**
- Create: `server/validator.js`
- Create: `server/logger.js`
- Create: `server/services/executor.js`
- Create: `server/__tests__/validator.test.js`
- Create: `server/__tests__/executor.test.js`

- [ ] **Step 1: Write validator tests**

`server/__tests__/validator.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { validateUsername, validateGroupname, validateShell } from '../validator.js';

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('jdoe')).toBe(true);
    expect(validateUsername('_backup')).toBe(true);
    expect(validateUsername('user-name')).toBe(true);
    expect(validateUsername('user_123')).toBe(true);
  });

  it('rejects invalid usernames', () => {
    expect(validateUsername('')).toBe(false);
    expect(validateUsername('123user')).toBe(false);
    expect(validateUsername('User')).toBe(false);
    expect(validateUsername('user name')).toBe(false);
    expect(validateUsername('a'.repeat(33))).toBe(false);
    expect(validateUsername('user;rm')).toBe(false);
  });
});

describe('validateGroupname', () => {
  it('accepts valid group names', () => {
    expect(validateGroupname('developers')).toBe(true);
  });

  it('rejects invalid group names', () => {
    expect(validateGroupname('')).toBe(false);
    expect(validateGroupname('123group')).toBe(false);
  });
});

describe('validateShell', () => {
  it('accepts valid shell paths', () => {
    expect(validateShell('/bin/bash')).toBe(true);
    expect(validateShell('/bin/zsh')).toBe(true);
    expect(validateShell('/usr/bin/fish')).toBe(true);
    expect(validateShell('/sbin/nologin')).toBe(true);
  });

  it('rejects invalid shell paths', () => {
    expect(validateShell('bash')).toBe(false);
    expect(validateShell('/bin/bash; rm -rf')).toBe(false);
    expect(validateShell('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=validator`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement validator.js**

`server/validator.js`:
```js
const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const SHELL_RE = /^\/[a-z0-9/_-]+$/;

export function validateUsername(name) {
  return typeof name === 'string' && USERNAME_RE.test(name);
}

export function validateGroupname(name) {
  return typeof name === 'string' && USERNAME_RE.test(name);
}

export function validateShell(shell) {
  return typeof shell === 'string' && SHELL_RE.test(shell);
}

export function validateRequired(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  return missing.length === 0 ? null : `Missing required fields: ${missing.join(', ')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=validator`
Expected: PASS

- [ ] **Step 5: Implement logger.js**

`server/logger.js`:
```js
export function auditLog(action, target, ip, success, detail = '') {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    target,
    ip,
    success,
    ...(detail && { detail }),
  };
  console.log(JSON.stringify(entry));
}
```

- [ ] **Step 6: Write executor tests**

`server/__tests__/executor.test.js`:
```js
import { describe, it, expect, jest } from '@jest/globals';
import { isDocker, buildCommand } from '../services/executor.js';

describe('buildCommand', () => {
  it('returns command directly when not in Docker', () => {
    const result = buildCommand('useradd', ['testuser'], false);
    expect(result).toEqual({ cmd: 'useradd', args: ['testuser'] });
  });

  it('wraps with nsenter when in Docker', () => {
    const result = buildCommand('useradd', ['testuser'], true);
    expect(result.cmd).toBe('nsenter');
    expect(result.args).toEqual(['-t', '1', '-m', '-u', '-i', '-n', '--', 'useradd', 'testuser']);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- --testPathPattern=executor`
Expected: FAIL

- [ ] **Step 8: Implement executor.js**

`server/services/executor.js`:
```js
import { execFile } from 'child_process';
import { access } from 'fs/promises';

let _isDocker = null;

export async function isDocker() {
  if (_isDocker !== null) return _isDocker;
  try {
    await access('/.dockerenv');
    _isDocker = true;
  } catch {
    _isDocker = false;
  }
  return _isDocker;
}

export function buildCommand(cmd, args, inDocker) {
  if (inDocker) {
    return {
      cmd: 'nsenter',
      args: ['-t', '1', '-m', '-u', '-i', '-n', '--', cmd, ...args],
    };
  }
  return { cmd, args };
}

export async function execute(cmd, args = []) {
  const inDocker = await isDocker();
  const { cmd: finalCmd, args: finalArgs } = buildCommand(cmd, args, inDocker);

  return new Promise((resolve, reject) => {
    execFile(finalCmd, finalArgs, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- --testPathPattern=executor`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add server/validator.js server/logger.js server/services/executor.js server/__tests__/
git commit -m "feat: add input validator, audit logger, and command executor"
```

---

## Task 3: User Service

**Files:**
- Create: `server/services/userService.js`
- Create: `server/__tests__/userService.test.js`

- [ ] **Step 1: Write user service tests**

`server/__tests__/userService.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { parsePasswd, parseShadow, mergeUserData } from '../services/userService.js';

const PASSWD_DATA = `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
jdoe:x:1001:1001:John Doe:/home/jdoe:/bin/bash
`;

const SHADOW_DATA = `root:$6$hash:19000:0:99999:7:::
daemon:*:19000:0:99999:7:::
jdoe:$6$hash2:19500:0:90:7:30::
`;

describe('parsePasswd', () => {
  it('parses /etc/passwd format', () => {
    const users = parsePasswd(PASSWD_DATA);
    expect(users).toHaveLength(3);
    expect(users[2]).toEqual({
      username: 'jdoe',
      uid: 1001,
      gid: 1001,
      gecos: 'John Doe',
      home: '/home/jdoe',
      shell: '/bin/bash',
    });
  });

  it('skips empty lines', () => {
    const users = parsePasswd('root:x:0:0:root:/root:/bin/bash\n\n');
    expect(users).toHaveLength(1);
  });
});

describe('parseShadow', () => {
  it('parses /etc/shadow format', () => {
    const shadow = parseShadow(SHADOW_DATA);
    expect(shadow.jdoe).toBeDefined();
    expect(shadow.jdoe.locked).toBe(false);
    expect(shadow.jdoe.lastChanged).toBe(19500);
    expect(shadow.jdoe.maxDays).toBe(90);
    expect(shadow.jdoe.inactiveDays).toBe(30);
  });

  it('detects locked accounts', () => {
    const shadow = parseShadow('locked:!$6$hash:19000:0:99999:7:::\n');
    expect(shadow.locked.locked).toBe(true);
  });

  it('detects disabled accounts', () => {
    const shadow = parseShadow('daemon:*:19000:0:99999:7:::\n');
    expect(shadow.daemon.locked).toBe(true);
  });
});

describe('mergeUserData', () => {
  it('merges passwd and shadow data', () => {
    const users = parsePasswd(PASSWD_DATA);
    const shadow = parseShadow(SHADOW_DATA);
    const merged = mergeUserData(users, shadow);
    expect(merged[2].locked).toBe(false);
    expect(merged[2].passwordAging.maxDays).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=userService`
Expected: FAIL

- [ ] **Step 3: Implement userService.js**

`server/services/userService.js`:
```js
import { readFile } from 'fs/promises';
import { execute } from './executor.js';

export function parsePasswd(data) {
  return data
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [username, , uid, gid, gecos, home, shell] = line.split(':');
      return { username, uid: Number(uid), gid: Number(gid), gecos: gecos || '', home, shell };
    });
}

export function parseShadow(data) {
  const map = {};
  data
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .forEach(line => {
      const [username, hash, lastChanged, minDays, maxDays, warnDays, inactiveDays, expireDate] = line.split(':');
      const locked = hash.startsWith('!') || hash === '*' || hash === '!!';
      map[username] = {
        locked,
        lastChanged: lastChanged ? Number(lastChanged) : null,
        minDays: minDays ? Number(minDays) : 0,
        maxDays: maxDays ? Number(maxDays) : 99999,
        warnDays: warnDays ? Number(warnDays) : 7,
        inactiveDays: inactiveDays ? Number(inactiveDays) : -1,
        expireDate: expireDate || null,
      };
    });
  return map;
}

export function mergeUserData(users, shadow) {
  return users.map(user => {
    const s = shadow[user.username] || {};
    return {
      ...user,
      locked: s.locked ?? false,
      passwordAging: {
        lastChanged: s.lastChanged ?? null,
        minDays: s.minDays ?? 0,
        maxDays: s.maxDays ?? 99999,
        warnDays: s.warnDays ?? 7,
        inactiveDays: s.inactiveDays ?? -1,
        expireDate: s.expireDate ?? null,
      },
    };
  });
}

export async function listUsers() {
  const [passwdData, shadowData] = await Promise.all([
    readFile('/etc/passwd', 'utf-8'),
    readFile('/etc/shadow', 'utf-8').catch(() => ''),
  ]);
  const users = parsePasswd(passwdData);
  const shadow = parseShadow(shadowData);
  return mergeUserData(users, shadow);
}

export async function getUserGroups(username) {
  const output = await execute('groups', [username]);
  // Output format: "username : group1 group2 group3"
  const parts = output.split(':');
  return parts.length > 1 ? parts[1].trim().split(/\s+/) : [];
}

export async function getUserDetail(username) {
  const users = await listUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;

  const groups = await getUserGroups(username);

  let sudo = { hasSudo: false, rules: [] };
  try {
    const sudoOutput = await execute('sudo', ['-l', '-U', username]);
    const rules = sudoOutput
      .split('\n')
      .filter(line => line.trim().startsWith('('))
      .map(line => line.trim());
    if (rules.length > 0) {
      sudo = { hasSudo: true, rules };
    }
  } catch {
    // User has no sudo access
  }

  return { ...user, groups, sudo };
}

export async function createUser({ username, password, shell, home, gecos, groups, createHome }) {
  const args = [];
  if (shell) args.push('-s', shell);
  if (home) args.push('-d', home);
  if (gecos) args.push('-c', gecos);
  if (createHome) args.push('-m');
  if (groups && groups.length > 0) args.push('-G', groups.join(','));
  args.push(username);

  await execute('useradd', args);

  if (password) {
    await execute('chpasswd', [], password);
    // chpasswd reads from stdin — we need a different approach
    const { execFile } = await import('child_process');
    const { isDocker: checkDocker, buildCommand } = await import('./executor.js');
    const inDocker = await checkDocker();
    const { cmd, args: cmdArgs } = buildCommand('chpasswd', [], inDocker);

    await new Promise((resolve, reject) => {
      const proc = execFile(cmd, cmdArgs, (error) => {
        if (error) reject(new Error(error.message));
        else resolve();
      });
      proc.stdin.write(`${username}:${password}\n`);
      proc.stdin.end();
    });
  }
}

export async function deleteUser(username, removeHome = false) {
  const args = removeHome ? ['-r', username] : [username];
  await execute('userdel', args);
}

export async function modifyUser(username, { shell, home, gecos }) {
  const args = [];
  if (shell) args.push('-s', shell);
  if (home) args.push('-d', home);
  if (gecos) args.push('-c', gecos);
  if (args.length === 0) return;
  args.push(username);
  await execute('usermod', args);
}

export async function lockUser(username, locked) {
  const flag = locked ? '-L' : '-U';
  await execute('usermod', [flag, username]);
}

export async function changePassword(username, password) {
  const { execFile } = await import('child_process');
  const inDocker = await (await import('./executor.js')).isDocker();
  const { cmd, args } = (await import('./executor.js')).buildCommand('chpasswd', [], inDocker);

  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, (error) => {
      if (error) reject(new Error(error.message));
      else resolve();
    });
    proc.stdin.write(`${username}:${password}\n`);
    proc.stdin.end();
  });
}

export async function changeAging(username, { minDays, maxDays, warnDays, inactiveDays, expireDate }) {
  const args = [];
  if (minDays !== undefined) args.push('-m', String(minDays));
  if (maxDays !== undefined) args.push('-M', String(maxDays));
  if (warnDays !== undefined) args.push('-W', String(warnDays));
  if (inactiveDays !== undefined) args.push('-I', String(inactiveDays));
  if (expireDate !== undefined) args.push('-E', expireDate || '-1');
  if (args.length === 0) return;
  args.push(username);
  await execute('chage', args);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=userService`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/userService.js server/__tests__/userService.test.js
git commit -m "feat: add user service with passwd/shadow parsing and user management"
```

---

## Task 4: Group Service

**Files:**
- Create: `server/services/groupService.js`
- Create: `server/__tests__/groupService.test.js`

- [ ] **Step 1: Write group service tests**

`server/__tests__/groupService.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { parseGroup } from '../services/groupService.js';

const GROUP_DATA = `root:x:0:
daemon:x:1:
developers:x:1001:jdoe,alice
docker:x:999:jdoe
`;

describe('parseGroup', () => {
  it('parses /etc/group format', () => {
    const groups = parseGroup(GROUP_DATA);
    expect(groups).toHaveLength(4);
    expect(groups[2]).toEqual({
      name: 'developers',
      gid: 1001,
      members: ['jdoe', 'alice'],
    });
  });

  it('handles empty member list', () => {
    const groups = parseGroup('root:x:0:\n');
    expect(groups[0].members).toEqual([]);
  });

  it('skips empty lines', () => {
    const groups = parseGroup('root:x:0:\n\n');
    expect(groups).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=groupService`
Expected: FAIL

- [ ] **Step 3: Implement groupService.js**

`server/services/groupService.js`:
```js
import { readFile } from 'fs/promises';
import { execute } from './executor.js';

export function parseGroup(data) {
  return data
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [name, , gid, memberStr] = line.split(':');
      return {
        name,
        gid: Number(gid),
        members: memberStr ? memberStr.split(',').filter(Boolean) : [],
      };
    });
}

export async function listGroups() {
  const data = await readFile('/etc/group', 'utf-8');
  return parseGroup(data);
}

export async function createGroup(name, gid) {
  const args = gid !== undefined ? ['-g', String(gid), name] : [name];
  await execute('groupadd', args);
}

export async function deleteGroup(name) {
  await execute('groupdel', [name]);
}

export async function modifyGroup(name, { newName, gid }) {
  const args = [];
  if (newName) args.push('-n', newName);
  if (gid !== undefined) args.push('-g', String(gid));
  if (args.length === 0) return;
  args.push(name);
  await execute('groupmod', args);
}

export async function addMember(groupName, username) {
  await execute('gpasswd', ['-a', username, groupName]);
}

export async function removeMember(groupName, username) {
  await execute('gpasswd', ['-d', username, groupName]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=groupService`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/groupService.js server/__tests__/groupService.test.js
git commit -m "feat: add group service with /etc/group parsing and group management"
```

---

## Task 5: Sudo Service

**Files:**
- Create: `server/services/sudoService.js`
- Create: `server/__tests__/sudoService.test.js`

- [ ] **Step 1: Write sudo service tests**

`server/__tests__/sudoService.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { parseSudoersFile } from '../services/sudoService.js';

describe('parseSudoersFile', () => {
  it('parses user rules from sudoers content', () => {
    const content = `# sudoers file
root ALL=(ALL:ALL) ALL
%admin ALL=(ALL) ALL
jdoe ALL=(ALL) NOPASSWD: /usr/bin/apt
`;
    const rules = parseSudoersFile(content);
    expect(rules).toContainEqual({ username: 'root', rule: 'ALL=(ALL:ALL) ALL', type: 'user' });
    expect(rules).toContainEqual({ username: 'admin', rule: 'ALL=(ALL) ALL', type: 'group' });
    expect(rules).toContainEqual({ username: 'jdoe', rule: 'ALL=(ALL) NOPASSWD: /usr/bin/apt', type: 'user' });
  });

  it('skips comments and empty lines', () => {
    const content = `# comment\n\nDefaults env_reset\n`;
    const rules = parseSudoersFile(content);
    expect(rules).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=sudoService`
Expected: FAIL

- [ ] **Step 3: Implement sudoService.js**

`server/services/sudoService.js`:
```js
import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { execute } from './executor.js';

export function parseSudoersFile(content) {
  const rules = [];
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('Defaults')) return;

    // Group rule: %groupname ...
    const groupMatch = trimmed.match(/^%(\S+)\s+(.+)$/);
    if (groupMatch) {
      rules.push({ username: groupMatch[1], rule: groupMatch[2], type: 'group' });
      return;
    }

    // User rule: username ...
    const userMatch = trimmed.match(/^([a-z_][a-z0-9_-]*)\s+(ALL.+)$/);
    if (userMatch) {
      rules.push({ username: userMatch[1], rule: userMatch[2], type: 'user' });
    }
  });
  return rules;
}

export async function listSudoers() {
  const rules = [];

  // Parse main sudoers file
  try {
    const main = await readFile('/etc/sudoers', 'utf-8');
    rules.push(...parseSudoersFile(main));
  } catch { /* sudoers not readable */ }

  // Parse sudoers.d directory
  try {
    const files = await readdir('/etc/sudoers.d');
    for (const file of files) {
      if (file.startsWith('.') || file.endsWith('~')) continue;
      const content = await readFile(`/etc/sudoers.d/${file}`, 'utf-8');
      rules.push(...parseSudoersFile(content));
    }
  } catch { /* sudoers.d not available */ }

  return rules;
}

export async function grantSudo(username, rule) {
  const content = `${username} ${rule}\n`;
  const filePath = `/etc/sudoers.d/${username}`;
  await writeFile(filePath, content, { mode: 0o440 });

  // Validate with visudo -c
  try {
    await execute('visudo', ['-c', '-f', filePath]);
  } catch (err) {
    await unlink(filePath);
    throw new Error(`Invalid sudoers syntax: ${err.message}`);
  }
}

export async function modifySudo(username, rule) {
  // Same as grant — overwrites the file
  await grantSudo(username, rule);
}

export async function revokeSudo(username) {
  try {
    await unlink(`/etc/sudoers.d/${username}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=sudoService`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/sudoService.js server/__tests__/sudoService.test.js
git commit -m "feat: add sudo service with sudoers parsing and rule management"
```

---

## Task 6: Session Service

**Files:**
- Create: `server/services/sessionService.js`
- Create: `server/__tests__/sessionService.test.js`

- [ ] **Step 1: Write session service tests**

`server/__tests__/sessionService.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { parseWho, parseLast } from '../services/sessionService.js';

describe('parseWho', () => {
  it('parses who output', () => {
    const output = `jdoe     pts/0        2026-03-21 10:00 (192.168.1.5)
root     tty1         2026-03-21 08:00
`;
    const sessions = parseWho(output);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toEqual({
      user: 'jdoe',
      terminal: 'pts/0',
      date: '2026-03-21 10:00',
      host: '192.168.1.5',
    });
    expect(sessions[1].host).toBe('');
  });
});

describe('parseLast', () => {
  it('parses last output', () => {
    const output = `jdoe     pts/0        192.168.1.5      Fri Mar 21 10:00   still logged in
root     tty1                          Fri Mar 21 08:00 - 09:00  (01:00)

wtmp begins Fri Mar  1 00:00:00 2026
`;
    const logins = parseLast(output);
    expect(logins).toHaveLength(2);
    expect(logins[0].user).toBe('jdoe');
    expect(logins[0].host).toBe('192.168.1.5');
    expect(logins[0].duration).toBe('still logged in');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=sessionService`
Expected: FAIL

- [ ] **Step 3: Implement sessionService.js**

`server/services/sessionService.js`:
```js
import { execute } from './executor.js';

export function parseWho(output) {
  return output
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.trim().split(/\s+/);
      const hostMatch = line.match(/\((.+)\)/);
      return {
        user: parts[0],
        terminal: parts[1],
        date: `${parts[2]} ${parts[3]}`,
        host: hostMatch ? hostMatch[1] : '',
      };
    });
}

export function parseLast(output) {
  return output
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('wtmp') && !line.startsWith('reboot'))
    .filter(line => line.trim())
    .map(line => {
      const parts = line.trim().split(/\s+/);
      const user = parts[0];
      const terminal = parts[1];
      // Host is the third field if it looks like an IP or hostname
      const hostCandidate = parts[2];
      const isHost = hostCandidate && (hostCandidate.includes('.') || hostCandidate.includes(':'));
      const host = isHost ? hostCandidate : '';

      const durationMatch = line.match(/\((.+?)\)/);
      const stillIn = line.includes('still logged in');
      const duration = stillIn ? 'still logged in' : (durationMatch ? durationMatch[1] : '');

      return { user, terminal, host, duration };
    });
}

export async function getActiveSessions() {
  try {
    const output = await execute('who', []);
    return parseWho(output);
  } catch {
    return [];
  }
}

export async function getLastLogins(limit = 50) {
  try {
    const output = await execute('last', ['-n', String(limit)]);
    return parseLast(output);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=sessionService`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/sessionService.js server/__tests__/sessionService.test.js
git commit -m "feat: add session service with who/last output parsing"
```

---

## Task 7: REST API Routes

**Files:**
- Create: `server/routes/users.js`
- Create: `server/routes/groups.js`
- Create: `server/routes/sudoers.js`
- Create: `server/routes/sessions.js`
- Modify: `server/index.js` — register routes

- [ ] **Step 1: Implement user routes**

`server/routes/users.js`:
```js
import { Router } from 'express';
import { validateUsername, validateShell, validateRequired } from '../validator.js';
import { auditLog } from '../logger.js';
import {
  listUsers, getUserDetail, createUser, deleteUser,
  modifyUser, lockUser, changePassword, changeAging,
} from '../services/userService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let users = await listUsers();
    const { system, search, limit = 50, offset = 0 } = req.query;

    if (system !== 'true') {
      users = users.filter(u => u.uid >= 1000 || u.uid === 0);
    }
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => u.username.includes(q) || u.gecos.toLowerCase().includes(q));
    }

    const total = users.length;
    users = users.slice(Number(offset), Number(offset) + Number(limit));
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.get('/:username', async (req, res) => {
  try {
    const user = await getUserDetail(req.params.username);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User does not exist' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { username, password, shell, home, gecos, groups, createHome } = req.body;
  if (!username) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Missing required fields: username' });
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  if (shell && !validateShell(shell)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid shell path' });

  try {
    await createUser({ username, password, shell, home, gecos, groups, createHome });
    auditLog('CREATE_USER', username, req.ip, true);
    res.status(201).json({ message: `User ${username} created` });
  } catch (err) {
    auditLog('CREATE_USER', username, req.ip, false, err.message);
    const status = err.message.includes('already exists') ? 409 : 500;
    const code = status === 409 ? 'USER_EXISTS' : 'COMMAND_FAILED';
    res.status(status).json({ error: code, message: err.message });
  }
});

router.delete('/:username', async (req, res) => {
  const { username } = req.params;
  const removeHome = req.query.removeHome === 'true';
  try {
    await deleteUser(username, removeHome);
    auditLog('DELETE_USER', username, req.ip, true);
    res.json({ message: `User ${username} deleted` });
  } catch (err) {
    auditLog('DELETE_USER', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.patch('/:username', async (req, res) => {
  const { username } = req.params;
  const { shell, home, gecos } = req.body;
  if (shell && !validateShell(shell)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid shell path' });

  try {
    await modifyUser(username, { shell, home, gecos });
    auditLog('MODIFY_USER', username, req.ip, true);
    res.json({ message: `User ${username} modified` });
  } catch (err) {
    auditLog('MODIFY_USER', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/:username/password', async (req, res) => {
  const { username } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Password is required' });

  try {
    await changePassword(username, password);
    auditLog('CHANGE_PASSWORD', username, req.ip, true);
    res.json({ message: 'Password changed' });
  } catch (err) {
    auditLog('CHANGE_PASSWORD', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/:username/lock', async (req, res) => {
  const { username } = req.params;
  const { locked } = req.body;
  if (typeof locked !== 'boolean') return res.status(400).json({ error: 'INVALID_INPUT', message: 'locked must be boolean' });

  try {
    await lockUser(username, locked);
    auditLog(locked ? 'LOCK_USER' : 'UNLOCK_USER', username, req.ip, true);
    res.json({ message: `User ${username} ${locked ? 'locked' : 'unlocked'}` });
  } catch (err) {
    auditLog(locked ? 'LOCK_USER' : 'UNLOCK_USER', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.patch('/:username/aging', async (req, res) => {
  const { username } = req.params;
  try {
    await changeAging(username, req.body);
    auditLog('CHANGE_AGING', username, req.ip, true);
    res.json({ message: 'Password aging updated' });
  } catch (err) {
    auditLog('CHANGE_AGING', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Implement group routes**

`server/routes/groups.js`:
```js
import { Router } from 'express';
import { validateGroupname } from '../validator.js';
import { auditLog } from '../logger.js';
import {
  listGroups, createGroup, deleteGroup, modifyGroup, addMember, removeMember,
} from '../services/groupService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let groups = await listGroups();
    const { system, search } = req.query;

    if (system !== 'true') {
      groups = groups.filter(g => g.gid >= 1000 || g.gid === 0);
    }
    if (search) {
      const q = search.toLowerCase();
      groups = groups.filter(g => g.name.includes(q));
    }
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, gid } = req.body;
  if (!name) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Group name is required' });
  if (!validateGroupname(name)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid group name format' });

  try {
    await createGroup(name, gid);
    auditLog('CREATE_GROUP', name, req.ip, true);
    res.status(201).json({ message: `Group ${name} created` });
  } catch (err) {
    auditLog('CREATE_GROUP', name, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.delete('/:groupname', async (req, res) => {
  try {
    await deleteGroup(req.params.groupname);
    auditLog('DELETE_GROUP', req.params.groupname, req.ip, true);
    res.json({ message: `Group ${req.params.groupname} deleted` });
  } catch (err) {
    auditLog('DELETE_GROUP', req.params.groupname, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.patch('/:groupname', async (req, res) => {
  const { newName, gid } = req.body;
  try {
    await modifyGroup(req.params.groupname, { newName, gid });
    auditLog('MODIFY_GROUP', req.params.groupname, req.ip, true);
    res.json({ message: `Group ${req.params.groupname} modified` });
  } catch (err) {
    auditLog('MODIFY_GROUP', req.params.groupname, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/:groupname/members', async (req, res) => {
  const { usernames } = req.body;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'usernames array is required' });
  }

  try {
    for (const username of usernames) {
      await addMember(req.params.groupname, username);
    }
    auditLog('ADD_MEMBERS', `${req.params.groupname}: ${usernames.join(',')}`, req.ip, true);
    res.json({ message: `Members added to ${req.params.groupname}` });
  } catch (err) {
    auditLog('ADD_MEMBERS', req.params.groupname, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.delete('/:groupname/members/:username', async (req, res) => {
  try {
    await removeMember(req.params.groupname, req.params.username);
    auditLog('REMOVE_MEMBER', `${req.params.groupname}: ${req.params.username}`, req.ip, true);
    res.json({ message: `${req.params.username} removed from ${req.params.groupname}` });
  } catch (err) {
    auditLog('REMOVE_MEMBER', req.params.groupname, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

export default router;
```

- [ ] **Step 3: Implement sudoers routes**

`server/routes/sudoers.js`:
```js
import { Router } from 'express';
import { validateUsername } from '../validator.js';
import { auditLog } from '../logger.js';
import { listSudoers, grantSudo, modifySudo, revokeSudo } from '../services/sudoService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rules = await listSudoers();
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { username, rule } = req.body;
  if (!username || !rule) return res.status(400).json({ error: 'INVALID_INPUT', message: 'username and rule are required' });
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });

  try {
    await grantSudo(username, rule);
    auditLog('GRANT_SUDO', username, req.ip, true);
    res.status(201).json({ message: `Sudo granted to ${username}` });
  } catch (err) {
    auditLog('GRANT_SUDO', username, req.ip, false, err.message);
    const code = err.message.includes('syntax') ? 'SUDOERS_SYNTAX' : 'COMMAND_FAILED';
    const status = code === 'SUDOERS_SYNTAX' ? 400 : 500;
    res.status(status).json({ error: code, message: err.message });
  }
});

router.patch('/:username', async (req, res) => {
  const { rule } = req.body;
  if (!rule) return res.status(400).json({ error: 'INVALID_INPUT', message: 'rule is required' });

  try {
    await modifySudo(req.params.username, rule);
    auditLog('MODIFY_SUDO', req.params.username, req.ip, true);
    res.json({ message: `Sudo rule updated for ${req.params.username}` });
  } catch (err) {
    auditLog('MODIFY_SUDO', req.params.username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.delete('/:username', async (req, res) => {
  try {
    await revokeSudo(req.params.username);
    auditLog('REVOKE_SUDO', req.params.username, req.ip, true);
    res.json({ message: `Sudo revoked for ${req.params.username}` });
  } catch (err) {
    auditLog('REVOKE_SUDO', req.params.username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

export default router;
```

- [ ] **Step 4: Implement session routes**

`server/routes/sessions.js`:
```js
import { Router } from 'express';
import { getActiveSessions, getLastLogins } from '../services/sessionService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sessions = await getActiveSessions();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.get('/logins', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const logins = await getLastLogins(limit);
    res.json({ logins });
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

export default router;
```

- [ ] **Step 5: Update server/index.js to register routes and add rate limiting**

Add to `server/index.js` after `app.use(express.json())`:
```js
import rateLimit from 'express-rate-limit';
import os from 'os';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import sudoerRoutes from './routes/sudoers.js';
import sessionRoutes from './routes/sessions.js';

const passwordLimiter = rateLimit({ windowMs: 60000, max: 10 });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hostname: os.hostname() });
});

app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sudoers', sudoerRoutes);
app.use('/api/sessions', sessionRoutes);

// Apply rate limit to password endpoints
app.use('/api/users/:username/password', passwordLimiter);
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/ server/index.js
git commit -m "feat: add REST API routes for users, groups, sudoers, and sessions"
```

---

## Task 8: File Watcher (Real-time)

**Files:**
- Create: `server/watcher.js`
- Modify: `server/index.js` — integrate watcher

- [ ] **Step 1: Implement watcher.js**

`server/watcher.js`:
```js
import chokidar from 'chokidar';
import { listUsers } from './services/userService.js';
import { listGroups } from './services/groupService.js';

export function startWatcher(io) {
  const userFiles = ['/etc/passwd', '/etc/shadow'];
  const groupFiles = ['/etc/group'];

  let debounceUser = null;
  let debounceGroup = null;

  const userWatcher = chokidar.watch(userFiles, {
    persistent: true,
    usePolling: true,
    interval: 2000,
  });

  const groupWatcher = chokidar.watch(groupFiles, {
    persistent: true,
    usePolling: true,
    interval: 2000,
  });

  userWatcher.on('change', () => {
    clearTimeout(debounceUser);
    debounceUser = setTimeout(async () => {
      try {
        const users = await listUsers();
        io.emit('users:changed', { type: 'users', data: users });
      } catch (err) {
        console.error('Failed to broadcast user changes:', err.message);
      }
    }, 500);
  });

  groupWatcher.on('change', () => {
    clearTimeout(debounceGroup);
    debounceGroup = setTimeout(async () => {
      try {
        const groups = await listGroups();
        io.emit('groups:changed', { type: 'groups', data: groups });
      } catch (err) {
        console.error('Failed to broadcast group changes:', err.message);
      }
    }, 500);
  });

  return { userWatcher, groupWatcher };
}
```

- [ ] **Step 2: Integrate watcher into server/index.js**

Add after socket.io setup:
```js
import { startWatcher } from './watcher.js';

let watchers;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

watchers = startWatcher(io);
```

Update shutdown handler:
```js
const shutdown = () => {
  console.log('Shutting down...');
  if (watchers) {
    watchers.userWatcher.close();
    watchers.groupWatcher.close();
  }
  io.close();
  server.close(() => process.exit(0));
};
```

- [ ] **Step 3: Commit**

```bash
git add server/watcher.js server/index.js
git commit -m "feat: add real-time file watcher with chokidar and socket.io broadcast"
```

---

## Task 9: Frontend — Theme & Layout

**Files:**
- Create: `client/src/theme/global.css`
- Create: `client/src/components/Layout.jsx`
- Create: `client/src/components/StatusBar.jsx`
- Create: `client/src/components/Toast.jsx`
- Create: `client/src/components/ConfirmDialog.jsx`
- Create: `client/src/api/client.js`
- Create: `client/src/hooks/useSocket.js`
- Update: `client/src/App.jsx`

- [ ] **Step 1: Create terminal dark theme**

`client/src/theme/global.css`:
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --bg-tertiary: #1e1e1e;
  --bg-hover: #2a2a2a;
  --text-primary: #e0e0e0;
  --text-secondary: #888;
  --text-muted: #555;
  --accent-green: #4af626;
  --accent-amber: #ffb627;
  --accent-red: #ff4444;
  --accent-blue: #4a9eff;
  --border: #333;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-mono);
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

input, select, textarea {
  font-family: var(--font-mono);
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 12px;
  border-radius: 4px;
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--accent-green);
}

button {
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--border);
  padding: 6px 16px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transition: background 0.15s;
}
button:hover {
  background: var(--bg-hover);
}
button.primary {
  background: var(--accent-green);
  color: #000;
  border-color: var(--accent-green);
}
button.primary:hover {
  background: #3dd520;
}
button.danger {
  border-color: var(--accent-red);
  color: var(--accent-red);
}
button.danger:hover {
  background: var(--accent-red);
  color: #000;
}

table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
th {
  color: var(--accent-amber);
  font-weight: normal;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
tr:hover td {
  background: var(--bg-hover);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  max-width: 600px;
}
.modal h2 {
  color: var(--accent-green);
  font-size: 16px;
  margin-bottom: 16px;
}
.modal .form-group {
  margin-bottom: 12px;
}
.modal .form-group label {
  display: block;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-size: 12px;
}
.modal .form-group input,
.modal .form-group select {
  width: 100%;
}
.modal .actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
}
.badge.green {
  background: rgba(74, 246, 38, 0.15);
  color: var(--accent-green);
}
.badge.red {
  background: rgba(255, 68, 68, 0.15);
  color: var(--accent-red);
}
.badge.amber {
  background: rgba(255, 182, 39, 0.15);
  color: var(--accent-amber);
}
```

- [ ] **Step 2: Create API client**

`client/src/api/client.js`:
```js
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  // Users
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users?${qs}`);
  },
  getUser: (username) => request(`/users/${username}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  deleteUser: (username, removeHome = false) =>
    request(`/users/${username}?removeHome=${removeHome}`, { method: 'DELETE' }),
  modifyUser: (username, body) => request(`/users/${username}`, { method: 'PATCH', body }),
  changePassword: (username, password) =>
    request(`/users/${username}/password`, { method: 'POST', body: { password } }),
  lockUser: (username, locked) =>
    request(`/users/${username}/lock`, { method: 'POST', body: { locked } }),
  changeAging: (username, body) =>
    request(`/users/${username}/aging`, { method: 'PATCH', body }),

  // Groups
  getGroups: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/groups?${qs}`);
  },
  createGroup: (body) => request('/groups', { method: 'POST', body }),
  deleteGroup: (name) => request(`/groups/${name}`, { method: 'DELETE' }),
  modifyGroup: (name, body) => request(`/groups/${name}`, { method: 'PATCH', body }),
  addMembers: (groupName, usernames) =>
    request(`/groups/${groupName}/members`, { method: 'POST', body: { usernames } }),
  removeMember: (groupName, username) =>
    request(`/groups/${groupName}/members/${username}`, { method: 'DELETE' }),

  // Sudoers
  getSudoers: () => request('/sudoers'),
  grantSudo: (body) => request('/sudoers', { method: 'POST', body }),
  modifySudo: (username, rule) => request(`/sudoers/${username}`, { method: 'PATCH', body: { rule } }),
  revokeSudo: (username) => request(`/sudoers/${username}`, { method: 'DELETE' }),

  // Sessions
  getSessions: () => request('/sessions'),
  getLogins: (limit = 50) => request(`/sessions/logins?limit=${limit}`),

  // Health
  getHealth: () => request('/health'),
};
```

- [ ] **Step 3: Create useSocket hook**

`client/src/hooks/useSocket.js`:
```jsx
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    const socket = io({ transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => socket.disconnect();
  }, []);

  function on(event, handler) {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }

  return { connected, clientCount, on };
}
```

- [ ] **Step 4: Create Layout component**

`client/src/components/Layout.jsx`:
```jsx
import { NavLink } from 'react-router-dom';
import StatusBar from './StatusBar.jsx';

const navItems = [
  { path: '/users', label: 'Users' },
  { path: '/groups', label: 'Groups' },
  { path: '/sudo', label: 'Sudo' },
  { path: '/sessions', label: 'Sessions' },
];

export default function Layout({ children, connected, hostname }) {
  return (
    <>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent-green)', fontSize: 18 }}>|</span>
          <span style={{ fontWeight: 'bold' }}>Server User Management</span>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          server: {hostname || '...'}
        </span>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <nav style={{
          width: 180,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: '12px 0',
        }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'block',
                padding: '8px 20px',
                color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                textDecoration: 'none',
                borderLeft: isActive ? '3px solid var(--accent-green)' : '3px solid transparent',
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                fontSize: 14,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </main>
      </div>

      <StatusBar connected={connected} />
    </>
  );
}
```

- [ ] **Step 5: Create StatusBar component**

`client/src/components/StatusBar.jsx`:
```jsx
export default function StatusBar({ connected }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 20px',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      fontSize: 12,
      color: 'var(--text-secondary)',
    }}>
      <span>$ ready</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: connected ? 'var(--accent-green)' : 'var(--accent-red)',
        }} />
        {connected ? 'connected' : 'disconnected'}
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Create Toast component**

`client/src/components/Toast.jsx`:
```jsx
import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: 'fixed', bottom: 40, right: 20, zIndex: 200 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px',
            marginTop: 8,
            borderRadius: 4,
            fontSize: 13,
            border: '1px solid',
            borderColor: t.type === 'error' ? 'var(--accent-red)' :
                         t.type === 'success' ? 'var(--accent-green)' : 'var(--border)',
            color: t.type === 'error' ? 'var(--accent-red)' :
                   t.type === 'success' ? 'var(--accent-green)' : 'var(--text-primary)',
            background: 'var(--bg-secondary)',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 7: Create ConfirmDialog component**

`client/src/components/ConfirmDialog.jsx`:
```jsx
export default function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{message}</p>
        <div className="actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Update App.jsx with providers and socket**

`client/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { api } from './api/client.js';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import UserTable from './components/UserTable.jsx';
import GroupTable from './components/GroupTable.jsx';
import SudoersList from './components/SudoersList.jsx';
import SessionList from './components/SessionList.jsx';

export default function App() {
  const { connected, on } = useSocket();
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    api.getHealth().then(d => setHostname(d.hostname)).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout connected={connected} hostname={hostname}>
          <Routes>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<UserTable socketOn={on} />} />
            <Route path="/groups" element={<GroupTable socketOn={on} />} />
            <Route path="/sudo" element={<SudoersList />} />
            <Route path="/sessions" element={<SessionList />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add client/
git commit -m "feat: add terminal dark theme, layout, status bar, toast, API client, socket hook"
```

---

## Task 10: Frontend — Users Page

**Files:**
- Create: `client/src/components/UserTable.jsx`
- Create: `client/src/components/UserDetail.jsx`
- Create: `client/src/components/UserForm.jsx`

- [ ] **Step 1: Implement UserTable**

`client/src/components/UserTable.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import UserDetail from './UserDetail.jsx';
import UserForm from './UserForm.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function UserTable({ socketOn }) {
  const [users, setUsers] = useState([]);
  const [showSystem, setShowSystem] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const addToast = useToast();

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers({ system: showSystem, search, limit: 500 });
      setUsers(data.users);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  useEffect(() => { fetchUsers(); }, [showSystem, search]);

  useEffect(() => {
    return socketOn('users:changed', (payload) => {
      setUsers(payload.data.filter(u => showSystem || u.uid >= 1000 || u.uid === 0));
    });
  }, [socketOn, showSystem]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteUser(deleteTarget, false);
      addToast(`User ${deleteTarget} deleted`, 'success');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Users</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} />
            System users
          </label>
          <button className="primary" onClick={() => setShowForm(true)}>+ Add User</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>UID</th>
            <th>Home</th>
            <th>Shell</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.username} style={{ cursor: 'pointer' }} onClick={() => setSelected(u.username)}>
              <td style={{ color: 'var(--accent-green)' }}>{u.username}</td>
              <td>{u.uid}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{u.home}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{u.shell}</td>
              <td>
                <span className={`badge ${u.locked ? 'red' : 'green'}`}>
                  {u.locked ? 'locked' : 'active'}
                </span>
              </td>
              <td>
                <button className="danger" style={{ padding: '2px 10px', fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); setDeleteTarget(u.username); }}>
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users found</p>
      )}

      {selected && (
        <UserDetail username={selected} onClose={() => setSelected(null)} onRefresh={fetchUsers} />
      )}

      {showForm && (
        <UserForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchUsers(); }} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete User"
          message={`Are you sure you want to delete user "${deleteTarget}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement UserForm**

`client/src/components/UserForm.jsx`:
```jsx
import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function UserForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    username: '', password: '', shell: '/bin/bash',
    home: '', gecos: '', groups: '', createHome: true,
  });
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createUser({
        ...form,
        home: form.home || `/home/${form.username}`,
        groups: form.groups ? form.groups.split(',').map(g => g.trim()) : [],
      });
      addToast(`User ${form.username} created`, 'success');
      onCreated();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create User</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input required value={form.username} onChange={update('username')} placeholder="jdoe" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={update('password')} />
          </div>
          <div className="form-group">
            <label>Full Name (GECOS)</label>
            <input value={form.gecos} onChange={update('gecos')} placeholder="John Doe" />
          </div>
          <div className="form-group">
            <label>Shell</label>
            <input value={form.shell} onChange={update('shell')} />
          </div>
          <div className="form-group">
            <label>Home Directory</label>
            <input value={form.home} onChange={update('home')} placeholder={`/home/${form.username || 'username'}`} />
          </div>
          <div className="form-group">
            <label>Groups (comma-separated)</label>
            <input value={form.groups} onChange={update('groups')} placeholder="developers, docker" />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.createHome} onChange={update('createHome')} />
            <label style={{ margin: 0 }}>Create home directory</label>
          </div>
          <div className="actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement UserDetail**

`client/src/components/UserDetail.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function UserDetail({ username, onClose, onRefresh }) {
  const [user, setUser] = useState(null);
  const [editShell, setEditShell] = useState('');
  const [editGecos, setEditGecos] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const addToast = useToast();

  useEffect(() => {
    api.getUser(username).then(u => {
      setUser(u);
      setEditShell(u.shell);
      setEditGecos(u.gecos);
    }).catch(err => addToast(err.message, 'error'));
  }, [username]);

  if (!user) return null;

  const handleModify = async () => {
    try {
      await api.modifyUser(username, { shell: editShell, gecos: editGecos });
      addToast('User modified', 'success');
      onRefresh();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handlePassword = async () => {
    try {
      await api.changePassword(username, newPassword);
      addToast('Password changed', 'success');
      setNewPassword('');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleLock = async () => {
    try {
      await api.lockUser(username, !user.locked);
      addToast(`User ${user.locked ? 'unlocked' : 'locked'}`, 'success');
      setUser({ ...user, locked: !user.locked });
      onRefresh();
    } catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 500 }}>
        <h2>{username}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 20, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text-secondary)' }}>UID:</span> {user.uid}</div>
          <div><span style={{ color: 'var(--text-secondary)' }}>GID:</span> {user.gid}</div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Home:</span> {user.home}</div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Status:</span>{' '}
            <span className={`badge ${user.locked ? 'red' : 'green'}`}>{user.locked ? 'locked' : 'active'}</span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Groups:</span>{' '}
            {(user.groups || []).map(g => <span key={g} className="badge amber" style={{ marginRight: 4 }}>{g}</span>)}
          </div>
          {user.sudo?.hasSudo && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sudo:</span>{' '}
              {user.sudo.rules.join(', ')}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8 }}>Edit</h3>
          <div className="form-group">
            <label>Shell</label>
            <input value={editShell} onChange={e => setEditShell(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input value={editGecos} onChange={e => setEditGecos(e.target.value)} />
          </div>
          <button onClick={handleModify} style={{ marginBottom: 16 }}>Save Changes</button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8 }}>Password</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ flex: 1 }} />
            <button onClick={handlePassword} disabled={!newPassword}>Change</button>
          </div>
        </div>

        <div className="actions" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <button onClick={handleLock} className={user.locked ? '' : 'danger'}>
            {user.locked ? 'Unlock' : 'Lock'} Account
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/UserTable.jsx client/src/components/UserDetail.jsx client/src/components/UserForm.jsx
git commit -m "feat: add Users page with table, detail view, and create form"
```

---

## Task 11: Frontend — Groups Page

**Files:**
- Create: `client/src/components/GroupTable.jsx`
- Create: `client/src/components/GroupDetail.jsx`
- Create: `client/src/components/GroupForm.jsx`

- [ ] **Step 1: Implement GroupTable**

`client/src/components/GroupTable.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import GroupDetail from './GroupDetail.jsx';
import GroupForm from './GroupForm.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function GroupTable({ socketOn }) {
  const [groups, setGroups] = useState([]);
  const [showSystem, setShowSystem] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const addToast = useToast();

  const fetchGroups = async () => {
    try {
      const data = await api.getGroups({ system: showSystem, search });
      setGroups(data.groups);
    } catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchGroups(); }, [showSystem, search]);

  useEffect(() => {
    return socketOn('groups:changed', (payload) => {
      setGroups(payload.data.filter(g => showSystem || g.gid >= 1000 || g.gid === 0));
    });
  }, [socketOn, showSystem]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteGroup(deleteTarget);
      addToast(`Group ${deleteTarget} deleted`, 'success');
      setDeleteTarget(null);
      fetchGroups();
    } catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Groups</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} />
            System groups
          </label>
          <button className="primary" onClick={() => setShowForm(true)}>+ Add Group</button>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Name</th><th>GID</th><th>Members</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.name} style={{ cursor: 'pointer' }} onClick={() => setSelected(g.name)}>
              <td style={{ color: 'var(--accent-green)' }}>{g.name}</td>
              <td>{g.gid}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{g.members.length} members</td>
              <td>
                <button className="danger" style={{ padding: '2px 10px', fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); setDeleteTarget(g.name); }}>
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && <GroupDetail groupName={selected} onClose={() => setSelected(null)} onRefresh={fetchGroups} />}
      {showForm && <GroupForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchGroups(); }} />}
      {deleteTarget && (
        <ConfirmDialog title="Delete Group" message={`Delete group "${deleteTarget}"?`}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement GroupForm**

`client/src/components/GroupForm.jsx`:
```jsx
import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function GroupForm({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [gid, setGid] = useState('');
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createGroup({ name, gid: gid ? Number(gid) : undefined });
      addToast(`Group ${name} created`, 'success');
      onCreated();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create Group</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Group Name</label><input required value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="form-group"><label>GID (optional)</label><input type="number" value={gid} onChange={e => setGid(e.target.value)} /></div>
          <div className="actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement GroupDetail**

`client/src/components/GroupDetail.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function GroupDetail({ groupName, onClose, onRefresh }) {
  const [group, setGroup] = useState(null);
  const [newMember, setNewMember] = useState('');
  const addToast = useToast();

  const fetchGroup = async () => {
    try {
      const data = await api.getGroups({ system: true });
      const g = data.groups.find(g => g.name === groupName);
      setGroup(g);
    } catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchGroup(); }, [groupName]);

  const handleAddMember = async () => {
    if (!newMember) return;
    try {
      await api.addMembers(groupName, [newMember.trim()]);
      addToast(`${newMember} added to ${groupName}`, 'success');
      setNewMember('');
      fetchGroup();
      onRefresh();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleRemoveMember = async (username) => {
    try {
      await api.removeMember(groupName, username);
      addToast(`${username} removed from ${groupName}`, 'success');
      fetchGroup();
      onRefresh();
    } catch (err) { addToast(err.message, 'error'); }
  };

  if (!group) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{groupName} <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>GID: {group.gid}</span></h2>

        <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', margin: '16px 0 8px' }}>Members</h3>
        {group.members.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No members</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {group.members.map(m => (
              <span key={m} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 13,
              }}>
                {m}
                <span style={{ cursor: 'pointer', color: 'var(--accent-red)' }}
                  onClick={() => handleRemoveMember(m)}>x</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input placeholder="Username" value={newMember} onChange={e => setNewMember(e.target.value)} style={{ flex: 1 }} />
          <button onClick={handleAddMember}>Add Member</button>
        </div>

        <div className="actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/GroupTable.jsx client/src/components/GroupDetail.jsx client/src/components/GroupForm.jsx
git commit -m "feat: add Groups page with table, detail view, and create form"
```

---

## Task 12: Frontend — Sudo & Sessions Pages

**Files:**
- Create: `client/src/components/SudoersList.jsx`
- Create: `client/src/components/SessionList.jsx`

- [ ] **Step 1: Implement SudoersList**

`client/src/components/SudoersList.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function SudoersList() {
  const [rules, setRules] = useState([]);
  const [showGrant, setShowGrant] = useState(false);
  const [form, setForm] = useState({ username: '', rule: 'ALL=(ALL) ALL' });
  const addToast = useToast();

  const fetchRules = async () => {
    try {
      const data = await api.getSudoers();
      setRules(data.rules);
    } catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleGrant = async (e) => {
    e.preventDefault();
    try {
      await api.grantSudo(form);
      addToast(`Sudo granted to ${form.username}`, 'success');
      setShowGrant(false);
      setForm({ username: '', rule: 'ALL=(ALL) ALL' });
      fetchRules();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleRevoke = async (username) => {
    try {
      await api.revokeSudo(username);
      addToast(`Sudo revoked for ${username}`, 'success');
      fetchRules();
    } catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Sudo Rules</h1>
        <button className="primary" onClick={() => setShowGrant(true)}>+ Grant Sudo</button>
      </div>

      <table>
        <thead><tr><th>Type</th><th>Name</th><th>Rule</th><th>Actions</th></tr></thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={i}>
              <td><span className={`badge ${r.type === 'user' ? 'green' : 'amber'}`}>{r.type}</span></td>
              <td style={{ color: 'var(--accent-green)' }}>{r.username}</td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.rule}</td>
              <td>
                {r.type === 'user' && (
                  <button className="danger" style={{ padding: '2px 10px', fontSize: 12 }}
                    onClick={() => handleRevoke(r.username)}>revoke</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rules.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No sudo rules found</p>}

      {showGrant && (
        <div className="modal-overlay" onClick={() => setShowGrant(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Grant Sudo</h2>
            <form onSubmit={handleGrant}>
              <div className="form-group"><label>Username</label><input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
              <div className="form-group"><label>Rule</label><input required value={form.rule} onChange={e => setForm({ ...form, rule: e.target.value })} /></div>
              <div className="actions">
                <button type="button" onClick={() => setShowGrant(false)}>Cancel</button>
                <button type="submit" className="primary">Grant</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement SessionList**

`client/src/components/SessionList.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [logins, setLogins] = useState([]);
  const addToast = useToast();

  const fetch = async () => {
    try {
      const [s, l] = await Promise.all([api.getSessions(), api.getLogins(50)]);
      setSessions(s.sessions);
      setLogins(l.logins);
    } catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <h1 style={{ fontSize: 18, color: 'var(--accent-green)', marginBottom: 16 }}>Sessions</h1>

      <h2 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8 }}>Active Sessions</h2>
      <table>
        <thead><tr><th>User</th><th>Terminal</th><th>Date</th><th>Host</th></tr></thead>
        <tbody>
          {sessions.map((s, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--accent-green)' }}>{s.user}</td>
              <td>{s.terminal}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{s.date}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{s.host || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <p style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No active sessions</p>}

      <h2 style={{ fontSize: 14, color: 'var(--accent-amber)', margin: '24px 0 8px' }}>Recent Logins</h2>
      <table>
        <thead><tr><th>User</th><th>Terminal</th><th>Host</th><th>Duration</th></tr></thead>
        <tbody>
          {logins.map((l, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--accent-green)' }}>{l.user}</td>
              <td>{l.terminal}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{l.host || '-'}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{l.duration || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logins.length === 0 && <p style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No login history</p>}

      <button onClick={fetch} style={{ marginTop: 16 }}>Refresh</button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SudoersList.jsx client/src/components/SessionList.jsx
git commit -m "feat: add Sudo rules and Sessions pages"
```

---

## Task 13: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile**

`Dockerfile`:
```dockerfile
# Stage 1: Build React frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci
COPY client/ ./client/
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine
RUN apk add --no-cache sudo shadow util-linux
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=9998
ENV HOST=0.0.0.0
EXPOSE 9998

CMD ["node", "server/index.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

`docker-compose.yml`:
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
    environment:
      - PORT=9998
      - HOST=0.0.0.0
    restart: unless-stopped
```

- [ ] **Step 3: Create .dockerignore**

`.dockerignore`:
```
node_modules
client/node_modules
client/dist
.git
docs
*.md
```

- [ ] **Step 4: Verify Docker build**

Run: `docker build -t server-user-management .`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Docker multi-stage build and docker-compose config"
```

---

## Task 14: Integration Testing & Final Polish

**Files:**
- Modify: `server/index.js` — fix any startup issues
- Modify: `package.json` — add jest config

- [ ] **Step 1: Add jest config to package.json**

Add to `package.json`:
```json
"jest": {
  "transform": {},
  "testMatch": ["**/__tests__/**/*.test.js"]
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Build and verify frontend**

Run: `npm run build`
Expected: Vite build succeeds, output in `client/dist/`

- [ ] **Step 4: Start server and verify health endpoint**

Run: `NODE_ENV=production timeout 5 node server/index.js & sleep 2 && curl -s http://127.0.0.1:9998/api/health && kill %1`
Expected: `{"status":"ok","hostname":"..."}`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: integration testing, jest config, and final polish"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project Scaffolding | 8 |
| 2 | Validator, Logger, Executor | 10 |
| 3 | User Service | 5 |
| 4 | Group Service | 5 |
| 5 | Sudo Service | 5 |
| 6 | Session Service | 5 |
| 7 | REST API Routes | 6 |
| 8 | File Watcher | 3 |
| 9 | Frontend Theme & Layout | 9 |
| 10 | Frontend Users Page | 4 |
| 11 | Frontend Groups Page | 4 |
| 12 | Frontend Sudo & Sessions | 3 |
| 13 | Docker Setup | 5 |
| 14 | Integration & Polish | 5 |
| **Total** | | **77 steps** |
