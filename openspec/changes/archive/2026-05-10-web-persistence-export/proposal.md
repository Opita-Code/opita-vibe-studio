# Proposal: Web File Access + Session Persistence + ZIP Export

## Intent

Vibe Studio currently works only as a Tauri desktop app. The web build (`vite.config.ts` base: `/app/`) exists but would crash on any file I/O. This change makes the app functional on both Tauri desktop and web browser by introducing a platform-adaptive file system layer, session persistence, and a project export feature — **unlocking web deployment without sacrificing desktop capabilities**.

## Scope

### In Scope
- Strategy-pattern FS abstraction (`FileSystemBackend` interface, `TauriFS`, `BrowserFS`)
- Runtime platform detection (`src/lib/platform.ts`)
- zustand `persist` on project store (`rootPath`, `openTabs`, `activeTab`) and UI store (`chatWidth`, `chatPosition`, `activeView`, etc.)
- Auto-reopen last project on app mount (platform-aware)
- Export button in top bar — ZIP via JSZip, native save dialog (Tauri) or blob download (Web)
- Tests for FS backends, export, persistence, and platform detection

### Out of Scope
- Full offline PWA; cloud sync; file watching in browser; git/shell in browser
- Persisting `fileContents` (re-read from disk/handle each time)
- Chat message persistence (deferred — localStorage quota risk)
- Rust-level changes (`src-tauri/Cargo.toml` — no new Rust deps)

## Capabilities

### New Capabilities
- `project-export`: Export project files as ZIP. Platform-adaptive delivery (native save dialog or blob download).
- `session-persistence`: Persist project and UI state across launches. Auto-reopen last project on app mount.

### Modified Capabilities
- `file-system`: Requirements change from Tauri-only to platform-adaptive. Web File System Access API as alternative backend. Platform-specific limitations documented (no git, no shell, no file watching in browser).
- `desktop-shell`: Top bar gains export button. Shell behavior adapts to platform (hide terminal/git features in web mode).

## Approach

**Phase A — FS abstraction** (critical path): Inject `FileSystemBackend` at app root. `src/lib/fs.ts` delegates to the active backend instead of importing `ipc.ts` directly. `TauriFS` wraps existing IPC calls. `BrowserFS` uses File System Access API + virtual paths + IndexedDB handle storage.

**Phase B — ZIP export** (depends on A): Single `exportProjectAsZip()` function using JSZip. Platform-adaptive delivery via `@tauri-apps/plugin-dialog` save dialog (Tauri) or `URL.createObjectURL` + `<a download>` (Web).

**Phase C — Session persistence** (depends on A for web auto-reopen): `zustand/middleware/persist` with `partialize` on `projectStore` and `uiStore`. `onRehydrateStorage` callback gates auto-reopen until hydration completes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/fs-backend/` | **NEW** | Types, TauriFS, BrowserFS, factory, barrel |
| `src/lib/platform.ts` | **NEW** | Platform detection |
| `src/lib/export.ts` | **NEW** | JSZip export logic |
| `src/lib/fs.ts` | **HIGH** | Refactor: accept backend, delegate |
| `src/stores/project.ts` | **HIGH** | Add `persist` + `partialize` |
| `src/stores/ui.ts` | **MEDIUM** | Add `persist` + `partialize` |
| `src/App.tsx` | **MEDIUM** | Auto-reopen effect, export button |
| `src/components/layout/ExportButton.tsx` | **NEW** | Export UI |
| `package.json` | **LOW** | Add `jszip` dep |
| `tests/lib/fs-backend/` | **NEW** | Backend tests |
| `tests/lib/export.test.ts` | **NEW** | Export tests |
| `tests/stores/` | **MEDIUM** | Persistence tests |
| `tests/lib/fs.test.ts` | **HIGH** | Rewrite with mock backends |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `FileSystemDirectoryHandle` not JSON-serializable | High | IndexedDB native storage; fallback: re-prompt user |
| zustand hydration race — components render before rehydration | Medium | `onRehydrateStorage` gate |
| BrowserFS recursive directory walks slow for large projects | Medium | Async iteration, progress indicator |
| Web: no git/shell — features silently break | Medium | Hide git indicators + terminal in web mode; return `false`/`null` gracefully |
| Test isolation — persisted state leaks between tests | Medium | Mock `localStorage` in `beforeEach` cleanup |

## Rollback Plan

1. **Revert commit** — all changes are additive or wrapped in the backend interface; no destructive refactors
2. **Feature flags** — each phase can be disabled independently by removing the backend injection or persist wrapper
3. **TauriFS preserves existing behavior** — the Tauri backend is a delegation adapter that passes through unchanged IPC calls; if BrowserFS has issues, Tauri desktop is unaffected
4. **Export is self-contained** — `ExportButton` component and `export.ts` can be removed without affecting any other feature

## Dependencies

- `jszip` (npm, MIT, ~30KB gzipped, zero native deps)
- `@tauri-apps/plugin-dialog` (already in project for folder picker)
- Feature 3 (FS abstraction) MUST complete before Features 4 and 5

## Success Criteria

- [ ] Web build opens a folder via `showDirectoryPicker()`, displays file tree, opens files in editor
- [ ] Tauri desktop continues working with zero regression in file operations
- [ ] Export button creates valid ZIP and delivers via save dialog (Tauri) or download (Web)
- [ ] Project reopens automatically on app launch; UI layout persists across sessions
- [ ] `npm test && npm run typecheck && npm run lint` pass with all new tests
