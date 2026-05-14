# Delta for Desktop Shell

## MODIFIED Requirements

### Requirement: App Window Management

The Tauri v2 desktop shell MUST provide a main application window with configurable title, minimum size (1024×680), and close-to-tray behavior. The system SHALL support window minimize, maximize, restore, and close operations via native OS controls. On launch, the app MUST check for persisted session state and auto-reopen the last project if found before rendering the empty state.
(Previously: Launch always showed empty state; no session persistence check.)

#### Scenario: App launches and restores session

- GIVEN a persisted session exists in localStorage with a valid project path
- WHEN the user launches the executable
- THEN the main window opens with dimensions 1280×800 (default)
- AND the file tree auto-populates from the persisted path
- AND previously open tabs are restored

#### Scenario: App launches with no persisted session

- GIVEN no persisted session exists
- WHEN the user launches the executable
- THEN the main window opens at default size
- AND the empty state UI is displayed

#### Scenario: Close button minimizes to tray

- GIVEN the main window is open
- WHEN the user clicks the close button (X)
- THEN the window hides to the system tray
- AND the app process continues running
- AND clicking the tray icon restores the window

## ADDED Requirements

### Requirement: Platform-Adaptive Shell Features

The shell MUST adapt its UI based on runtime platform detection. In web mode (`platform.isBrowser() === true`), the terminal panel, git status indicators, and any Tauri-only UI elements SHALL be hidden. The top bar SHALL include the export button when a project is open, visible on both platforms.

#### Scenario: Web mode hides terminal

- GIVEN the app runs in a browser
- WHEN the shell renders
- THEN the terminal panel is not visible
- AND git-related UI indicators are absent
- AND the export button is present when a project is open

#### Scenario: Tauri mode shows full shell

- GIVEN the app runs on Tauri desktop
- WHEN the shell renders
- THEN the terminal panel is available
- AND git status indicators are visible when applicable
- AND the export button is present when a project is open

### Requirement: Platform-Adaptive Top Bar

The top bar MUST display a gear icon (→ settings), a user menu, and an export button (when a project is open). The user menu SHALL show "Iniciar sesión" in guest mode, or avatar + "Cerrar sesión" when authenticated. The export button integration is specified in the `project-export` spec.

#### Scenario: Top bar with open project

- GIVEN a project is open
- WHEN the top bar renders
- THEN gear icon, user menu, and export button are visible
- AND the export button triggers the `project-export` workflow

#### Scenario: Guest user menu (unchanged)

- GIVEN guest mode
- WHEN the user menu is opened
- THEN "Iniciar sesión" is the primary action
