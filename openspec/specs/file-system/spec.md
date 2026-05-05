# Delta for File System

## ADDED Requirements

### Requirement: Open Project Folder

The system MUST provide an "Abrir Carpeta" button that invokes the native folder dialog via `@tauri-apps/plugin-dialog`. Upon selection, the file tree SHALL populate with the folder contents. The last opened folder path MUST persist across sessions via SQLite.

#### Scenario: User opens a project folder

- GIVEN no project is open
- WHEN the user clicks "Abrir Carpeta" and selects a folder
- THEN a recursive file tree renders in the sidebar
- AND the folder path is stored and restored on next app launch

### Requirement: File Tree Component

The file tree MUST display files and folders hierarchically with icons per file type. It SHALL support expand/collapse for folders, single-click to open files, and a context menu with: "Nuevo archivo", "Nueva carpeta", "Renombrar", "Eliminar".

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

When a project folder is a git repository, the file tree SHOULD display git status indicators (modified, added, deleted, untracked) via colored dots or icons next to filenames. Detection MUST use the `git status` command via Tauri shell plugin.

#### Scenario: Modified file shows git indicator

- GIVEN a git-tracked file has uncommitted changes
- WHEN the file tree renders
- THEN a yellow dot appears next to the filename
- AND the indicator updates after file save

### Requirement: File Watching

The system SHOULD watch the project folder for external changes (via Tauri fs watch) and refresh the file tree and open editor tabs automatically.

#### Scenario: External tool modifies a file

- GIVEN `styles.css` is open in the editor
- WHEN an external tool (e.g., VS Code) saves changes to the same file
- THEN the editor content refreshes without losing scroll position
- AND a subtle notification indicates the file was updated externally
