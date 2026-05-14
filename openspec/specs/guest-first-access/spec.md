# Guest-First Access Specification

## Purpose

Defines the guest-first access model. First-time users see an OnboardingFlow. After choosing guest mode, the app operates with free-tier limits. Authenticated users skip onboarding entirely.

## Architecture

- **OnboardingFlow**: `src/components/auth/OnboardingFlow.tsx` — Hero screen with two CTAs
- **State gate**: `hasCompletedOnboarding` in `authStore` — persisted via `localStorage`
- **Chat gate**: `authMode === "unauthenticated"` → ChatPanel shows CTA instead of ChatInput

## Requirements

### Requirement: OnboardingFlow for First-Time Guests

New unauthenticated users who haven't completed onboarding see the OnboardingFlow screen. The screen shows the brand, tagline "Vibecodea en español", and two buttons:
1. "Comenzar sin cuenta" — enters guest mode
2. "Iniciar sesión" — opens LoginScreen modal

#### Scenario: First visit — onboarding shown

- GIVEN `hasCompletedOnboarding === false` AND `authMode === "unauthenticated"`
- WHEN the app renders after `sessionDetected === true`
- THEN the OnboardingFlow screen is displayed
- AND the main workspace is NOT visible

#### Scenario: Guest entry

- GIVEN the OnboardingFlow is visible
- WHEN the user clicks "Comenzar sin cuenta"
- THEN `completeOnboarding()` is called
- AND the OnboardingFlow disappears
- AND the main workspace renders with ActivityBar + default chat sidebar

### Requirement: Authenticated Users Skip Onboarding

Users with a valid session detected via `/auth/me` automatically have `hasCompletedOnboarding` set to `true` during `detectSession()`, so they never see the OnboardingFlow.

#### Scenario: Returning authenticated user

- GIVEN a valid JWT cookie exists
- WHEN the app mounts
- THEN `detectSession()` sets `authMode = "authenticated"` and `hasCompletedOnboarding = true`
- AND the workspace renders immediately

### Requirement: Guest Chat Gate

Unauthenticated users see the MessageList (welcome screen with "¿Qué vamos a construir hoy?") but the ChatInput is replaced by a CTA block: "Despierta a Vibe AI para potenciar tu código" + "Iniciar Sesión" button.

#### Scenario: Guest opens chat panel

- GIVEN `authMode === "unauthenticated"`
- WHEN the chat sidebar is active
- THEN the ChatInput textarea is NOT rendered
- AND a CTA with "Despierta a Vibe AI" and "Iniciar Sesión" button is shown
- AND the welcome screen (starter prompts) is visible above the CTA

### Requirement: Guest Limits

Guest users have free-tier limits: 30 prompts/month, 8K character limit per prompt, no subagent access.

## Files

- `src/components/auth/OnboardingFlow.tsx`
- `src/stores/auth.ts` — `hasCompletedOnboarding`, `completeOnboarding()`
- `src/components/layout/ChatPanel.tsx` — Guest CTA conditional (lines 415-427)
- `src/App.tsx` — OnboardingFlow gate (lines 115-137)
