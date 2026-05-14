# Auth Specification

## Purpose

Authentication for Vibe Studio using AWS SES Magic Links with custom JWT tokens. No login gate — the app opens to an OnboardingFlow for first-time guests, then operates in guest or authenticated mode.

## Architecture

- **Backend**: AWS Lambda (`CoreAPI`) at `api.opitacode.com`
- **Token**: Custom HMAC-signed JWT stored via `httpOnly` cookie (`opita_session`)
- **Email delivery**: AWS SES sends magic link to user's email
- **Frontend**: `src/auth/sso.ts` — `initiateSSO()` and `restoreSession()`
- **Store**: `src/stores/auth.ts` — Zustand store with `AuthMode`, `UserProfile`, `Session`

## Requirements

### Requirement: Magic Link Authentication

The system MUST authenticate users via AWS SES magic links. The user enters their email, receives a link, and clicking the link sets a JWT cookie that the frontend reads via `/auth/me`.

#### Scenario: User requests magic link

- GIVEN the app is in guest mode
- WHEN the user enters their email and clicks "Enviar enlace mágico"
- THEN `POST /auth/request` is called with `{ email, redirectTo }`
- AND AWS SES sends an email with a magic link
- AND the UI shows a success message "Revisa tu correo"

#### Scenario: User completes magic link flow

- GIVEN the user clicked the magic link from their email
- WHEN the redirect lands on the frontend with a token parameter
- THEN the backend sets an `httpOnly` cookie `opita_session`
- AND the frontend calls `GET /auth/me` to verify the session
- AND if valid, `authMode` transitions to `"authenticated"`

### Requirement: Silent Session Detection

On app mount, `detectSession()` calls `GET /auth/me` with `credentials: "include"`. If a valid JWT cookie exists, the user is silently authenticated. If not, the app stays in guest mode.

#### Scenario: Session restored on mount

- GIVEN a valid `opita_session` cookie exists
- WHEN the app mounts and `detectSession()` runs
- THEN `GET /auth/me` returns `{ user: { email, plan } }`
- AND `authMode` is set to `"authenticated"`
- AND `hasCompletedOnboarding` is set to `true`

#### Scenario: No session — guest mode

- GIVEN no `opita_session` cookie exists
- WHEN `detectSession()` runs
- THEN `GET /auth/me` returns 401
- AND `authMode` stays `"unauthenticated"`
- AND `sessionDetected` is set to `true` (stops loading spinner)

### Requirement: Login Screen as Modal

The LoginScreen renders as a modal overlay, NOT a startup gate. It is triggered from the OnboardingFlow or the ActivityBar login button. Brand presence (Vibe Studio logo + tagline) MUST be preserved.

#### Scenario: Login modal from onboarding

- GIVEN the OnboardingFlow is visible
- WHEN user clicks "Iniciar sesión"
- THEN LoginScreen renders as a modal over the OnboardingFlow
- AND the user can close it to return to onboarding

### Requirement: Logout Returns to Guest Mode

On logout, the frontend clears the JWT cookie and transitions to guest mode. The app MUST NOT navigate to a login screen.

#### Scenario: Logout flow

- GIVEN authenticated user
- WHEN logout is triggered from the ActivityBar avatar
- THEN `authMode` transitions to `"unauthenticated"`
- AND the main UI remains accessible with guest-tier limits

### Requirement: User Plans

The system supports three plans: `free`, `estudiante`, `pro`. The plan is returned from `/auth/me` and stored in `authStore.plan`. Plan-specific behavior is enforced in the frontend (prompt limits, model access, subagent toggle).

## Files

- `src/auth/sso.ts` — `initiateSSO()`, `restoreSession()`
- `src/stores/auth.ts` — AuthStore (user, session, plan, tokenUsage)
- `src/components/auth/LoginScreen.tsx` — Magic link login modal
- `src/components/auth/OnboardingFlow.tsx` — First-time guest flow
- `packages/vibe-ai-backend/src/api/core.handler` — `/auth/request`, `/auth/me`, `/auth/verify`
