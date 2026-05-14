# Delta for File System

## MODIFIED Requirements

### Requirement: Open Project Folder

The system MUST provide an "Abrir Carpeta" button that opens a platform-adaptive folder selector. On Tauri desktop, it SHALL invoke the native folder dialog via `@tauri-apps/plugin-dialog`. In browser mode, it SHALL invoke `window.showDirectoryPicker()`. Upon selection, the file tree SHALL populate with folder contents via the active `FileSystemBackend`. The last opened folder path MUST persist across sessions via the session persistence layer.
(Previously: Only supported Tauri folder dialog; persisted via SQLite.)

#### Scenario: User opens a project folder (Tauri)

- GIVEN the app runs in Tauri and no project is open
- WHEN the user clicks "Abrir Carpeta" and selects a folder
- THEN a recursive file tree renders in the sidebar
- AND the folder path is stored and restored on next app launch

#### Scenario: User opens a project folder (Web)

- GIVEN the app runs in a browser with File System Access API support
- WHEN the user clicks "Abrir Carpeta" and selects a folder via `showDirectoryPicker()`
- THEN the browser requests read permission
- AND upon grant, the file tree populates with the selected folder contents
- AND the directory handle reference is stored in IndexedDB for session restoration

#### Scenario: Web browser lacks File System Access API

- GIVEN the app runs in a browser without File System Access API (e.g., Firefox)
- WHEN the user clicks "Abrir Carpeta"
- THEN a clear message informs the user this feature requires a Chromium-based browser
- AND the button remains in a disabled state

## ADDED Requirements

### Requirement: File System Backend Abstraction

The system MUST define a `FileSystemBackend` TypeScript interface declaring all FS operations: `readDir`, `readFile`, `writeFile`, `createDir`, `deleteEntry`, `renameEntry`, `exists`. Two implementations SHALL exist: `TauriFS` (delegates to Tauri IPC) and `BrowserFS` (File System Access API + IndexedDB handle storage). The active backend MUST be selected at app root based on platform detection.

#### Scenario: Backend selection at app root

- GIVEN the platform is detected as Tauri
- WHEN the app initializes
- THEN `TauriFS` is instantiated and injected into the FS layer
- AND all FS operations delegate to Tauri IPC commands

#### Scenario: Unified API across backends

- GIVEN a component calls `fs.readFile("/src/App.tsx")`
- WHEN the call executes regardless of backend
- THEN it returns the file contents as a UTF-8 string
- AND the caller has no knowledge of which backend is active

### Requirement: Environment Detection

The app MUST detect the runtime environment (Tauri vs Browser) at startup. Detection SHALL use the presence of `window.__TAURI_INTERNALS__`. The result MUST be available synchronously for backend selection, feature gating, and UI adaptation.

#### Scenario: Detection on Tauri desktop

- GIVEN the app runs inside a Tauri WebView
- WHEN `platform.isTauri()` is called
- THEN it returns `true`
- AND `platform.isBrowser()` returns `false`

#### Scenario: Detection on web browser

- GIVEN the app is loaded from a web server (not Tauri WebView)
- WHEN `platform.isTauri()` is called
- THEN it returns `false`
- AND `platform.isBrowser()` returns `true`

### Requirement: Web File System Access

In browser mode, FS operations MUST use the File System Access API. Root `FileSystemDirectoryHandle` SHALL be stored in IndexedDB for session restoration (handles are not JSON-serializable). Write operations SHALL use writable file streams. Read operations SHALL resolve virtual paths against the stored root handle.

#### Scenario: Browser restores session with stored handle

- GIVEN the user closed and reopened the browser tab
- WHEN the app rehydrates and finds a stored project path
- THEN `BrowserFS` retrieves the `FileSystemDirectoryHandle` from IndexedDB
- AND re-verifies permission via `handle.queryPermission()`
- AND repopulates the file tree without re-prompting the user

#### Scenario: Permission denied on session restore

- GIVEN a stored directory handle exists in IndexedDB
- WHEN `handle.queryPermission()` returns `"prompt"`
- THEN the app MUST re-request permission via `handle.requestPermission()`
- AND if denied, the user is prompted to reopen the folder

### Requirement: Platform Feature Availability

Features unavailable in the browser MUST be gated. Git status indicators and file watching SHALL return neutral values (no-op/null) in web mode. The terminal and git-related UI elements SHALL be hidden when `platform.isBrowser()` is true.

#### Scenario: Git status hidden in web mode

- GIVEN the app runs in a browser
- WHEN the file tree renders
- THEN no git status indicators appear
- AND calling `gitStatus()` returns `null` without throwing

#### Scenario: Terminal hidden in web mode

- GIVEN the app runs in a browser
- WHEN the shell renders
- THEN the terminal panel is not displayed
- AND terminal-related UI controls are hidden
