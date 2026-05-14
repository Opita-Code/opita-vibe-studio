# Command Handler Specification

## Purpose

Define the Tauri command registration contract. Every `#[tauri::command]` function implemented in Rust MUST be registered in `generate_handler![]` to be invokable from the frontend via IPC. Unregistered commands fail silently with "command not found".

## Requirements

### Requirement: Command Registration

The Tauri backend MUST register all 8 implemented commands in `generate_handler![]`: `read_file`, `write_file`, `list_dir`, `create_dir`, `delete_entry`, `open_folder_dialog`, `validate_project`, `exec_shell`. The `mod commands;` declaration SHALL be present in `lib.rs` to compile the command modules into the crate. Compilation MUST pass (`cargo check` exit code 0).

#### Scenario: All commands registered in handler macro

- GIVEN the Tauri backend compiles
- WHEN `generate_handler![]` is expanded
- THEN all 8 commands are listed in the macro invocation
- AND `cargo check` exits with code 0

#### Scenario: Abrir carpeta invokes native dialog

- GIVEN commands are registered
- WHEN the user clicks "Abrir Carpeta" in the UI
- THEN `open_folder_dialog` is invoked via IPC
- AND the native OS folder dialog opens
- AND the selected folder path is returned to the frontend

#### Scenario: File tree populates from filesystem

- GIVEN a project folder path was selected
- WHEN `list_dir` is invoked with that path
- THEN real filesystem entries are returned
- AND the file tree renders the folder contents
- AND `read_file` returns file contents when a file is opened

#### Scenario: Ctrl+S writes changes to disk

- GIVEN a file is open in the editor with unsaved changes
- WHEN the user presses Ctrl+S
- THEN `write_file` is invoked with the file path and content
- AND the content is persisted to disk
- AND a subsequent `read_file` returns the updated content
