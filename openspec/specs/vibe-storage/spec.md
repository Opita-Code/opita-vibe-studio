# Vibe Storage Specification

## Purpose

S3-backed storage service providing presigned URLs for cloud sync (project backups) and generic file uploads (chat attachments). Authenticated via JWT.

## Architecture

- **Backend**: `packages/vibe-ai-backend/src/api/storage.ts` — Lambda handler.
- **Storage**: S3 bucket `VibeStorage` (configured in `sst.config.ts`).
- **Route**: `POST /storage/*` via SST Router.
- **Auth**: Bearer JWT (HMAC verified with `JWT_SECRET`).

## Object Key Patterns

| Action | Key Pattern | Content-Type |
|--------|------------|-------------|
| Cloud Sync (upload/download) | `projects/{userId}/{projectId}.zip` | `application/zip` |
| Generic Upload | `uploads/{userId}/{uuid}-{filename}` | User-provided |

## Requirements

### Requirement: Cloud Sync (Projects)

The system MUST support project backup/restore via presigned S3 URLs.

#### Scenario: Upload project
- GIVEN an authenticated user with `projectId`
- WHEN `POST /storage` with `{ action: "upload", projectId }` is called
- THEN the system MUST sanitize `projectId` (only alphanumeric and hyphens)
- AND generate a PutObject presigned URL (1 hour TTL)
- AND return `{ uploadUrl, objectKey }`.

#### Scenario: Download project
- GIVEN an authenticated user with `projectId`
- WHEN `POST /storage` with `{ action: "download", projectId }` is called
- THEN the system MUST generate a GetObject presigned URL (1 hour TTL)
- AND return `{ downloadUrl, objectKey }`.

### Requirement: Generic File Upload (Chat Attachments)

The system MUST support arbitrary file uploads with unique keys.

#### Scenario: File upload
- GIVEN an authenticated user with `filename` and `contentType`
- WHEN `POST /storage` with `{ filename, contentType }` is called
- THEN the system MUST generate a UUID-prefixed object key under `uploads/{userId}/`
- AND return `{ uploadUrl, fileUrl, objectKey }`.

### Requirement: Authentication

All storage operations MUST require a valid Bearer JWT token. Invalid or missing tokens MUST return `401`.

### Requirement: Path Safety

Project IDs MUST be sanitized: only `[a-zA-Z0-9_-]` characters allowed. This prevents path traversal attacks.

### Requirement: CORS

The StorageAPI MUST allow requests from all `*.opitacode.com` subdomains and `localhost:*` for development.

## Files

- `packages/vibe-ai-backend/src/api/storage.ts` — Storage Lambda handler.
- `sst.config.ts` — VibeStorage S3 bucket and StorageAPI Lambda.
