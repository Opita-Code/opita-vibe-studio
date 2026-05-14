# Design: Web File Access + Session Persistence + ZIP Export

## Technical Approach

Inject a strategy-pattern `FileSystemBackend` at module level. `src/lib/fs.ts` (domain logic: recursive loading, sorting, git detection) delegates all I/O to this backend instead of importing `ipc.ts` directly. `TauriFS` wraps existing IPC calls unchanged. `BrowserFS` implements the same contract via File System Access API + IndexedDB handle storage + virtual paths. Export and persistence layers sit on top of the abstraction.

**Phase order**: FS abstraction → Export → Persistence (non-FS persistence parts parallelizable with export).

---

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Backend lifecycle | Module-level singleton (`getFileSystemBackend()`) | React context, zustand store | zustand stores import `fs.ts` at module level; context injection impossible for module-level consumers. Singleton matches existing pattern. |
| Backend return type | `FileNode[]` (domain model) | `FileEntry[]` (IPC format) | Eliminates intermediate conversion in `fs.ts`. Each backend converts its native format to `FileNode`. |
| Platform detection | New `src/lib/platform.ts` (re-implements `window.__TAURI__` check) | Import from `@opita/cloud-context` | Self-contained; no cross-package coupling. ~10 lines. |
| ZIP library | JSZip (client-side) | Rust `zip` crate | Single implementation for Tauri+Web; ~30KB gzipped; zero Rust changes. |
| Persist storage | `localStorage` for zustand state | IndexedDB for everything | Zustand serialized state <5KB fits in localStorage. IndexedDB only for `FileSystemDirectoryHandle` (native storage required). |
| Hydration gate | `onRehydrateStorage` callback | Suspense, loading state | Prevents UI flash on initial render; gates auto-reopen until persisted state is fully restored. |
| Export button placement | Top bar header (next to settings gear) | Explorer context menu, toolbar | Most visible, always accessible; matches proposal's "editor toolbar" intent with simpler implementation. |

---

## Component Diagram

```
┌─────────────────────────────────────────────────────┐
│  App.tsx                                            │
│  ├── ExportButton (new)                             │
│  ├── Auto-reopen useEffect (new)                    │
│  └── detects platform → creates singleton backend   │
├─────────────────────────────────────────────────────┤
│  Stores                                             │
│  ├── projectStore ← persist(partialize)             │
│  │   └── calls fs.ts(backend)                       │
│  ├── uiStore ← persist(partialize)                  │
│  └── (auth, consent, learning already persisted)    │
├─────────────────────────────────────────────────────┤
│  src/lib/fs.ts (domain logic)                       │
│  │  loadProject, readFileContent, saveFileContent,  │
│  │  isGitRepo, createDir, deleteEntry                │
│  │  delegates I/O to → getFileSystemBackend()       │
│  └──────────────────┬────────────────────────────── │
├─────────────────────┼───────────────────────────────┤
│  src/lib/fs-backend/  (Strategy Pattern)            │
│  ├── types.ts: FileSystemBackend interface          │
│  ├── tauri.ts:  TauriFS (wraps ipc.ts)             │
│  ├── browser.ts: BrowserFS (FSA API + IndexedDB)   │
│  ├── factory.ts: detectPlatform() → backend         │
│  └── index.ts: barrel export                       │
├─────────────────────────────────────────────────────┤
│  src/lib/export.ts (JSZip)                          │
│  src/components/layout/ExportButton.tsx             │
└─────────────────────────────────────────────────────┘
```

---

## Interface Definition

```typescript
// src/lib/fs-backend/types.ts
interface FileSystemBackend {
  readonly label: "tauri" | "browser";

  listDirectory(path: string): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  deleteEntry(path: string): Promise<void>;
  selectDirectory(): Promise<string | null>;

  // Platform-specific capabilities
  isAvailable(): boolean;
  isGitRepo?(path: string): Promise<boolean>;   // optional: BrowserFS returns false
  watchDir?(path: string, cb: () => void): void; // optional: Tauri only
}
```

## Auto-Reopen Sequence

```
App mounts
  → detectSession() (existing auth restore, non-blocking)
  → onRehydrateStorage fires (zustand hydration complete)
    → Check projectStore.getState().rootPath
    → IF rootPath exists:
        ├── Tauri: backend.listDirectory(rootPath) to verify
        │   ├── Valid → projectStore.openProject(rootPath)
        │   └── Invalid → clear rootPath, show empty state
        └── Browser: IndexedDB lookup for FileSystemDirectoryHandle
            ├── Found + permission granted → restore handle, openProject(rootPath)
            ├── Found + permission denied → clear persisted state, show "Reopen folder" prompt
            └── Not found → prompt user to open folder
    → Restore openTabs: for each path, call projectStore.openFile(path)
    → Restore activeTab
```

## Export Data Flow

```
ExportButton click
  → Guard: projectStore.rootPath must exist (disabled otherwise)
  → Collect FileNode[] from projectStore.files (already in memory)
  → exportsProjectAsZip(files, backend, onProgress)
      → For each file: backend.readFile(virtualPath)
      → zip.file(path, content)
      → zip.generateAsync({type: "uint8array"})
  → Platform delivery:
      ├── Tauri: save dialog → backend.writeFile(chosenPath, bytes)
      └── Web: new Blob([bytes]) → URL.createObjectURL → <a download>
  → Show success toast / error toast
```

## BrowserFS Handle Lifecycle

```
Acquire → showDirectoryPicker() → FileSystemDirectoryHandle
Store   → IndexedDB (native handle, not serialized)
Retrieve → indexedDB.databases() → getDirectory()
Verify  → handle.requestPermission({mode: 'readwrite'})
         ├── Granted → use handle
         └── Denied → clear IndexedDB, re-prompt user
```

Virtual paths: BrowserFS has no OS paths. `rootPath` stores a logical name (e.g., `"my-project"`). Path resolution walks `FileSystemDirectoryHandle.getDirectoryHandle()` / `getFileHandle()` chains.

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/fs-backend/types.ts` | **Create** | `FileSystemBackend` interface, `FileNode` import |
| `src/lib/fs-backend/tauri.ts` | **Create** | `TauriFS` class: wraps `ipc.ts`, converts `FileEntry` → `FileNode` |
| `src/lib/fs-backend/browser.ts` | **Create** | `BrowserFS` class: FSA API, IndexedDB handle management, virtual paths |
| `src/lib/fs-backend/factory.ts` | **Create** | `createFileSystemBackend()` + singleton `getFileSystemBackend()` |
| `src/lib/fs-backend/index.ts` | **Create** | Barrel export |
| `src/lib/platform.ts` | **Create** | `detectPlatform()` returning `"tauri" \| "browser"` |
| `src/lib/fs.ts` | **Modify** | Replace direct `ipc.ts` imports with `getFileSystemBackend()` delegation |
| `src/lib/export.ts` | **Create** | `exportProjectAsZip(files, backend, onProgress?)` |
| `src/components/layout/ExportButton.tsx` | **Create** | Export button with progress, platform-specific delivery |
| `src/App.tsx` | **Modify** | Add `<ExportButton />` to header, auto-reopen `useEffect` |
| `src/stores/project.ts` | **Modify** | Wrap with `persist(partialize: {rootPath, openTabs, activeTab})` |
| `src/stores/ui.ts` | **Modify** | Wrap with `persist(partialize: {chatWidth, chatPosition, activeView, splitOrientation, splitRatio, explorerVisible})` |
| `package.json` | **Modify** | Add `jszip` dependency |
| `tests/lib/fs-backend/tauri.test.ts` | **Create** | TauriFS delegation tests (mock ipc.ts) |
| `tests/lib/fs-backend/browser.test.ts` | **Create** | BrowserFS tests (mock FSA API globals) |
| `tests/lib/platform.test.ts` | **Create** | Platform detection tests |
| `tests/lib/export.test.ts` | **Create** | ZIP export + delivery tests |
| `tests/lib/fs.test.ts` | **Modify** | Rewrite to use `MockFileSystemBackend` instead of mocking ipc.ts directly |
| `tests/stores/project.test.ts` | **Modify** | Add `persist` hydration + `partialize` tests |
| `tests/stores/ui.test.ts` | **Modify** | Add UI state persistence tests |

---

## Error Handling

| Layer | Failure | Response |
|-------|---------|----------|
| `TauriFS` | IPC invoke fails (path missing, permissions) | Throw with original error message; `fs.ts` catches and sets `statusMessage` |
| `BrowserFS` | `showDirectoryPicker()` user cancels | Return `null` from `selectDirectory()` |
| `BrowserFS` | Handle permission expired | Clear IndexedDB; surface "permission lost" status |
| `BrowserFS` | Recursive read fails mid-walk | Return partial tree; `loadProject` in `fs.ts` catches per-directory errors (already does this) |
| `persist` middleware | localStorage quota exceeded | Log warning; clear old state; app continues without persistence |
| `ExportButton` | File read fails during ZIP build | Skip that file; continue with remaining; report skipped count |
| Auto-reopen | Path no longer exists | Clear `rootPath`; show empty state |

---

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| **Unit** | `TauriFS` delegates correctly to `ipc.ts` | `vi.mock("../../src/lib/ipc")`, verify each method call |
| **Unit** | `BrowserFS` handle lifecycle (acquire, store, retrieve) | Mock `window.showDirectoryPicker`, `indexedDB`; test IndexedDB CRUD |
| **Unit** | `BrowserFS` virtual path resolution | Create mock handle tree; verify `listDirectory` returns correct `FileNode[]` |
| **Unit** | Platform detection | Set/clear `window.__TAURI__`; expect correct platform |
| **Unit** | `exportProjectAsZip` builds correct ZIP structure | Mock backend `readFile`, verify JSZip calls |
| **Unit** | `persist` `partialize` filters state | Set full state; verify serialized output matches whitelisted keys |
| **Integration** | `fs.ts` domain logic with mock backend | Provide `MockFileSystemBackend`; test `loadProject`, `isGitRepo` |
| **Integration** | Auto-reopen flow via `onRehydrateStorage` | Mock localStorage state; test project restoration path |
| **Integration** | ExportButton end-to-end (click → download/save) | Mock platform delivery; verify ZIP bytes |

---

## Migration / Rollout

No data migration required — all changes are additive or wrapped in interface boundaries. `TauriFS` preserves existing behavior byte-for-byte. Each feature is independently reversible:

1. Remove `persist` wrapper → session state resets each launch (no data loss)
2. Remove `ExportButton` → no side effects
3. Remove `BrowserFS` → Tauri desktop unaffected; web build gracefully degrades

---

## Open Questions

- [ ] Should `chatStore` persist last N messages? (Deferred per proposal — localStorage quota risk)
- [ ] Should export support directory-level export (not just full project)? (MVP: full project only)
- [ ] Should `BrowserFS` gracefully degrade on non-HTTPS origins? (Already handled: FSA API throws `SecurityError`, caught by backend)
