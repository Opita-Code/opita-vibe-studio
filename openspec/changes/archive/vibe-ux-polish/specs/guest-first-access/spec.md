# Delta Spec: guest-first-access (vibe-ux-polish)

## Modified Requirements

### Requirement: Landing Page Entry Point
The application MUST serve a Landing Page at the root URL (`/`) to welcome users, explain the value proposition, and establish the Vibe Studio identity before they enter the IDE shell.

#### Scenario: User visits the root URL
- GIVEN the user navigates to the base URL
- WHEN the application loads
- THEN the `LandingPage` component is displayed
- AND the IDE shell is NOT visible
- AND clicking the primary action button transitions the user to the `/app` route.

### Requirement: Intuitive Empty State
When the IDE shell loads without an active project, it MUST display a clear, visually guided empty state inviting the user to select a local folder.

#### Scenario: User enters the IDE without a project
- GIVEN the user is on the `/app` route
- AND no project folder is currently loaded
- WHEN the main editor panel renders
- THEN it displays a centralized Glassmorphism card
- AND the card contains an "Abrir Carpeta" button that triggers the platform-adaptive folder selection dialog.
