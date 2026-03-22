# README Mermaid Diagrams — Design Spec

## Goal

Add 4 Mermaid diagrams to README.md so first-time users deploying SysAccounts on their server can visually understand the system architecture and key flows.

## Target Audience

Users deploying SysAccounts for the first time on their own Linux server. Non-deep-technical; focused on practical understanding.

## Format

- Mermaid diagrams (renders natively on GitHub)
- Embedded directly in README.md at relevant sections
- Approach: diagrams placed near contextual sections (not centralized)

## Diagrams

### 1. Architecture Overview

**Placement:** New section "Architecture" after "Features", before "Requirements".

**Type:** `graph TD`

**Content:**
- Browser → Nginx reverse proxy → Docker Container
- Inside container: React SPA (static files) + Express API + Socket.IO
- Express API → Services Layer → `nsenter` → Host OS files (`/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/sudoers`, `/home`)
- Chokidar Watcher monitors host files → Socket.IO → Browser (real-time updates)
- Express API → OAuth Provider (accounts service) for token validation

**Purpose:** Show all major components and how they connect. Explains why the container needs privileged mode and host file mounts.

### 2. Deploy Flow

**Placement:** Top of "Setup" section, before step-by-step instructions.

**Type:** `flowchart LR` (horizontal)

**Content:**
- Clone repo → Copy .env.example → Edit .env (port, OAuth) → docker compose up --build → App running on 127.0.0.1:PORT
- Branch: With auth? → Yes → Setup accounts service + reverse proxy with HTTPS
- Branch: With auth? → No → Ready (dev/testing only)

**Purpose:** Quick visual overview of the deploy process before diving into details.

### 3. How It Works (User Management Flow)

**Placement:** New section "How It Works" after "Setup".

**Type:** `sequenceDiagram`

**Content:**
- Browser → Express API: POST /api/users (+ Bearer token)
- Express API → Auth Middleware: Validate token
- Auth Middleware → Accounts Service: GET /me
- Express API → Validator: Validate input
- Express API → UserService: createUser()
- UserService → Executor: execute('useradd', args)
- Executor → Host OS: nsenter → useradd
- Host OS → Executor: exit code 0
- Express API → Browser: 201 Created
- /etc/passwd changed → Chokidar detects → Socket.IO broadcasts users:changed → Browser auto-refreshes

**Purpose:** Full lifecycle of a user action — request, validation, system command, response, real-time update. Explains the privileged container requirement and auto-refresh behavior.

### 4. Auth Flow (OAuth PKCE)

**Placement:** New section "Auth Flow" after "How It Works".

**Type:** `sequenceDiagram`

**Content:**
- Browser → Express: GET /auth/config (get OAuth settings)
- Browser → Accounts Service: /authorize with code_challenge + state (PKCE)
- Accounts Service → Browser: Login page → user authenticates → redirect with auth code
- Browser → Express: POST /auth/proxy/token (code + code_verifier)
- Express → Accounts Service: Forward token request
- Accounts Service → Express → Browser: access_token
- Browser stores token, app ready
- Subsequent API requests: Bearer token in header
- Express validates token against Accounts Service (cached 5 min)

**Purpose:** Explains why ACCOUNTS_URL, OAUTH_CLIENT_ID, and OAUTH_REDIRECT_URI need to be configured in .env.

## README Structure (after changes)

1. Title + description
2. Features
3. **Architecture** (new — diagram 1)
4. Requirements
5. Setup
   - **Deploy flow diagram** (new — diagram 2)
   - Steps 1–4 (existing)
6. **How It Works** (new — diagram 3)
7. **Auth Flow** (new — diagram 4)
8. Updating
9. Environment Variables
10. Security
11. License

## Out of Scope

- No changes to existing README content (only additions)
- No separate documentation files
- No non-Mermaid diagram formats
