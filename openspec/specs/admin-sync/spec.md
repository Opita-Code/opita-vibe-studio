# Admin Sync Specification

## Purpose

AI-powered operations hub for Opita Code platform administration. Uses the same streaming engine as Vibe Studio but with server-side admin tools (DynamoDB, Cognito, SES operations). Accessible only to authorized administrators via role-based access control.

## Architecture

- **Backend**: `packages/vibe-ai-backend/src/api/admin.ts` — Streaming Lambda with admin tools.
- **Frontend**: Opita Sync web app (`sync.opitacode.com`).
- **Auth**: JWKS (Cognito) + HMAC JWT fallback + admin email whitelist.
- **AI**: Gemini 2.5 Flash via Vercel AI SDK (`streamText` with `maxSteps: 5`).
- **Route**: `POST /sync/*` via SST Router.

## Admin Roles

| Role | Read | Write (Plans) | Manage Roles | Scope |
|------|------|---------------|-------------|-------|
| `superadmin` | ✅ | ✅ | ✅ | Platform-wide |
| `product_admin` | ✅ | ✅ | ❌ | Platform-wide |
| `support` | ✅ | ❌ | ❌ | Platform-wide |
| `viewer` | ✅ | ❌ | ❌ | Tenant-scoped |

### Role Resolution
1. Check `ADMIN_EMAILS` env var (comma-separated) → `superadmin`.
2. Check `admin_role` field in DynamoDB Users table.
3. No match → access denied.

## Admin Tools

### Read-Only (All Roles)

| Tool | Description |
|------|-------------|
| `list_users` | Scan users with plan filter and text search |
| `get_user` | Get user detail by email |
| `get_usage_overview` | Per-user or global token usage stats |
| `list_transactions` | List payment transactions |
| `system_health` | DynamoDB table counts and system state |

### Write (superadmin + product_admin)

| Tool | Description |
|------|-------------|
| `update_user_plan` | Change user plan (free/estudiante/pro) with optional trial days |
| `set_admin_role` | Assign or revoke admin role (superadmin only) |

## Requirements

### Requirement: Admin Authentication

The system MUST verify admin identity via JWKS (Cognito) or HMAC JWT, then check admin role authorization.

#### Scenario: Non-admin user denied
- GIVEN a user with valid JWT but no admin role
- WHEN they call any `/sync/*` endpoint
- THEN the system MUST return `"Acceso denegado. No tienes permisos de administrador."`.

### Requirement: Streaming Chat Interface

Admin chat MUST use SSE streaming with multi-turn tool execution (`maxSteps: 5`).

#### Scenario: Admin asks for user list
- GIVEN a superadmin sends "¿Cuántos usuarios Pro hay?"
- WHEN the AI processes the message
- THEN it MUST call `list_users` tool with `plan_filter: "pro"`
- AND stream the response with markdown tables.

### Requirement: Whoami Action

`POST /sync` with `action: "whoami"` MUST return `{ email, role, plan }` without invoking AI.

### Requirement: System Prompt

The admin system prompt MUST:
- Identify itself as "Opita Sync"
- Include operator context (email, role, scope)
- Confirm destructive actions before executing
- Use español neutro profesional
- NEVER expose password hashes or full tokens.

### Requirement: CORS Origins

The SyncAPI MUST allow requests from:
- `https://sync.opitacode.com`
- `https://admin.opitacode.com` (legacy alias)
- `http://localhost:5174` and `http://localhost:5175` (dev).

## Files

- `packages/vibe-ai-backend/src/api/admin.ts` — Admin Lambda handler, tools, role resolution, streaming.
- `sst.config.ts` — SyncAPI Lambda and `/sync/*` Router route.
