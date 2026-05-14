# Delta Specs: Vibe Studio Chat-First Redesign

## 1. guest-first-access (NEW)

### Requirement: Guest-First App Access
The app MUST open directly to the main UI without a login gate. Silent SSO session detection SHALL run on mount. If no valid token exists, the app operates in guest mode capped at 30 prompts/month. A detected valid session SHALL auto-elevate to authenticated mode.

#### Scenario: Cold start, no token
- GIVEN no SSO token is stored
- WHEN the app mounts
- THEN the main UI renders in guest mode
- AND the prompt counter shows "0 de 30 este mes"

#### Scenario: Valid session auto-detect
- GIVEN a valid SSO token from cuenta.opitacode.com is stored
- WHEN the app mounts
- THEN the UI transitions silently to authenticated mode
- AND BYOK + unlimited prompts become available

#### Scenario: Expired token fallback
- GIVEN a stored token is expired and refresh fails
- WHEN silent detection runs on mount
- THEN the app falls back to guest mode
- AND "Iniciar sesión" appears in the user menu

---

## 2. settings-panel (NEW)

### Requirement: Settings Slide-Out Panel
A gear icon in the top bar MUST open a slide-out settings panel hosting BYOK config, plan info, and token usage. Open/close state SHALL persist across sessions via Zustand.

#### Scenario: Open settings
- GIVEN the main UI is rendered
- WHEN the user clicks the gear icon
- THEN a panel slides from the right edge with tabs: BYOK | Plan | Tokens

#### Scenario: State persists
- GIVEN settings were open when the app last closed
- WHEN the app restarts
- THEN the settings panel renders in its prior open/close state

---

## 3. desktop-shell (DELTA)

### ADDED Requirements

### Requirement: Two-Column Layout
The shell MUST use a 2-column layout: Chat (left, always visible, resizable) | Shared area (right). The right column SHALL host ViewTabs: Preview (default), Editor, Split. The left column width SHALL persist across sessions.
(Previously: 3-column layout with toggleable panels.)

#### Scenario: 2-column render
- GIVEN the app loads
- WHEN the shell renders
- THEN Chat occupies the left column
- AND Preview is the default right-column view
- AND ViewTabs show Preview | Editor | Split

### Requirement: Top Bar with Gear and User Menu
The top bar MUST display a gear icon (→ settings) and a user menu. The user menu SHALL show "Iniciar sesión" in guest mode, or avatar + "Cerrar sesión" when authenticated.

#### Scenario: Guest user menu
- GIVEN guest mode
- WHEN the user menu is opened
- THEN "Iniciar sesión" is the primary action

---

## 4. chat-assistant (DELTA)

### ADDED Requirements

### Requirement: Chat Always Visible
The chat panel MUST be always visible with no toggle (no Ctrl+B). It SHALL occupy the left column. Width MUST be resizable via drag handle (min 280px, max 50% viewport).
(Previously: Chat was toggleable and shared column space.)

#### Scenario: Chat visible on start
- GIVEN the app loads
- WHEN the main UI renders
- THEN the chat panel is visible and the input is focused

#### Scenario: Resize chat
- GIVEN the chat panel is visible
- WHEN the user drags the right-edge handle
- THEN width updates in real-time and persists across sessions

### REMOVED Requirements

### Requirement: Chat Visibility Toggle
Reason: Chat is always visible; Ctrl+B toggle is no longer needed.

---

## 5. code-editor (DELTA)

### ADDED Requirements

### Requirement: Editor in Shared View
The Monaco editor MUST render in the right column's shared area, controlled by ViewTabs. The editor SHALL be visible only when "Editor" or "Split" is active. Default view on start MUST be Preview, not Editor.
(Previously: Editor occupied a dedicated column, always visible.)

#### Scenario: Switch to editor
- GIVEN Preview is the active view
- WHEN the user clicks "Editor" in ViewTabs
- THEN Monaco loads the active file in the right column
- AND Preview is hidden

---

## 6. live-preview (DELTA)

### ADDED Requirements

### Requirement: Preview as Default View
The live preview MUST be the default right-column view, always mounted while a project is open. Visibility is via ViewTabs; no standalone toggle exists.
(Previously: Preview had a standalone visibility toggle.)

#### Scenario: Preview default
- GIVEN a project is open
- WHEN the app renders
- THEN the preview iframe loads immediately in the right column
- AND the "Preview" ViewTab is highlighted

#### Scenario: Horizontal split
- GIVEN Preview is active
- WHEN the user clicks "Split" in ViewTabs
- THEN the right column splits: Preview top, Editor bottom

---

## 7. file-system (DELTA)

### ADDED Requirements

### Requirement: Collapsible Explorer Dock
The file tree MUST render as a collapsible dock within the code section. It SHALL be collapsed by default with a vertical icon bar as the expand trigger.
(Previously: File tree was a permanent standalone sidebar.)

#### Scenario: Explorer collapsed
- GIVEN a project is open
- WHEN the app renders
- THEN the explorer dock is collapsed
- AND a vertical icon bar is visible

#### Scenario: Expand explorer
- GIVEN explorer is collapsed
- WHEN the user clicks the explorer icon
- THEN the dock slides open showing the file tree

### MODIFIED Requirements

### Requirement: File Tree Component
The file tree MUST display files/folders hierarchically with type icons. It SHALL support expand/collapse, single-click open, and context menu (Nuevo archivo, Nueva carpeta, Renombrar, Eliminar). The tree SHALL render inside the collapsible dock, not a permanent sidebar.
(Previously: File tree rendered in a permanent sidebar column.)

---

## 8. auth (DELTA)

### MODIFIED Requirements

### Requirement: SSO Background Detection
The system MUST detect SSO sessions silently on mount without blocking the UI. No login screen SHALL gate app access. A valid session SHALL auto-elevate to authenticated mode. "Iniciar sesión" SHALL be available in the user menu.
(Previously: Login screen blocked app access until authentication completed.)

#### Scenario: Silent detection
- GIVEN a valid SSO token is stored
- WHEN the app mounts
- THEN session detection runs in background
- AND the UI auto-transitions to authenticated mode

#### Scenario: Login from guest
- GIVEN guest mode
- WHEN the user clicks "Iniciar sesión" in the user menu
- THEN SSO flow opens in the system browser
- AND on completion the app transitions to authenticated mode

### MODIFIED Requirements

### Requirement: Login Screen Repurposed
The Login screen SHALL NOT appear as a startup gate. It MAY render as a modal when the user explicitly triggers login. Brand presence (logo, tagline, colors) MUST be preserved.
(Previously: LoginScreen was the app entry gate, blocking main UI.)

### MODIFIED Requirements

### Requirement: Logout Returns to Guest Mode
On logout, the system MUST clear tokens and return to guest mode. The app SHALL NOT navigate to a login screen. Main UI MUST remain accessible with free-tier limits.
(Previously: Logout navigated to login screen, blocking app access.)

#### Scenario: Logout flow
- GIVEN authenticated user
- WHEN "Cerrar sesión" is clicked
- THEN tokens are cleared and UI transitions to guest mode

---

## 9. byok-config (DELTA)

### ADDED Requirements

### Requirement: BYOK in Settings Panel
The BYOK panel MUST render inside the Settings slide-out, accessible via gear icon > BYOK tab. Core key management behavior (add, validate, mask, remove) SHALL remain unchanged.
(Previously: BYOK component existed but was not rendered in the UI.)

#### Scenario: Access BYOK via settings
- GIVEN the main UI is rendered
- WHEN the user opens settings and selects the BYOK tab
- THEN provider key management renders with existing providers

---

## 10. token-usage (DELTA)

### ADDED Requirements

### Requirement: Token Usage in Settings Panel
The token usage display (prompt counter, plan info, renewal date) MUST render inside the Settings panel under Plan and Token Usage tabs. Core tracking (counter increment, limit enforcement) SHALL remain unchanged. It MUST NOT render inline in the Chat footer.
(Previously: Token usage displayed in Chat panel footer.)

#### Scenario: View usage in settings
- GIVEN a user has used 12/30 prompts
- WHEN settings > Token Usage tab is opened
- THEN "13 de 30 prompts usados este mes" is displayed with renewal date

#### Scenario: Limit enforcement persists
- GIVEN free user at 30/30 prompts
- WHEN a prompt is sent via chat
- THEN the request is blocked with upgrade modal (Estudiante or BYOK)
