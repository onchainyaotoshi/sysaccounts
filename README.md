# SysAccounts

Web-based Linux server user management tool. Manage users, groups, sudoers, and sessions through a browser interface. Authenticated via Yaotoshi Accounts (OAuth 2.0 PKCE).

## Features

- **Users** — Create, view, delete users. Change passwords, lock/unlock, manage aging.
- **Groups** — Create, view, delete groups. Multi-select member management.
- **Sudoers** — View and manage sudo rules (`/etc/sudoers.d/`)
- **Sessions** — View active sessions (`who`), recent logins (`last`), kill sessions
- **Real-time** — WebSocket file watchers push updates on `/etc/passwd`, `/etc/group` changes
- **Auth** — OAuth 2.0 PKCE login via Yaotoshi Accounts

## Tech Stack

| Layer    | Tech                                    |
|----------|-----------------------------------------|
| Frontend | React 18, Vite, React Router            |
| Backend  | Node.js, Express, Socket.IO             |
| Auth     | @yaotoshi/auth-sdk (OAuth 2.0 PKCE)     |
| Runtime  | Docker (privileged, host PID)            |
| Testing  | Jest, Supertest                          |

## Quick Start

### Development

```bash
npm install

# Copy env example and configure (optional — auth skipped if not set)
cp .env.example .env

# Start backend (port 9998)
npm run dev

# Start frontend dev server (separate terminal)
npm run dev:client

# Run tests
npm test
```

### Production (Docker)

```bash
# Configure OAuth
cp .env.example .env
# Edit .env with real values

# Build and run
docker compose up -d --build

# Access at http://localhost:9998
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 9998) |
| `HOST` | No | Bind address (default: 127.0.0.1) |
| `ACCOUNTS_URL` | For auth | Yaotoshi Accounts URL |
| `OAUTH_CLIENT_ID` | For auth | OAuth client ID |
| `OAUTH_REDIRECT_URI` | For auth | OAuth callback URL |
| `OAUTH_POST_LOGOUT_REDIRECT_URI` | For auth | Post-logout redirect URL |

## API Endpoints

All `/api/*` endpoints require `Authorization: Bearer <token>` when auth is enabled.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| DELETE | `/api/users/:username` | Delete user |
| POST | `/api/users/:username/password` | Change password |
| POST | `/api/users/:username/lock` | Lock/unlock user |
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| DELETE | `/api/groups/:name` | Delete group |
| POST | `/api/groups/:name/members` | Add members |
| DELETE | `/api/groups/:name/members/:user` | Remove member |
| GET | `/api/sudoers` | List sudo rules |
| POST | `/api/sudoers` | Grant sudo |
| DELETE | `/api/sudoers/:username` | Revoke sudo |
| GET | `/api/sessions` | Active sessions |
| GET | `/api/sessions/logins` | Recent logins |
| DELETE | `/api/sessions/:terminal` | Kill session |
| GET | `/auth/config` | OAuth config (public) |
| POST | `/auth/proxy/token` | OAuth token exchange (proxy) |
| GET | `/auth/proxy/me` | User info (proxy) |
| POST | `/auth/proxy/logout` | Logout (proxy) |

## Docker Notes

The container runs in privileged mode with host PID namespace to manage system users. It mounts `/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/sudoers`, `/home`, and login records.

Port is bound to `127.0.0.1:9998` by default — use a reverse proxy for external access.
