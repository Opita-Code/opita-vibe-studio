# Delta Spec: file-system (browserfs-large-folder-fix)

## Modified Requirements

### Requirement: Prevent Recursive Traversal of Heavy Directories
The file system abstraction MUST prevent catastrophic UI hangs by NOT traversing standard heavy or system directories recursively during full project loads (`loadProject`). 
In both `BrowserFS` and `TauriFS` mode, a static exclusion list (`IGNORE_DIRS` containing `node_modules`, `.git`, `.next`, `dist`, `build`) MUST be respected.

#### Scenario: User opens a project with node_modules
- GIVEN the user selects a project directory containing `node_modules`
- WHEN `loadProject` recursively builds the file tree
- THEN the `node_modules` folder is included in the tree as a directory node
- AND its `children` array remains empty (recursion is skipped)
- AND the loading process completes in under 2 seconds without freezing the UI

### Requirement: Optimize BrowserFS File Listing
The `BrowserFS.listDirectory` implementation MUST NOT block the execution thread by synchronously fetching `File` objects just to read file sizes during directory iteration, as this incurs massive overhead.

#### Scenario: BrowserFS lists a directory
- GIVEN the app is using the `BrowserFS` backend
- WHEN `listDirectory` iterates over `dirHandle.entries()`
- THEN it immediately constructs `FileNode` entries without awaiting `entry.getFile()`
- AND the file `size` property is safely omitted or defaulted to undefined/0
