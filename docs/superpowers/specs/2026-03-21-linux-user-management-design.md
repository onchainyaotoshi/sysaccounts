# Linux Server User Management — Design Spec

## Overview

A web-based Linux user management tool that runs on a server and provides a terminal-themed UI to manage all aspects of Linux users, groups, permissions, and sessions on that machine.

## Key Decisions

- **No authentication** — anyone with access to the URL can manage users (auth can be added later)
- **Single server** — manages users on the machine where the app is running
- **Direct command execution** — uses Linux commands (`useradd`, `usermod`, etc.) and reads system files directly
- **Port 9998**
- **Dockerized** — runs as privileged container with access to host user management files

## Tech Stack

- **Backend:** Node.js, Express, socket.io
- **Frontend:** React (Vite), terminal-dark theme (monospace, green/amber)
- **Real-time:** WebSocket via socket.io, triggered by `fs.watch` on system files
- **Containerization:** Docker, port 9998

## Architecture

```
Browser (React, port 9998)
    │
    │ HTTP REST + WebSocket
    ▼
Node.js Backend (Express + socket.io)
    │
    │ child_process.execFile / fs.readFile
    ▼
Linux OS
    /etc/passwd, /etc/shadow, /etc/group, /etc/sudoers, /etc/sudoers.d/
    Commands: useradd, userdel, usermod, groupadd, groupdel, groupmod,
              gpasswd, chpasswd, chage, passwd, who, w, last
```

- Backend runs as root (required for user management commands)
- `fs.watch` monitors `/etc/passwd`, `/etc/group`, `/etc/shadow` for changes
- On change, broadcasts WebSocket events to all connected clients

## API Design

### User Management

| Fitur | Command | Endpoint |
|-------|---------|----------|
| List all users | parse `/etc/passwd` + `/etc/shadow` | `GET /api/users` |
| User detail | parse files + `groups` + `sudo -l -U` | `GET /api/users/:username` |
| Create user | `useradd` | `POST /api/users` |
| Delete user | `userdel` | `DELETE /api/users/:username` |
| Modify user (shell, home, gecos) | `usermod` | `PATCH /api/users/:username` |
| Change password | `chpasswd` | `POST /api/users/:username/password` |
| Lock/unlock account | `usermod -L / -U` | `POST /api/users/:username/lock` |
| Password aging (expiry, min/max days) | `chage` | `PATCH /api/users/:username/aging` |

### Group Management

| Fitur | Command | Endpoint |
|-------|---------|----------|
| List all groups | parse `/etc/group` | `GET /api/groups` |
| Create group | `groupadd` | `POST /api/groups` |
| Delete group | `groupdel` | `DELETE /api/groups/:groupname` |
| Modify group (rename, GID) | `groupmod` | `PATCH /api/groups/:groupname` |
| Add/remove user from group | `gpasswd -a / -d` | `POST /api/groups/:groupname/members` |

### Sudo / Permissions

| Fitur | Command | Endpoint |
|-------|---------|----------|
| List sudoers | parse `/etc/sudoers` + `/etc/sudoers.d/` | `GET /api/sudoers` |
| Grant sudo | write to `/etc/sudoers.d/` + `visudo -c` | `POST /api/sudoers` |
| Revoke sudo | remove from `/etc/sudoers.d/` | `DELETE /api/sudoers/:username` |

### System Info

| Fitur | Command | Endpoint |
|-------|---------|----------|
| Active sessions | `who` / `w` | `GET /api/sessions` |
| Last logins | `last` | `GET /api/logins` |

### WebSocket Events

- `users:changed` — broadcast when `/etc/passwd` or `/etc/shadow` changes
- `groups:changed` — broadcast when `/etc/group` changes

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
3. **Sudo** — list of users with sudo access and their rules. Grant/revoke buttons.
4. **Sessions** — currently logged-in users (`who`), recent logins (`last`).

### Interactions

- **Create/Edit** — modal dialogs with form fields
- **Delete** — confirmation dialog before executing
- **Real-time** — tables auto-update when WebSocket events fire

## Docker Setup

```dockerfile
# Multi-stage build
# Stage 1: Build React frontend
# Stage 2: Node.js runtime with built frontend

# Container must run with host user management access:
# docker run --privileged \
#   -v /etc/passwd:/etc/passwd \
#   -v /etc/shadow:/etc/shadow \
#   -v /etc/group:/etc/group \
#   -v /etc/sudoers:/etc/sudoers \
#   -v /etc/sudoers.d:/etc/sudoers.d \
#   -p 9998:9998 \
#   server-user-management
```

## Project Structure

```
server-user-management/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── server/
│   ├── index.js              # Express + socket.io setup
│   ├── routes/
│   │   ├── users.js          # User CRUD endpoints
│   │   ├── groups.js         # Group CRUD endpoints
│   │   ├── sudoers.js        # Sudo management endpoints
│   │   └── sessions.js       # Active sessions & logins
│   ├── services/
│   │   ├── userService.js    # Parse /etc/passwd, /etc/shadow, exec commands
│   │   ├── groupService.js   # Parse /etc/group, exec commands
│   │   ├── sudoService.js    # Parse /etc/sudoers, manage sudoers.d
│   │   └── sessionService.js # Parse who, w, last
│   └── watcher.js            # fs.watch on system files, emit socket events
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── theme/             # Dark terminal theme styles
│       ├── components/
│       │   ├── Layout.jsx     # Sidebar + main + status bar
│       │   ├── UserTable.jsx
│       │   ├── UserDetail.jsx
│       │   ├── UserForm.jsx   # Create/edit modal
│       │   ├── GroupTable.jsx
│       │   ├── GroupDetail.jsx
│       │   ├── GroupForm.jsx
│       │   ├── SudoersList.jsx
│       │   ├── SessionList.jsx
│       │   └── StatusBar.jsx
│       ├── hooks/
│       │   └── useSocket.js   # WebSocket connection hook
│       └── api/
│           └── client.js      # Axios/fetch wrapper for REST calls
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-21-linux-user-management-design.md
```

## Error Handling

- All command executions validate input (username format, no injection)
- Commands use `execFile` (not `exec`) to prevent shell injection
- API returns structured error responses: `{ error: string, detail?: string }`
- Frontend shows toast/notification on errors

## Security Notes

- No auth in v1 — intended for trusted networks only
- Input sanitization: usernames validated against `^[a-z_][a-z0-9_-]*$`
- `execFile` instead of `exec` to avoid command injection
- Sudoers changes validated with `visudo -c` before applying
