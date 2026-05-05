# Delta for Desktop Shell

## ADDED Requirements

### Requirement: App Window Management

The Tauri v2 desktop shell MUST provide a main application window with configurable title, minimum size (1024×680), and close-to-tray behavior. The system SHALL support window minimize, maximize, restore, and close operations via native OS controls.

#### Scenario: App launches and shows main window

- GIVEN the app is installed on Windows 10/11
- WHEN the user launches the executable
- THEN a main window opens with dimensions 1280×800 (default)
- AND the window title displays "Vibe-Studio"

#### Scenario: Close button minimizes to tray

- GIVEN the main window is open
- WHEN the user clicks the close button (X)
- THEN the window hides to the system tray
- AND the app process continues running
- AND clicking the tray icon restores the window

### Requirement: System Tray Integration

The app MUST register a system tray icon with a context menu containing at minimum: "Abrir Vibe-Studio", "Cerrar". The tray SHALL be visible on app startup and persist until explicit quit.

#### Scenario: Tray menu shows options

- GIVEN the app is running
- WHEN the user right-clicks the tray icon
- THEN a context menu appears with "Abrir Vibe-Studio" and "Cerrar"
- AND selecting "Abrir" restores the main window if hidden
- AND selecting "Cerrar" terminates the app process completely

### Requirement: Single Instance Enforcement

The app MUST enforce a single running instance. If a second instance is launched, the existing instance SHALL be focused and the second instance SHALL exit immediately.

#### Scenario: Duplicate launch focuses existing

- GIVEN the app is already running
- WHEN a second instance is launched
- THEN the existing window is restored and focused
- AND the second instance exits with zero delay

### Requirement: Auto-Update Support

The app SHALL integrate `tauri-plugin-updater` to check for, download, and apply updates. Update checks MUST run silently on app start and MAY notify the user when an update is available.

#### Scenario: Update available notification

- GIVEN a newer version exists on the update server
- WHEN the app starts and completes the update check
- THEN a non-blocking notification informs the user an update is available
- AND the user MAY choose to install immediately or defer
