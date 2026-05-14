# Session Persistence Specification

## Purpose

Persist user's project and UI state across app sessions. Auto-reopen last project on launch. Handle missing paths gracefully.

## Requirements

### Requirement: Project State Persistence

The system MUST persist project state across sessions: `rootPath`, `openTabs` (file paths), and `activeTab`. Persistence SHALL use `zustand/middleware/persist` with `partialize` to exclude `fileContents`. Storage backend SHALL be `localStorage`.

#### Scenario: State survives app restart

- GIVEN a project is open with tabs "App.tsx", "index.html", and activeTab is "App.tsx"
- WHEN the user closes and reopens the app
- THEN `rootPath`, `openTabs`, and `activeTab` are restored from localStorage
- AND file contents are NOT in localStorage (reloaded from disk)

#### Scenario: First launch (no persisted state)

- GIVEN the app has never been opened
- WHEN the app launches
- THEN no project is auto-opened
- AND the empty state UI is displayed

### Requirement: UI State Persistence

The system MUST persist UI layout state across sessions: `chatWidth`, `chatPosition`, `activeView` (Preview/Editor/Split), and `splitRatio`. These values SHALL be stored via `zustand/middleware/persist` in localStorage.

#### Scenario: UI layout persists

- GIVEN the user resizes chat to 350px and switches to Editor view
- WHEN the app is closed and reopened
- THEN chatWidth is restored to 350px
- AND activeView is restored to "Editor"

#### Scenario: Corrupted UI state in localStorage

- GIVEN localStorage contains malformed JSON for uiStore
- WHEN the app rehydrates
- THEN the store falls back to default values (no crash)
- AND the corrupted data is overwritten with fresh defaults

### Requirement: Auto-Reopen Last Project

On app launch, the system MUST automatically reopen the last persisted project. Auto-reopen SHALL be gated on `onRehydrateStorage` completion to prevent race conditions. In browser mode, the stored `FileSystemDirectoryHandle` MUST be retrieved from IndexedDB before auto-reopen.

#### Scenario: Auto-reopen on Tauri

- GIVEN the previous session had a project open at `/home/user/project`
- WHEN the app launches and hydration completes
- THEN the file tree auto-populates from `/home/user/project`
- AND the previously open tabs are restored

#### Scenario: Auto-reopen on Web

- GIVEN the previous web session had a project open
- WHEN the browser tab is reopened
- THEN the app retrieves the directory handle from IndexedDB
- AND re-verifies permission before auto-repopulating the file tree

### Requirement: Missing Path Handling

When a persisted project path no longer exists on disk, the system MUST handle the situation gracefully: clear the persisted state, display the empty state UI, and SHALL NOT crash or show an unhandled error. A user-facing message SHOULD indicate the project was not found.

#### Scenario: Persisted path deleted externally

- GIVEN the last project was at `C:\deleted-folder`
- AND the folder was deleted outside the app
- WHEN the app launches and attempts auto-reopen
- THEN the persisted project state is cleared
- AND the empty state shows "No se pudo abrir el proyecto anterior. La carpeta ya no existe."
- AND no error dialog is shown

### Requirement: File Content Exclusion

The system MUST NOT persist `fileContents` in session state. File contents SHALL be reloaded from disk (or virtual FS in browser) each time a file is opened. This prevents localStorage quota issues and stale content issues.

#### Scenario: File contents reloaded on reopen

- GIVEN "App.tsx" was open in the previous session and modified externally
- WHEN the app reopens and restores the "App.tsx" tab
- THEN the editor loads the current disk content (not stale content)
- AND external modifications are reflected immediately
