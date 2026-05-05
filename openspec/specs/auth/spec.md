# Delta for Auth

## ADDED Requirements

### Requirement: Opita Code SSO Login

The system MUST authenticate users via Opita Code SSO (OAuth 2.0/OIDC). Login SHALL support email/password and Google OAuth. The auth flow MUST open in the system browser (not embedded WebView) for security, with a local callback server to receive the token.

#### Scenario: User logs in with email/password

- GIVEN the app is not authenticated
- WHEN the user clicks "Iniciar sesión" and completes the SSO flow in the browser
- THEN the app receives an access token + refresh token
- AND the session is stored in SQLite via `tauri-plugin-sql`
- AND the user is redirected to the main app interface

#### Scenario: Session persists across app restarts

- GIVEN a user logged in during a previous session
- WHEN the app starts
- THEN SQLite is queried for existing session tokens
- AND if the access token is still valid, the user is automatically authenticated
- AND if expired, the refresh token is used to obtain a new access token silently

### Requirement: Student Verification

During registration via SSO, the system SHALL verify student status by checking for a `.edu` email domain. Non-student accounts MAY use a standard email. The `Estudiante` plan MUST require verified student status.

#### Scenario: Student registers with .edu email

- GIVEN a user signs up with `nombre@unal.edu.co`
- WHEN the SSO registration completes
- THEN the account is automatically tagged as `student: true`
- AND the Estudiante plan becomes available

### Requirement: Logout and Session Cleanup

The system MUST clear local session data on logout: delete tokens from SQLite, clear Zustand auth store, and return to the login screen. A logout button SHALL be accessible from the user menu.

#### Scenario: Logout clears all session data

- GIVEN a user is authenticated
- WHEN the user clicks "Cerrar sesión"
- THEN access/refresh tokens are deleted from SQLite
- AND the auth Zustand store resets to unauthenticated
- AND the UI shows the login screen
