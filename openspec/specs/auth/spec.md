# Auth Specification

## Purpose

Dual authentication for Vibe Studio: AWS Cognito (primary, via cuenta.opitacode.com) and legacy Magic Links (fallback). No login gate — the app MUST open to OnboardingFlow for first-time guests.

## Architecture

- **Identity Provider**: AWS Cognito User Pool (cuenta.opitacode.com handles login UI).
- **Legacy Fallback**: AWS Lambda (`CoreAPI`) Magic Links via SES.
- **Token**: Cognito ID Token stored as `.opitacode.com` cookie (`opita_id_token`).
- **Backend Verification**: JWKS validation for Cognito JWTs, HMAC fallback for legacy.
- **Frontend**: `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`, `logout()`.
- **Store**: `src/stores/auth.ts` — Zustand store with `AuthMode`, `UserProfile`, `Session`.

## Requirements

### Requirement: Cognito-Based Authentication (Primary)

The system MUST authenticate users via AWS Cognito, redirecting to `cuenta.opitacode.com` for login. After Cognito auth, an `opita_id_token` cookie SHALL be set on the `.opitacode.com` domain for cross-subdomain SSO.

#### Scenario: User initiates login
- GIVEN the app is in guest mode
- WHEN the user clicks "Iniciar sesión"
- THEN the system MUST call `initiateSSO()` to redirect to `cuenta.opitacode.com/login?postAuthUrl=...&service=vibe-studio`
- AND after Cognito login, the user SHALL be redirected back with the cookie set.

#### Scenario: Session restored from Cognito cookie
- GIVEN an `opita_id_token` cookie exists on `.opitacode.com`
- WHEN the app mounts and `restoreSession()` runs
- THEN the system MUST decode the JWT client-side to extract `email` and `custom:plan`
- AND `authMode` MUST be set to `"authenticated"`
- AND the token SHALL be passed to `aiService.ts` for Lambda auth.

### Requirement: Legacy Magic Link Fallback

If no Cognito cookie exists, the system SHALL fall back to calling `GET /auth/me` with `credentials: "include"` to check for legacy `opita_session` cookies.

#### Scenario: Legacy session detection
- GIVEN no `opita_id_token` cookie exists but an `opita_session` cookie exists
- WHEN `restoreSession()` runs
- THEN the system MUST call `GET /auth/me` to validate the legacy JWT
- AND `authMode` MUST be set to `"authenticated"`.

### Requirement: Silent Session Detection

On app mount, `restoreSession()` MUST check the Cognito cookie first, then the legacy fallback. If neither exists, guest mode SHALL be maintained.

#### Scenario: No session — guest mode
- GIVEN no cookies exist
- WHEN `restoreSession()` runs
- THEN `authMode` MUST stay `"unauthenticated"`
- AND `sessionDetected` MUST be set to `true` (stops loading spinner).

### Requirement: Login Screen as Modal

The LoginScreen MUST render as a modal overlay, NOT as a startup gate. It SHALL be triggered from OnboardingFlow or ActivityBar.

### Requirement: Logout Clears Cross-Domain State

#### Scenario: Logout flow
- GIVEN an authenticated user
- WHEN logout is triggered from the ActivityBar avatar
- THEN the `opita_id_token` cookie MUST be cleared on `.opitacode.com`
- AND the `opita_session` cookie MUST be cleared (legacy)
- AND `authMode` MUST transition to `"unauthenticated"`
- AND the main UI SHALL remain accessible with guest-tier limits.

### Requirement: User Plans (Source of Truth: Cognito)

The user's plan MUST be stored in the Cognito `custom:plan` attribute. The three tiers SHALL be: `free`, `estudiante`, `pro`. The backend Lambda MUST verify the JWT and read the plan from the token claims.

### Requirement: Intent-Aware Auth Flow

`initiateSSO()` MUST preserve the `postAuthUrl` so users return to their pre-login context (e.g., checkout, specific feature).

#### Scenario: Purchase intent preserved
- GIVEN a user clicks "Upgrade" while unauthenticated
- WHEN `initiateSSO({ postAuthUrl: '/app?intent=upgrade' })` is called
- THEN after login, the user MUST return to `/app?intent=upgrade`
- AND the app MUST detect the intent and trigger the Wompi upgrade flow.

## Files

- `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`, `logout()`, `getCookie()`, `decodeJWT()`.
- `src/stores/auth.ts` — AuthStore (user, session, plan, tokenUsage, fetchTokenUsage).
- `src/components/auth/LoginScreen.tsx` — Magic link login modal (legacy).
- `src/components/auth/OnboardingFlow.tsx` — First-time guest flow.
- `packages/vibe-ai-backend/src/api/core.ts` — `/auth/request`, `/auth/me`, `/auth/verify` + JWKS validation.
