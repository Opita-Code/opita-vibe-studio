# File System Specification

## Summary

Platform-adaptive file system abstraction for Vibe Studio. Supports both Tauri desktop (native IPC) and browser (File System Access API) environments through a strategy-pattern `FileSystemBackend` interface.

## Application

This spec applies to all file system operations: directory listing, file read/write, directory creation, entry deletion, and project folder selection.

---

## Requirements

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

### Requirement: File Tree Component

The file tree MUST display files/folders hierarchically with type icons. It SHALL support expand/collapse, single-click open, and context menu (Nuevo archivo, Nueva carpeta, Renombrar, Eliminar). The tree SHALL render inside the collapsible dock, not a permanent sidebar.
(Previously: File tree rendered in a permanent sidebar column.)

#### Scenario: Create a new file via context menu

- GIVEN a project folder is open
- WHEN the user right-clicks a folder and selects "Nuevo archivo"
- THEN an inline text input appears for the filename
- AND pressing Enter creates an empty file via IPC
- AND the file appears in the tree and opens in the editor

#### Scenario: Delete a file with confirmation

- GIVEN a file exists in the tree
- WHEN the user selects "Eliminar" from the context menu
- THEN a confirmation dialog appears
- AND confirming sends the file to the OS recycle bin (not permanent delete)
- AND the file is removed from the tree

### Requirement: Git Status Indicators

When a project folder is a git repository, the file tree SHOULD display git status indicators (modified, added, deleted, untracked) via colored dots or icons next to filenames. Detection MUST use the `git status` command via Tauri shell plugin. In web mode, git indicators SHALL be hidden and `gitStatus()` SHALL return `null`.

#### Scenario: Modified file shows git indicator

- GIVEN a git-tracked file has uncommitted changes
- WHEN the file tree renders
- THEN a yellow dot appears next to the filename
- AND the indicator updates after file save

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

### Requirement: File Watching

The system SHOULD watch the project folder for external changes (via Tauri fs watch) and refresh the file tree and open editor tabs automatically. Browser mode does NOT support file watching.

#### Scenario: External tool modifies a file

- GIVEN `styles.css` is open in the editor
- WHEN an external tool (e.g., VS Code) saves changes to the same file
- THEN the editor content refreshes without losing scroll position
- AND a subtle notification indicates the file was updated externally

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

### Requirement: Prevent Recursive Traversal of Heavy Directories

The file system abstraction MUST prevent catastrophic UI hangs by NOT traversing standard heavy or system directories recursively during full project loads (`loadProject`). In both `BrowserFS` and `TauriFS` mode, a static exclusion list (`IGNORE_DIRS` containing `node_modules`, `.git`, `.next`, `dist`, `build`, etc.) MUST be respected.

#### Scenario: User opens a project with node_modules

- GIVEN the user selects a project directory containing `node_modules`
- WHEN `loadProject` recursively builds the file tree
- THEN the `node_modules` folder is included in the tree as a directory node
- AND its `children` array remains empty (recursion is skipped)
- AND the loading process completes without freezing the UI

### Requirement: Optimize BrowserFS File Listing

The `BrowserFS.listDirectory` implementation MUST NOT block the execution thread by synchronously fetching `File` objects just to read file sizes during directory iteration, as this incurs massive overhead.

#### Scenario: BrowserFS lists a directory

- GIVEN the app is using the `BrowserFS` backend
- WHEN `listDirectory` iterates over `dirHandle.entries()`
- THEN it immediately constructs `FileNode` entries without awaiting `entry.getFile()`
- AND the file `size` property is safely omitted or defaulted to zero
