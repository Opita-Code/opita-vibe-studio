# Project Export Specification

## Purpose

Platform-adaptive ZIP export of all project files. On Tauri, delivers via native save dialog. On web, delivers via browser download.

## Requirements

### Requirement: Export Button

The system MUST render an "Exportar Proyecto" button in the top bar toolbar area. The button SHALL be visible only when a project is open. It MUST trigger the export workflow.

#### Scenario: Export button visible with open project

- GIVEN a project folder is open
- WHEN the top bar renders
- THEN an "Exportar Proyecto" button is visible
- AND clicking it initiates the export workflow

#### Scenario: Export button hidden without project

- GIVEN no project is open (empty state)
- WHEN the top bar renders
- THEN the export button is hidden or disabled

### Requirement: ZIP Creation

The system MUST create a ZIP archive containing all project files using JSZip. The archive SHALL preserve the original directory structure (relative paths). Files excluded by `.gitignore` patterns SHOULD be omitted. Binary files MUST be included as-is without corruption.

#### Scenario: Export small project

- GIVEN a project with 3 files in 2 directories is open
- WHEN the user clicks "Exportar Proyecto"
- THEN a ZIP blob is created containing all 3 files at correct relative paths
- AND `node_modules` and `.git` directories are excluded

#### Scenario: Export project with binary files

- GIVEN a project contains `logo.png` alongside source files
- WHEN the export runs
- THEN the PNG is included as a binary entry in the ZIP
- AND the extracted PNG matches the original byte-for-byte

### Requirement: Tauri Export (Native Save Dialog)

On Tauri desktop, the system MUST prompt the user for a save destination via `@tauri-apps/plugin-dialog` save dialog. The ZIP file SHALL be written to the selected path.

#### Scenario: Save dialog on Tauri

- GIVEN the app runs on Tauri and a ZIP blob has been created
- WHEN export triggers
- THEN a native save dialog opens with default filename `{project-name}.zip`
- AND upon user confirmation, the ZIP is written to disk
- AND a success notification is shown

#### Scenario: User cancels save dialog

- GIVEN the save dialog is open on Tauri
- WHEN the user clicks "Cancel"
- THEN the export is aborted
- AND no file is written to disk

### Requirement: Web Export (Browser Download)

In browser mode, the system MUST create a downloadable blob URL and trigger a browser download. The download SHALL use the `<a download>` mechanism with filename `{project-name}.zip`. The blob URL MUST be revoked after download completes.

#### Scenario: Browser download triggered

- GIVEN the app runs in a browser and a ZIP blob has been created
- WHEN export triggers
- THEN a temporary blob URL is generated
- AND an `<a>` element click is programmatically triggered with `download` attribute
- AND the blob URL is revoked within 5 seconds

### Requirement: Export Progress

For projects with more than 50 files, the system SHOULD display a progress indicator during ZIP creation. The indicator SHALL show current file count vs total files. Progress feedback MUST not block the UI thread.

#### Scenario: Progress for large project

- GIVEN a project with 200 files is open
- WHEN export is triggered
- THEN a progress dialog or indicator appears showing "Procesando 45/200 archivos..."
- AND the UI remains responsive during ZIP creation
