# Auth Specification

## Purpose

Dual authentication for Vibe Studio: AWS Cognito (primary, via cuenta.opitacode.com) and legacy Magic Links (fallback). No login gate — the app opens to OnboardingFlow for first-time guests.

## Architecture

- **Identity Provider**: AWS Cognito User Pool (cuenta.opitacode.com handles login UI)
- **Legacy Fallback**: AWS Lambda (`CoreAPI`) Magic Links via SES
- **Token**: Cognito ID Token stored as `.opitacode.com` cookie (`opita_id_token`)
- **Backend Verification**: JWKS validation for Cognito JWTs, HMAC fallback for legacy
- **Frontend**: `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`, `logout()`
- **Store**: `src/stores/auth.ts` — Zustand store with `AuthMode`, `UserProfile`, `Session`

## Requirements

### Requirement: Cognito-Based Authentication (Primary)

The system MUST authenticate users via AWS Cognito, redirecting to cuenta.opitacode.com for login. After Cognito auth, an `opita_id_token` cookie is set on `.opitacode.com` domain for cross-subdomain SSO.

#### Scenario: User initiates login
- GIVEN the app is in guest mode
- WHEN the user clicks "Iniciar sesión"
- THEN `initiateSSO()` redirects to `cuenta.opitacode.com/login?postAuthUrl=...&service=vibe-studio`
- AND after Cognito login, the user is redirected back with the cookie set

#### Scenario: Session restored from Cognito cookie
- GIVEN an `opita_id_token` cookie exists on `.opitacode.com`
- WHEN the app mounts and `restoreSession()` runs
- THEN the JWT is decoded client-side to extract `email`, `custom:plan`
- AND `authMode` is set to `"authenticated"`
- AND the token is passed to `aiService.ts` for Lambda auth

### Requirement: Legacy Magic Link Fallback

If no Cognito cookie exists, the system falls back to calling `GET /auth/me` with `credentials: "include"` to check for legacy `opita_session` cookies.

#### Scenario: Legacy session detection
- GIVEN no `opita_id_token` cookie but `opita_session` cookie exists
- WHEN `restoreSession()` runs
- THEN `GET /auth/me` validates the legacy JWT
- AND `authMode` is set to `"authenticated"`

### Requirement: Silent Session Detection

On app mount, `restoreSession()` checks Cognito cookie first, then legacy fallback. If neither exists, guest mode is maintained.

#### Scenario: No session — guest mode
- GIVEN no cookies exist
- WHEN `restoreSession()` runs
- THEN `authMode` stays `"unauthenticated"`
- AND `sessionDetected` is set to `true` (stops loading spinner)

### Requirement: Login Screen as Modal

The LoginScreen renders as a modal overlay, NOT a startup gate. Triggered from OnboardingFlow or ActivityBar.

### Requirement: Logout Clears Cross-Domain State

#### Scenario: Logout flow
- GIVEN authenticated user
- WHEN logout is triggered from ActivityBar avatar
- THEN `opita_id_token` cookie is cleared on `.opitacode.com`
- AND `opita_session` cookie is cleared (legacy)
- AND `authMode` transitions to `"unauthenticated"`
- AND main UI remains accessible with guest-tier limits

### Requirement: User Plans (Source of Truth: Cognito)

Plan is stored in Cognito `custom:plan` attribute. Three tiers: `free`, `estudiante`, `pro`. The backend Lambda verifies the JWT and reads the plan from the token claims.

### Requirement: Intent-Aware Auth Flow

`initiateSSO()` preserves `postAuthUrl` so users return to their pre-login context (e.g., checkout, specific feature).

#### Scenario: Purchase intent preserved
- GIVEN user clicks "Upgrade" while unauthenticated
- WHEN `initiateSSO({ postAuthUrl: '/app?intent=upgrade' })` is called
- THEN after login, user returns to `/app?intent=upgrade`
- AND the app detects the intent and triggers the upgrade flow

## Files

- `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`, `logout()`, `getCookie()`, `decodeJWT()`
- `src/stores/auth.ts` — AuthStore (user, session, plan, tokenUsage, fetchTokenUsage)
- `src/components/auth/LoginScreen.tsx` — Magic link login modal (legacy)
- `src/components/auth/OnboardingFlow.tsx` — First-time guest flow
- `packages/vibe-ai-backend/src/api/core.ts` — `/auth/request`, `/auth/me`, `/auth/verify` + JWKS validation
