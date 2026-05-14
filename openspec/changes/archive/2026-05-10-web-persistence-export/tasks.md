# Tasks: Web File Access + Session Persistence + ZIP Export

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~970 (3 PRs × ~320 avg) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (FS) → PR 2 (Persistence) → PR 3 (Export) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | FS abstraction + TauriFS + fs.ts refactor | PR 1 | Pure refactor, zero user-facing change |
| 2 | BrowserFS + session persistence + auto-reopen | PR 2 | Depends on PR 1 for FS backend |
| 3 | JSZip export + ExportButton | PR 3 | Depends on PR 1 for FS backend; no deps on persistence |

## PR Slice 1 — FS Abstraction (pure refactor)

- [x] 1.1 Create `src/lib/platform.ts` — `detectPlatform()` checking `window.__TAURI_INTERNALS__`
- [x] 1.2 Create `src/lib/fs-backend/types.ts` — `FileSystemBackend` interface + `FileNode` type import
- [x] 1.3 Create `src/lib/fs-backend/tauri.ts` — `TauriFS` class wrapping `ipc.ts`, converting `FileEntry` → `FileNode`
- [x] 1.4 Create `src/lib/fs-backend/factory.ts` — `createFileSystemBackend()` + singleton `getFileSystemBackend()`
- [x] 1.5 Create `src/lib/fs-backend/index.ts` — barrel export
- [x] 1.6 Modify `src/lib/fs.ts` — replace direct `ipc.ts` imports with `getFileSystemBackend()` delegation
- [x] 1.7 Create `tests/lib/platform.test.ts` — verify detection in Tauri vs browser
- [x] 1.8 Create `tests/lib/fs-backend/tauri.test.ts` — mock `ipc.ts`, verify delegation per method
- [x] 1.9 Modify `tests/lib/fs.test.ts` — rewrite with `MockFileSystemBackend` instead of mocking `ipc.ts`

## PR Slice 2 — BrowserFS + Session Persistence ✅

- [x] 2.1 Create `src/lib/fs-backend/browser.ts` — `BrowserFS` with FSA API, IndexedDB handle storage, virtual path resolution
- [x] 2.2 Create `tests/lib/fs-backend/browser.test.ts` — mock `showDirectoryPicker`, handle lifecycle, virtual path tree
- [x] 2.3 Modify `src/stores/project.ts` — add `persist(partialize)` keeping `rootPath`, `openTabs`, `activeTab`
- [x] 2.4 Modify `tests/stores/project.test.ts` — add `persist` hydration + `partialize` tests
- [x] 2.5 Modify `src/stores/ui.ts` — add `persist(partialize)` keeping layout fields
- [x] 2.6 Modify `tests/stores/ui.test.ts` — add UI persistence tests (save/restore, corrupted state fallback)
- [x] 2.7 Modify `src/App.tsx` — add auto-reopen `useEffect` gated on hydration completion
- [x] 2.8 Modify `src/components/layout/ExplorerDock.tsx` — use platform-adaptive `selectDirectory()`

## PR Slice 3 — ZIP Export ✅

- [x] 3.1 Modify `package.json` — add `jszip` dependency
- [x] 3.2 Create `src/lib/export.ts` — `exportProjectAsZip(files, backend, onProgress?)` with binary support, exclusion filters
- [x] 3.3 Create `src/components/export/ExportButton.tsx` — export button with loading state, platform delivery (Tauri save dialog / web blob download)
- [x] 3.4 Create `tests/lib/export.test.ts` — 8 tests: ZIP structure, exclusion filters, error handling, progress callback, empty project, deep nesting
- [x] 3.5 Modify `src/App.tsx` — add `<ExportButton />` in header toolbar next to settings button

## Dependency Map

```
PR 1 (FS abstraction) ──► PR 2 (Persistence)  ──► main
                      └──► PR 3 (Export)      ──► main
```

- PR 2 and PR 3 both depend on PR 1 (they consume the backend interface)
- PR 2 and PR 3 are independent of each other
- Each PR compiles, passes `npm test`, `npm run typecheck`, and `npm run lint` independently
