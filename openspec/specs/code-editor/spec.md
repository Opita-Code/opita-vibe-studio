# Code Editor Specification

## Purpose

Monaco-based code editor with tabbed file management, syntax highlighting, and AI-aware toolbar.

## Architecture

- **EditorPanel**: `src/components/layout/EditorPanel.tsx` — Main editor container with Monaco
- **ViewTabs**: `src/components/layout/ViewTabs.tsx` — Top-level view tabs (Editor, Preview, Split)
- **FileTabs**: `src/components/editor/FileTabs.tsx` — Open file tabs with close buttons
- **EditorToolbar**: `src/components/editor/EditorToolbar.tsx` — Quick actions (Explain, Optimize, Fix, Tests)
- **MonacoEditor**: `src/components/editor/MonacoEditor.tsx` — Monaco wrapper component
- **FileWatcher**: `src/components/editor/FileWatcher.tsx` — Watches file changes for live reload
- **Store**: `src/stores/project.ts` — Open files, active tab, file contents

## Requirements

### Requirement: Monaco Integration

The editor uses Monaco Editor for code editing with syntax highlighting, IntelliSense, and multi-file support.

### Requirement: File Tabs

Open files appear as tabs above the editor. Each tab shows the filename, and can be closed with the X button. The active tab is highlighted.

### Requirement: View Tabs

ViewTabs provide top-level navigation between Editor, Preview, and Split views.

### Requirement: AI Quick Actions

The EditorToolbar shows contextual AI actions for the active file: Explicar, Optimizar, Fix, Tests. These inject the active file's content into the chat context.

## Files

- `src/components/layout/EditorPanel.tsx`
- `src/components/layout/ViewTabs.tsx`
- `src/components/editor/FileTabs.tsx`
- `src/components/editor/EditorToolbar.tsx`
- `src/components/editor/MonacoEditor.tsx`
- `src/components/editor/FileWatcher.tsx`
- `src/stores/project.ts`
