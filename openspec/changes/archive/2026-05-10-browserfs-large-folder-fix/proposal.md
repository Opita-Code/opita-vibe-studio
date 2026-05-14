# Proposal: browserfs-large-folder-fix

## Intent

The `loadProject` function in the FileSystem module performs a full recursive traversal of the selected project folder. When used in BrowserFS mode via the File System Access API, loading massive directories like `node_modules` or `.git` causes the browser tab to hang completely. This change introduces an exclusion list to prevent recursive loading of known heavy directories, ensuring the web IDE remains responsive.

## Scope

### In Scope
- Add a static exclusion list (`node_modules`, `.git`, `.next`, `dist`, `build`) to `loadProject` in `src/lib/fs.ts`.
- Optimize `BrowserFS.listDirectory` to prevent blocking the main thread when iterating through files (e.g., avoid `await entry.getFile()` for size).

### Out of Scope
- Full "Lazy Loading" architecture for the file tree (fetching children only on expand). This is a larger architectural change deferred to the future.
- User-configurable ignore lists in settings.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `file-system`: Add requirement to prevent recursive traversal into standard large/system directories to ensure platform stability.

## Approach

1. **Exclusion List**: Modify `loadProject` in `src/lib/fs.ts` to check if `node.name` is in an `IGNORE_DIRS` array. If it is, `node.children` remains an empty array or undefined, skipping the recursive `loadProject(node.path)` call.
2. **Size Optimization**: In `src/lib/fs-backend/browser.ts`, remove `await entry.getFile()` inside `listDirectory`. File sizes are rarely needed for initial rendering and cause severe overhead. We will default `size` to `0` or `undefined`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/fs.ts` | Modified | Add `IGNORE_DIRS` and skip recursion in `loadProject` |
| `src/lib/fs-backend/browser.ts` | Modified | Remove `await entry.getFile()` to optimize file listing |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Users cannot explore `node_modules` | High | Acceptable trade-off for MVP. Document that system/build folders are hidden by default for performance. |
| Incomplete exclusion list | Medium | Include the most common culprits (`node_modules`, `.git`). Custom heavy folders might still hang the UI until lazy loading is built. |

## Rollback Plan

Revert the modifications in `src/lib/fs.ts` and `src/lib/fs-backend/browser.ts` to their previous state.

## Dependencies

- None

## Success Criteria

- [ ] Opening `opita_vapes` (or any Node project with `node_modules`) in Web Mode completes loading in under 2 seconds.
- [ ] Browser tab does not crash or hang.
- [ ] The file tree accurately displays the project root files and other directories.
