# Delta for Auth

## MODIFIED Requirements

### Requirement: SSO Silent Detection and Login

The system MUST detect Supabase Auth sessions silently on mount without blocking the UI. No login screen SHALL gate app access. A valid Supabase JWT session SHALL auto-elevate to authenticated mode. "Iniciar sesión" SHALL be available in the user menu. Login SHALL support Google OAuth and email OTP via Supabase Auth. The auth flow MUST open in the system browser (not embedded WebView). Session management MUST use `supabase.auth` SDK with automatic token refresh via `onAuthStateChange`.
(Previously: Supported generic OAuth 2.0/OIDC via "Opita Code SSO" with a local callback server to receive tokens; Supabase SDK not specified.)

#### Scenario: User logs in with Google OAuth via Supabase

- GIVEN the app is in guest mode
- WHEN the user clicks "Iniciar sesión con Google"
- THEN system browser opens Supabase OAuth consent screen
- AND on completion, Supabase JWT access + refresh tokens are stored via `supabase.auth`
- AND the UI auto-transitions to authenticated mode

#### Scenario: Silent detection via Supabase

- GIVEN a valid Supabase Auth session exists from a previous login
- WHEN the app mounts
- THEN `supabase.auth.getSession()` is called silently
- AND if a valid session is found, the UI auto-transitions to authenticated mode

#### Scenario: Session persists across app restarts

- GIVEN a user logged in via Supabase Auth during a previous session
- WHEN the app starts
- THEN `supabase.auth.getSession()` retrieves the stored session
- AND if the access token is valid, the user is authenticated automatically
- AND if expired, the Supabase SDK refreshes the token silently using the refresh token

#### Scenario: Login from guest mode

- GIVEN the app is operating in guest mode
- WHEN the user clicks "Iniciar sesión" in the user menu
- THEN the Supabase Auth flow opens in the system browser
- AND on completion the app transitions to authenticated mode

#### Scenario: Automatic token refresh

- GIVEN the Supabase access token is within 60 seconds of expiry
- WHEN the Supabase SDK `onAuthStateChange` listener fires
- THEN a new access token is obtained via the refresh token
- AND the user session continues without interruption or re-authentication prompt

## ADDED Requirements

### Requirement: Mock-to-Supabase Auth Migration

When a guest user authenticates via Supabase Auth with the same email they previously used in mock mode, the system SHALL migrate their local preferences to cloud context. The mock guest token in localStorage SHALL be replaced by the Supabase JWT session.

#### Scenario: Guest migrates to real account with matching email

- GIVEN user operated in guest mode with localStorage preferences and mock email `user@example.com`
- WHEN user completes Supabase OAuth with the same email `user@example.com`
- THEN local Zustand preferences and learning state are pushed to the `cloud_context` table
- AND the localStorage mock guest token is removed
- AND the Supabase JWT session replaces it as the source of identity

#### Scenario: Different email — no migration

- GIVEN guest with mock email `old@example.com` and localStorage preferences
- WHEN user authenticates via Supabase with a different email `new@example.com`
- THEN previous localStorage preferences are NOT migrated to cloud
- AND a fresh, empty cloud context is initialized for the new Supabase account
