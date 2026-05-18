# Infrastructure Specification

## Purpose

SST v4 infrastructure-as-code for Vibe Studio backend. Defines all AWS resources (DynamoDB, Lambda, S3, Router) and their configuration. The Router provides a stable API domain (`api.opitacode.com`) that abstracts raw Lambda Function URLs.

## Architecture

- **Framework**: SST v4 (Ion) on AWS.
- **Config**: `sst.config.ts` — single file defining all infrastructure.
- **Stages**: `dev` (removal: remove) and `prod` (removal: retain).
- **Domain**: `api.opitacode.com` (prod) / `api-dev.opitacode.com` (dev).

## DynamoDB Tables

| Table | Hash Key | Range Key | TTL | Purpose |
|-------|----------|-----------|-----|---------|
| Conversations | `id` (string) | — | — | Chat session history |
| UserKeys | `id` (string) | — | — | BYOK encrypted API keys |
| Users | `email` (string) | — | — | User profiles, auth, plans |
| Projects | `client_id` (string) | `id` (string) | — | Project metadata |
| Transactions | `id` (string) | — | — | Wompi payment records |
| TokenUsage | `pk` (string) | `sk` (string) | `expiresAt` | Token limits + gamification data |

## Lambda Functions

| Function | Route | Streaming | CORS | Purpose |
|----------|-------|-----------|------|---------|
| ChatStreamAPI | `/chat/*` | ✅ | Origins whitelist | AI chat with SSE streaming |
| CoreAPI | `/core/*` | ❌ | Disabled (Router handles) | Auth, projects, usage, magic links |
| BillingAPI | `/billing/*` | ❌ | Disabled | Wompi checkout + webhooks |
| StorageAPI | `/storage/*` | ❌ | ❌ | S3 presigned URLs |
| SyncAPI | `/sync/*` | ✅ | Origins whitelist | Admin operations hub |

## Router

The `sst.aws.Router` ("VibeRouter") MUST proxy all API traffic through a stable domain.

### Requirements

### Requirement: Stable API Domain

All client-facing URLs MUST use `api.opitacode.com` (prod) or `api-dev.opitacode.com` (dev), NEVER raw Lambda Function URLs.

#### Scenario: Router proxies to CoreAPI
- GIVEN a request to `https://api.opitacode.com/core/auth/login`
- THEN the Router MUST proxy to the CoreAPI Lambda Function URL
- AND the Lambda receives the request with the original path.

### Requirement: CORS Configuration

CORS MUST be configured per-function for streaming endpoints (ChatStreamAPI, SyncAPI). Non-streaming endpoints (CoreAPI, BillingAPI) MUST disable CORS at the function level (the Router handles it).

#### Scenario: Allowed origins
- The following origins MUST be allowed:
  - `https://vibe.opitacode.com`
  - `https://opitacode.com`
  - `https://cuenta.opitacode.com`
  - `http://localhost:1420` (Tauri dev)

### Requirement: Environment Variables

Secrets MUST be passed as environment variables from GitHub Secrets → SST → Lambda. The `sst.config.ts` MUST use `process.env.X || ""` pattern with sensible defaults.

| Variable | Function | Default |
|----------|----------|---------|
| JWT_SECRET | CoreAPI, ChatAPI, SyncAPI | — |
| SES_FROM_EMAIL | CoreAPI | `noreply@opitacode.com` |
| STABLE_API_DOMAIN | CoreAPI | `api.opitacode.com` |
| FRONTEND_URL | CoreAPI | Stage-dependent |
| API_GOOGLE_CLOUD | ChatAPI, SyncAPI | — |
| WOMPI_WEBHOOK_SECRET | BillingAPI | — |
| ADMIN_EMAILS | SyncAPI | — |

### Requirement: SES Permissions

The CoreAPI Lambda MUST have IAM permissions for `ses:SendEmail` and `ses:SendRawEmail` on all resources.

### Requirement: S3 Storage

The VibeStorage bucket MUST be configured with CORS allowing all Opita Code origins for file uploads.

## Deployment

Production deploys MUST go through GitHub Actions CI (never local `sst deploy --stage prod`). Three separate path-filtered pipelines exist for backend, landing, and web app.

## Files

- `sst.config.ts` — All infrastructure definitions.
- `.github/workflows/deploy-backend.yml` — CI pipeline for SST deploy.
