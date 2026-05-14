# Tasks: browserfs-large-folder-fix

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~20 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

## Tasks

- [ ] 1. **Optimize BrowserFS File Listing**: In `src/lib/fs-backend/browser.ts`, within the `listDirectory` function, remove the `const file = await entry.getFile();` call and the subsequent `file.size` reference. Set the `size` property of the pushed `FileNode` to `0` (or omit it) to prevent the blocking OS-level file fetch during directory iteration.
- [ ] 2. **Add Recursion Ignore List**: In `src/lib/fs.ts`, define a `const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".vscode", "out"]);`.
- [ ] 3. **Implement Skip Logic**: In `src/lib/fs.ts` `loadProject` function, check if `node.name` exists in `IGNORE_DIRS` when processing a directory node. If it does, skip the recursive `loadProject(node.path)` call and assign `node.children = []` directly.
