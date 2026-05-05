# Delta for Code Editor

## ADDED Requirements

### Requirement: Monaco Editor Integration

The editor pane MUST embed Monaco Editor (`@monaco-editor/react`) with lazy-loading. Syntax highlighting SHALL activate automatically based on file extension (.html, .css, .js). The editor MUST support undo/redo, find/replace, and line numbers.

#### Scenario: Editor opens an HTML file

- GIVEN a project with `index.html` in the file tree
- WHEN the user clicks `index.html`
- THEN Monaco loads and displays the file content with HTML syntax highlighting
- AND line numbers appear in the gutter

### Requirement: File Tabs

The editor MUST display open files as tabs above the editor area. Tabs SHALL show the filename and a close button. Unsaved files MUST show a dot indicator.

#### Scenario: Multiple files open with unsaved indicator

- GIVEN `index.html` is open with unsaved changes
- WHEN the user opens `styles.css`
- THEN both files appear as tabs: `styles.css` (active), `index.html` (with dot indicator)
- AND clicking `index.html` switches to that file
- AND closing the tab prompts save if unsaved

### Requirement: File Save

The editor MUST support save via Ctrl+S. The system SHALL write file contents to disk via Tauri fs plugin IPC. Save status MUST display briefly ("Guardado") on success.

#### Scenario: Save modified file

- GIVEN a file has unsaved changes
- WHEN the user presses Ctrl+S
- THEN the file content is written to the project folder via IPC
- AND the unsaved indicator is removed from the tab
- AND a brief "Guardado" toast appears

### Requirement: AI-Generated Code Insertion

When the AI generates code blocks, the system SHALL offer an "Aplicar" button per code block. Clicking it MUST create or update the corresponding file in the project and open it in the editor.

#### Scenario: Apply AI-generated HTML

- GIVEN the AI responds with ` ```html ... ``` ` containing a complete HTML file
- WHEN the user clicks "Aplicar" on the code block
- THEN `index.html` is created/overwritten in the project folder
- AND the file opens in the editor with the new content
