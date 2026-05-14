# Specs: Web File Access + Session Persistence + ZIP Export

## Summary

Platform-adaptive file system, session persistence, and project export for Vibe Studio. Enables web deployment without sacrificing Tauri desktop capabilities.

## Capabilities

| Domain | Type | Requirements | Key Change |
|--------|------|-------------|------------|
| `file-system` | Modified | 1 MODIFIED + 4 ADDED | Open Project Folder now supports Tauri dialog AND web `showDirectoryPicker`. New `FileSystemBackend` abstraction with `TauriFS`/`BrowserFS` implementations. Runtime platform detection gates Tauri-only features. |
| `project-export` | **New** | 5 ADDED | Export button, JSZip-based ZIP creation, platform-adaptive delivery (native save dialog on Tauri, blob download on web), progress indicator for large projects. |
| `session-persistence` | **New** | 5 ADDED | Persist `rootPath`/`openTabs`/`activeTab` + UI state via zustand persist. Auto-reopen last project on launch gated by `onRehydrateStorage`. Graceful missing-path handling. File contents explicitly NOT persisted. |
| `desktop-shell` | Modified | 2 MODIFIED + 2 ADDED | App launch checks persisted session before showing empty state. Platform-adaptive shell hides terminal/git in web mode. Top bar gains export button. |

## Scenario Coverage

| Domain | Happy Paths | Edge Cases | Error States |
|--------|------------|------------|-------------|
| `file-system` | 5 | 2 (FF without FS API, permission denied) | 1 (graceful degradation) |
| `project-export` | 4 | 2 (binary files, cancel dialog) | 0 |
| `session-persistence` | 4 | 2 (corrupted state, web handle restore) | 1 (missing path) |
| `desktop-shell` | 4 | 0 | 1 (no persisted session) |

## Key Decisions

- **Detection**: `window.__TAURI_INTERNALS__` presence (zero-dependency, works in both environments)
- **Handle storage**: IndexedDB for `FileSystemDirectoryHandle` (not JSON-serializable); `localStorage` for plain state
- **Race prevention**: `onRehydrateStorage` gates auto-reopen until hydration completes
- **Tauri-only features**: Hidden via platform detection, not removed — `TauriFS` preserves existing IPC behavior
- **No file contents in persistence**: Re-read from disk/handle each session to avoid quota and staleness
