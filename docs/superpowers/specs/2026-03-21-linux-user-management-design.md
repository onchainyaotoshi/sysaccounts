# Linux Server User Management — Design Spec

## Overview

A web-based Linux user management tool that runs on a server and provides a terminal-themed UI to manage all aspects of Linux users, groups, permissions, and sessions on that machine.

## Key Decisions

- **No authentication** — anyone with access to the URL can manage users (auth can be added later)
- **Single server** — manages users on the machine where the app is running
- **Direct command execution** — uses Linux commands (`useradd`, `usermod`, etc.) and reads system files directly
- **Port 9998**, bound to `127.0.0.1` by default
- **Dockerized** — runs in container, uses `nsenter` to execute commands in the host's PID namespace
- **ESM modules** — `"type": "module"` in package.json

## Tech Stack

- **Backend:** Node.js, Express, socket.io
- **Frontend:** React (Vite), terminal-dark theme (monospace, green/amber)
- **Real-time:** WebSocket via socket.io, file watching via `chokidar` (handles atomic renames reliably)
- **Containerization:** Docker, port 9998

## Architecture

```
Browser (React, port 9998)
    │
    │ HTTP REST + WebSocket
    ▼
Node.js Backend (Express + socket.io)
    │
    │ nsenter -t 1 -m -u -i -n -- <command>   (when in Docker)
    │ child_process.execFile <command>           (when on host)
    │ fs.readFile for parsing system files
    ▼
Linux OS (Host)
    /etc/passwd, /etc/shadow, /etc/group, /etc/gshadow,
    /etc/sudoers, /etc/sudoers.d/, /etc/login.defs
    Commands: useradd, userdel, usermod, groupadd, groupdel, groupmod,
              gpasswd, chpasswd, chage, passwd, who, w, last
```

### Command Execution Strategy

When running inside Docker, all user management commands are executed in the host's namespace using:
```
nsenter -t 1 -m -u -i -n -- useradd ...
```
This ensures commands affect the host OS, not the container. The service layer auto-detects whether it's running in Docker (check for `/.dockerenv`) and wraps commands accordingly.

When running directly on the host (no Docker), commands are executed via `execFile` directly.

## API Design

### User Management

| Feature | Command | Endpoint |
|---------|---------|----------|
| List all users | parse `/etc/passwd` + `/etc/shadow` | `GET /api/users?system=false&search=&limit=50&offset=0` |
| User detail | parse files + `groups` + `sudo -l -U` | `GET /api/users/:username` |
| Create user | `useradd` | `POST /api/users` |
| Delete user | `userdel` | `DELETE /api/users/:username?removeHome=false` |
| Modify user (shell, home, gecos) | `usermod` | `PATCH /api/users/:username` |
| Change password | `chpasswd` | `POST /api/users/:username/password` |
| Lock/unlock account | `usermod -L / -U` | `POST /api/users/:username/lock` |
| Password aging (expiry, min/max days) | `chage` | `PATCH /api/users/:username/aging` |

#### Request/Response Examples

**POST /api/users**
```json
{
  "username": "jdoe",
  "password": "securepass",
  "shell": "/bin/bash",
  "home": "/home/jdoe",
  "gecos": "John Doe",
  "groups": ["developers", "docker"],
  "createHome": true
}
```

**GET /api/users/:username** response:
```json
{
  "username": "jdoe",
  "uid": 1001,
  "gid": 1001,
  "gecos": "John Doe",
  "home": "/home/jdoe",
  "shell": "/bin/bash",
  "locked": false,
  "groups": ["jdoe", "developers", "docker"],
  "lastLogin": "2026-03-20T10:30:00Z",
  "passwordAging": {
    "lastChanged": "2026-03-01",
    "minDays": 0,
    "maxDays": 99999,
    "warnDays": 7,
    "inactiveDays": -1,
    "expireDate": null
  },
  "sudo": { "hasSudo": true, "rules": ["ALL=(ALL) ALL"] }
}
```
Note: password hashes from `/etc/shadow` are NEVER returned in API responses.

**POST /api/users/:username/lock**
```json
{ "locked": true }
```
`true` to lock, `false` to unlock.

**PATCH /api/users/:username**
```json
{ "shell": "/bin/zsh", "gecos": "Jane Doe" }
```

### Group Management

| Feature | Command | Endpoint |
|---------|---------|----------|
| List all groups | parse `/etc/group` | `GET /api/groups?system=false&search=` |
| Create group | `groupadd` | `POST /api/groups` |
| Delete group | `groupdel` | `DELETE /api/groups/:groupname` |
| Modify group (rename, GID) | `groupmod` | `PATCH /api/groups/:groupname` |
| Add user to group | `gpasswd -a` | `POST /api/groups/:groupname/members` |
| Remove user from group | `gpasswd -d` | `DELETE /api/groups/:groupname/members/:username` |

**POST /api/groups/:groupname/members**
```json
{ "usernames": ["jdoe", "alice"] }
```
Supports batch add — accepts an array of usernames.

### Sudo / Permissions

| Feature | Command | Endpoint |
|---------|---------|----------|
| List sudoers | parse `/etc/sudoers` + `/etc/sudoers.d/` | `GET /api/sudoers` |
| Grant sudo | write to `/etc/sudoers.d/` + `visudo -c` | `POST /api/sudoers` |
| Modify sudo rule | update `/etc/sudoers.d/` + `visudo -c` | `PATCH /api/sudoers/:username` |
| Revoke sudo | remove from `/etc/sudoers.d/` | `DELETE /api/sudoers/:username` |

**POST /api/sudoers**
```json
{ "username": "jdoe", "rule": "ALL=(ALL) NOPASSWD: /usr/bin/apt" }
```

### System Info

| Feature | Command | Endpoint |
|---------|---------|----------|
| Active sessions | `who` / `w` | `GET /api/sessions` |
| Last logins | `last` | `GET /api/logins?limit=50` |
| Health check | — | `GET /api/health` |

### WebSocket Events

- `users:changed` — broadcast when `/etc/passwd` or `/etc/shadow` changes. Payload: `{ type: "users", data: <full user list> }`
- `groups:changed` — broadcast when `/etc/group` changes. Payload: `{ type: "groups", data: <full group list> }`

### Error Responses

All errors follow:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description" }
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `USER_EXISTS` | 409 | Username already taken |
| `USER_NOT_FOUND` | 404 | User does not exist |
| `GROUP_NOT_FOUND` | 404 | Group does not exist |
| `INVALID_USERNAME` | 400 | Username fails validation |
| `INVALID_INPUT` | 400 | Missing or malformed fields |
| `COMMAND_FAILED` | 500 | OS command returned error |
| `SUDOERS_SYNTAX` | 400 | Sudoers rule failed `visudo -c` |

## UI Design

### Layout

```
┌──────────────────────────────────────────────────────┐
│  ▌ Server User Management          server: hostname  │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  > Users   │  Main content area                      │
│    Groups  │  (tables, forms, details)               │
│    Sudo    │                                         │
│    Sessions│                                         │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
│  $ ready                              ● 3 connected  │
└──────────────────────────────────────────────────────┘
```

### Theme

- **Dark background** — terminal-inspired
- **Monospace font** — consistent with terminal feel
- **Green/amber accent colors** — classic terminal palette
- **Status bar** — bottom bar showing connection status and server info

### Pages

1. **Users** — table of all users with columns: username, UID, home, shell, status (locked/active), groups. Toggle to hide/show system users (UID < 1000). Click row to view/edit detail. [+ Add User] button opens modal.
2. **Groups** — table of all groups: name, GID, member count. Click to manage members. [+ Add Group] button.
3. **Sudo** — list of users with sudo access and their rules. Grant/revoke/edit buttons.
4. **Sessions** — currently logged-in users (`who`), recent logins (`last`).

### Interactions

- **Create/Edit** — modal dialogs with form fields
- **Delete** — confirmation dialog before executing
- **Real-time** — tables auto-update when WebSocket events fire
- **Toast notifications** — success/error feedback on actions

## Docker Setup

```yaml
# docker-compose.yml
services:
  server-user-management:
    build: .
    pid: "host"                    # Required for nsenter to access host PID 1
    privileged: true               # Required for nsenter
    network_mode: "host"           # Optional: use host network directly
    ports:
      - "127.0.0.1:9998:9998"     # Bind to localhost only
    volumes:
      - /etc/passwd:/etc/passwd
      - /etc/shadow:/etc/shadow
      - /etc/group:/etc/group
      - /etc/gshadow:/etc/gshadow
      - /etc/login.defs:/etc/login.defs:ro
      - /etc/sudoers:/etc/sudoers
      - /etc/sudoers.d:/etc/sudoers.d
      - /home:/home                # For home directory creation/deletion
      - /var/run/utmp:/var/run/utmp:ro    # For `who` command
      - /var/log/wtmp:/var/log/wtmp:ro    # For `last` command
    environment:
      - PORT=9998
      - HOST=127.0.0.1
```

```dockerfile
# Dockerfile — Multi-stage build
# Stage 1: Build React frontend with Vite
# Stage 2: Node.js runtime serving built frontend + API
# Includes: sudo package (for sudo -l -U queries)
```

## Project Structure

```
server-user-management/
├── docker-compose.yml
├── Dockerfile
├── package.json                   # Server deps, "type": "module", workspaces
├── server/
│   ├── index.js                   # Express + socket.io setup, graceful shutdown
│   ├── routes/
│   │   ├── users.js               # User CRUD endpoints
│   │   ├── groups.js              # Group CRUD endpoints
│   │   ├── sudoers.js             # Sudo management endpoints
│   │   └── sessions.js            # Active sessions & logins
│   ├── services/
│   │   ├── executor.js            # Command execution: nsenter (Docker) or direct
│   │   ├── userService.js         # Parse /etc/passwd, /etc/shadow, exec commands
│   │   ├── groupService.js        # Parse /etc/group, exec commands
│   │   ├── sudoService.js         # Parse /etc/sudoers, manage sudoers.d
│   │   └── sessionService.js      # Parse who, w, last
│   ├── watcher.js                 # chokidar on system files, emit socket events
│   ├── validator.js               # Input validation (username, groupname, etc.)
│   └── logger.js                  # Audit logging for all state-changing operations
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── theme/                  # Dark terminal theme styles
│       ├── components/
│       │   ├── Layout.jsx          # Sidebar + main + status bar
│       │   ├── UserTable.jsx
│       │   ├── UserDetail.jsx
│       │   ├── UserForm.jsx        # Create/edit modal
│       │   ├── GroupTable.jsx
│       │   ├── GroupDetail.jsx
│       │   ├── GroupForm.jsx
│       │   ├── SudoersList.jsx
│       │   ├── SessionList.jsx
│       │   └── StatusBar.jsx
│       ├── hooks/
│       │   └── useSocket.js        # WebSocket connection hook
│       └── api/
│           └── client.js           # Fetch wrapper for REST calls
└── docs/
```

## Security

- **Bind to `127.0.0.1`** by default — not exposed to external networks
- **No auth in v1** — intended for localhost/trusted access. Document reverse proxy (nginx/caddy with basic auth) for remote access.
- **CORS** — same-origin only, reject cross-origin requests to prevent CSRF
- **Input validation:**
  - Usernames: `^[a-z_][a-z0-9_-]{0,31}$` (max 32 chars)
  - Group names: same pattern
  - All fields validated and sanitized before command execution
- **`execFile`** (not `exec`) to prevent shell injection
- **Sudoers** changes validated with `visudo -c` before applying
- **Password hashes** from `/etc/shadow` are never exposed via API
- **Rate limiting** on password-related endpoints (10 req/min per IP)

## Audit Logging

All state-changing operations (create, delete, modify user/group, password change, sudo grant/revoke) are logged to stdout with:
- Timestamp
- Action performed
- Target user/group
- Source IP
- Success/failure

## Graceful Shutdown

Server handles `SIGTERM`/`SIGINT`:
1. Stop accepting new connections
2. Close all WebSocket connections
3. Stop file watchers
4. Exit cleanly
