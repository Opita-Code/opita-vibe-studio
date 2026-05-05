# Delta for Terminal

## ADDED Requirements

### Requirement: Spanish-Translated Command Output

The terminal MUST capture shell command output (stdout + stderr) and translate common technical messages to Spanish. Translations SHALL cover: file not found, permission denied, command not found, and standard npm/git status messages. Untranslated output passes through unchanged.

#### Scenario: Command error translated to Spanish

- GIVEN the user runs `node script.js` and the file doesn't exist
- WHEN the shell returns "Error: Cannot find module './script.js'"
- THEN the terminal displays "Error: No se encuentra el módulo './script.js'"
- AND the original English error is available on hover/tooltip

#### Scenario: Successful git status translated

- GIVEN the user runs `git status` and there are modified files
- WHEN git outputs "modified: index.html"
- THEN the terminal shows "modificado: index.html"

### Requirement: Preset Commands

The terminal MUST offer a dropdown of preset commands for common operations: `git status`, `git init`, `npm init`, `npm install`, `npm run dev`. Selecting a preset SHALL auto-fill the command input. Dangerous commands (`rm -rf`, `git push --force`) MUST trigger a confirmation dialog.

#### Scenario: Preset fills command input

- GIVEN the terminal is open
- WHEN the user selects "git status" from the preset dropdown
- THEN "git status" populates the command input
- AND the user can edit before pressing Enter

### Requirement: Command Execution via Shell Plugin

Commands MUST execute through `@tauri-apps/plugin-shell` with a 30-second timeout. The terminal SHALL show a spinner during execution and display exit codes. The shell context (working directory) MUST be bound to the open project folder.

#### Scenario: Long-running command times out

- GIVEN a command exceeds 30 seconds
- WHEN the timeout fires
- THEN the process is killed
- AND the terminal displays "⏱️ Comando cancelado: excedió 30 segundos"
