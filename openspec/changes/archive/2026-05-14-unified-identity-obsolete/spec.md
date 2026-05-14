# unified-identity Specification

## Purpose

Real authentication via Supabase Auth (Google OAuth + email OTP). Global user ID (`auth.uid()`) shared across Opita platforms. Migration path from mock guest accounts to real identities.

## Requirements

### Requirement: Supabase OAuth Authentication

The system MUST authenticate users via Supabase Auth supporting Google OAuth and email OTP. Auth flow SHALL use the system browser for OAuth. Tokens MUST be Supabase-issued JWT with `sub` claim as the global user ID.

#### Scenario: Google OAuth login

- GIVEN the app is in guest mode
- WHEN user clicks "Iniciar sesión con Google"
- THEN system browser opens Supabase OAuth consent screen
- AND on completion, Supabase JWT access + refresh tokens are stored

#### Scenario: Email OTP login

- GIVEN user enters email address
- WHEN Supabase sends OTP to email and user enters correct OTP
- THEN session is established with JWT tokens

### Requirement: Global User ID

Every authenticated user MUST have a persistent UUID (`auth.uid()`) from Supabase. This ID SHALL be the canonical identity across all Opita platforms.

#### Scenario: Consistent identity across platforms

- GIVEN user authenticated via Supabase Auth in Vibe Studio
- WHEN same user logs into opita-os (future)
- THEN `auth.uid()` matches across both platforms, enabling cross-product context

### Requirement: Mock-to-Real Migration

Existing guest accounts with email associations MUST auto-migrate to Supabase Auth on first login. Local preferences SHALL merge with cloud context post-migration.

#### Scenario: Guest upgrades to real account with matching email

- GIVEN guest used app with localStorage preferences and email `user@example.com`
- WHEN user completes Supabase OAuth with `user@example.com`
- THEN local Zustand preferences are pushed to `cloud_context` table
- AND localStorage guest token is removed and replaced by Supabase JWT session

#### Scenario: Different email — no migration

- GIVEN guest with mock email `old@example.com` and localStorage data
- WHEN user authenticates via Supabase with `new@example.com`
- THEN previous localStorage preferences are NOT migrated
- AND a fresh cloud context is initialized for the new account

### Requirement: JWT Token Management

The system MUST manage Supabase JWT tokens with automatic refresh. Expired access tokens SHALL be refreshed silently via Supabase SDK without user intervention.

#### Scenario: Automatic token refresh

- GIVEN access token expires in less than 60 seconds
- WHEN Supabase SDK `onAuthStateChange` detects SIGNED_IN event
- THEN a new access token is obtained via the refresh token
- AND the user session remains uninterrupted without re-authentication prompt
