# Design: browserfs-large-folder-fix

## Architecture

To prevent catastrophic UI hangs during folder loading, we will implement a fast exclusion check in the recursive loader and eliminate an expensive asynchronous OS-level file fetch inside the browser FS list loop.

## Changes by Module

### 1. `src/lib/fs.ts`
- **Constant**: Define `IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".vscode", "out"])`.
- **`loadProject`**: 
  - Before calling `loadProject(node.path)` recursively on a directory, check `if (IGNORE_DIRS.has(node.name))`.
  - If it is an ignored directory, skip the recursive call and leave `node.children = []`. This makes the directory visible in the tree but unexpandable/empty, which is an acceptable MVP behavior to prevent crashes.

### 2. `src/lib/fs-backend/browser.ts`
- **`listDirectory`**:
  - Remove `const file = await entry.getFile();` inside the `dirHandle.entries()` loop.
  - Hardcode `size: 0` or omit the size property for files in this backend, as fetching the full `File` object solely for its `.size` property inside a loop blocks the thread heavily.

## Data Models
- No interface changes are required. The `FileNode` interface already supports optional `size` or allows it to be zero.

## Test Strategy
- **Unit Tests**: Update tests for `fs.ts` (if any exist for `loadProject`) to mock `getFileSystemBackend` and assert that directories named `node_modules` are not traversed recursively.
- **Integration/Manual Testing**: Verify via Web Mode that loading a massive folder (like `opita_vapes` with `node_modules`) succeeds instantly without hanging the browser.
