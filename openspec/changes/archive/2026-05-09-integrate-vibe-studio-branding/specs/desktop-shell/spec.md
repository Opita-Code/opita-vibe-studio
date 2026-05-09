# Delta for Desktop Shell

## MODIFIED Requirements

### Requirement: App Window Management

The Tauri v2 desktop shell MUST provide a main application window with configurable title, minimum size (1024×680), and close-to-tray behavior. The system SHALL support window minimize, maximize, restore, and close operations via native OS controls.
(Previously: window title displayed "Vibe-Studio" with hyphen)

#### Scenario: App launches and shows main window

- GIVEN the app is installed on Windows 10/11
- WHEN the user launches the executable
- THEN a main window opens with dimensions 1280×800 (default)
- AND the window title displays "Vibe Studio"

#### Scenario: Close button minimizes to tray

- GIVEN the main window is open
- WHEN the user clicks the close button (X)
- THEN the window hides to the system tray
- AND the app process continues running
- AND clicking the tray icon restores the window

### Requirement: System Tray Integration

The app MUST register a system tray icon with a context menu containing at minimum: "Abrir Vibe Studio", "Cerrar". The tray SHALL be visible on app startup and persist until explicit quit.
(Previously: tray menu item was "Abrir Vibe-Studio" with hyphen)

#### Scenario: Tray menu shows options

- GIVEN the app is running
- WHEN the user right-clicks the tray icon
- THEN a context menu appears with "Abrir Vibe Studio" and "Cerrar"
- AND selecting "Abrir" restores the main window if hidden
- AND selecting "Cerrar" terminates the app process completely
