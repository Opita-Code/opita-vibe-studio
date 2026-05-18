# Auth Specification

## Purpose

Multi-strategy authentication for Vibe Studio: Password-based (primary), Magic Links (secondary), and AWS Cognito SSO (cross-product). No login gate — the app MUST open to OnboardingFlow for first-time guests.

## Architecture

- **Identity Provider (Primary)**: Custom password auth via CoreAPI Lambda (`scryptSync` hashing).
- **Identity Provider (Secondary)**: Magic Links via SES with shortened URLs (`go.opitacode.com`).
- **Identity Provider (SSO)**: AWS Cognito User Pool (cuenta.opitacode.com handles login UI).
- **Token**: HMAC JWT stored as `.opitacode.com` cookie (`opita_session`). Cognito ID Token as `opita_id_token`.
- **Backend Verification**: JWKS validation for Cognito JWTs, HMAC for custom JWTs.
- **Frontend**: `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`, `logout()`.
- **Store**: `src/stores/auth.ts` — Zustand store with `AuthMode`, `UserProfile`, `Session`.
- **Email Sender**: `noreply@opitacode.com` via AWS SES with Custom MAIL FROM (`mail.opitacode.com`).

## Requirements

### Requirement: Password-Based Authentication (Primary)

The system MUST support email+password registration and login as the primary auth method.

#### Scenario: User registers with password
- GIVEN a guest user on the login screen
- WHEN they submit email, password (min 8 chars), and optional name
- THEN `POST /core/auth/register` MUST hash the password with `scryptSync` + random salt
- AND create or upsert the user in DynamoDB Users table
- AND return a `opita_session` JWT cookie (7 day TTL, `Domain=.opitacode.com`, `HttpOnly`, `Secure`, `SameSite=None`)
- AND respond with `{ message, user: { email, name, plan } }`.

#### Scenario: User logs in with password
- GIVEN a registered user with password
- WHEN they submit email+password via `POST /core/auth/login`
- THEN the system MUST verify the password against stored `password_hash` + `password_salt`
- AND on success, return a session cookie and update `last_login`
- AND on failure, return `401` with `"Credenciales inválidas"`.

#### Scenario: Magic-link-only user tries password login
- GIVEN a user who registered via magic link (no `password_hash`)
- WHEN they attempt password login
- THEN the system MUST return `401` with `"Esta cuenta usa enlace mágico. Solicita uno o regístrate con contraseña."`.

### Requirement: Login Screen with Dual Tabs

The LoginScreen MUST render as a modal with two tabs: "Contraseña" (default) and "Enlace Mágico".

#### Scenario: Tab switching
- GIVEN the LoginScreen modal is open
- WHEN the user clicks "Enlace Mágico" tab
- THEN the UI MUST switch to magic link input mode
- AND clicking "Contraseña" MUST switch back to email+password fields.

### Requirement: Magic Link Authentication

The system MUST support passwordless login via time-limited magic links sent through SES.

#### Scenario: Magic link request
- GIVEN a user submits their email for magic link
- WHEN `POST /core/auth/request` is called with `{ email, service, redirectTo }`
- THEN the system MUST generate a JWT token (15 min TTL) with JTI for replay protection
- AND construct the verify URL as `https://{STABLE_API_DOMAIN}/core/auth/verify?token=...`
- AND shorten the URL via Opita Links (`go.opitacode.com`) with 900s TTL
- AND send the email from `noreply@opitacode.com` with `ReplyToAddresses: ["owner@opitacode.com"]`
- AND the email MUST use the branded HTML template with service-specific copy.

#### Scenario: Magic link verify
- GIVEN a user clicks the magic link
- WHEN `GET /core/auth/verify?token=...` is called
- THEN the system MUST validate the JWT and check JTI replay protection in DynamoDB
- AND mark the JTI as used (`id: "used-jti#{jti}"`)
- AND set the `opita_session` cookie on `.opitacode.com`
- AND redirect to the `redirectTo` URL.

### Requirement: Email Deliverability

The system MUST ensure magic link emails reach the inbox (not spam).

#### Scenario: SPF alignment
- GIVEN SES sends from `noreply@opitacode.com`
- THEN the `Return-Path` MUST use `mail.opitacode.com` (Custom MAIL FROM domain)
- AND `mail.opitacode.com` MUST have MX record → `feedback-smtp.us-east-1.amazonses.com`
- AND `mail.opitacode.com` MUST have TXT record → `v=spf1 include:amazonses.com ~all`
- AND DKIM MUST be enabled and verified for `opitacode.com`.

### Requirement: Verify URL Domain Stability

Magic link verify URLs MUST always use `api.opitacode.com` (the SST Router domain), NEVER the raw Lambda Function URL.

#### Scenario: URL construction
- GIVEN a magic link is being generated
- THEN the verify URL MUST be `https://api.opitacode.com/core/auth/verify?token=...`
- AND the `STABLE_API_DOMAIN` environment variable MUST be set to `api.opitacode.com`
- AND `event.requestContext.domainName` MUST NOT be used (it returns the Lambda URL behind the Router).

### Requirement: Cognito-Based SSO (Cross-Product)

The system MUST authenticate users via AWS Cognito for cross-product SSO (e.g., `cuenta.opitacode.com`).

#### Scenario: Session restored from Cognito cookie
- GIVEN an `opita_id_token` cookie exists on `.opitacode.com`
- WHEN the app mounts and `restoreSession()` runs
- THEN the system MUST decode the JWT client-side to extract `email` and `custom:plan`
- AND `authMode` MUST be set to `"authenticated"`.

### Requirement: Silent Session Detection

On app mount, `restoreSession()` MUST check: Cognito cookie → legacy session cookie → guest mode.

#### Scenario: No session — guest mode
- GIVEN no cookies exist
- WHEN `restoreSession()` runs
- THEN `authMode` MUST stay `"unauthenticated"`
- AND `sessionDetected` MUST be set to `true` (stops loading spinner).

### Requirement: Logout Clears Cross-Domain State

#### Scenario: Logout flow
- GIVEN an authenticated user
- WHEN logout is triggered
- THEN both `opita_id_token` and `opita_session` cookies MUST be cleared on `.opitacode.com`
- AND `authMode` MUST transition to `"unauthenticated"`.

### Requirement: User Plans (Source of Truth: DynamoDB + Cognito)

The user's plan MUST be stored in DynamoDB Users table (`plan` field) and optionally in Cognito `custom:plan`. Tiers: `free`, `estudiante`, `pro`.

### Requirement: Intent-Aware Auth Flow

`initiateSSO()` MUST preserve the `postAuthUrl` so users return to their pre-login context.

## Files

- `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`, `logout()`, `getCookie()`, `decodeJWT()`.
- `src/stores/auth.ts` — AuthStore (user, session, plan, tokenUsage, fetchTokenUsage).
- `src/components/auth/LoginScreen.tsx` — Dual-tab login modal (Password + Magic Link).
- `src/components/auth/OnboardingFlow.tsx` — First-time guest flow.
- `packages/vibe-ai-backend/src/api/core.ts` — `/auth/register`, `/auth/login`, `/auth/request`, `/auth/me`, `/auth/verify` + JWKS validation.
- `sst.config.ts` — CoreAPI Lambda with `STABLE_API_DOMAIN`, `SES_FROM_EMAIL`, `JWT_SECRET`.
