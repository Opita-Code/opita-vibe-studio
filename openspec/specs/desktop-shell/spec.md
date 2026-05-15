# Desktop Shell Specification

## Purpose

Layout principal de Vibe Studio — un IDE web-first con soporte Tauri v2 para escritorio. Usa ActivityBar como navegación primaria, con panels responsivos para chat, editor, y preview.

## Architecture

- **Entry**: `src/App.tsx` — Router principal, detección de sesión, layout mounting
- **Layout**: ActivityBar-driven — NO usa el sistema de Extensions/CoreHost (deprecado)
- **Store**: `src/stores/ui.ts` — UIStore (sidebar, views, panels, fullscreen)
- **Responsive**: Mobile-first con breakpoints para desktop

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│                   ActionBar                     │
├──────┬────────────────────────┬─────────────────┤
│      │                        │                 │
│  AB  │     Chat / Editor      │    Preview      │
│      │      (split view)      │                 │
│      │                        │                 │
├──────┴────────────────────────┴─────────────────┤
│                   StatusBar                     │
└─────────────────────────────────────────────────┘
AB = ActivityBar (vertical sidebar icons)
```

### Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| ActivityBar | `src/components/layout/ActivityBar.tsx` | Vertical icon sidebar: explorer, chat, search, settings, profile popover |
| ActionBar | `src/components/layout/ActionBar.tsx` | Top bar: model selector, mode buttons, branding |
| StatusBar | `src/components/layout/StatusBar.tsx` | Bottom bar: status messages, compact TokenBar, sync status |
| CommandPalette | `src/components/layout/CommandPalette.tsx` | Ctrl+K omnibar with commands, settings, search |
| EditorPanel | `src/components/layout/EditorPanel.tsx` | Code editor wrapper (Monaco-based) |
| ChatPanel | `src/components/layout/ChatPanel.tsx` | AI chat with agent handler integration |

### View Modes (UIStore)

| ActiveView | Description |
|------------|-------------|
| `"editor"` | Code editor only |
| `"preview"` | Live preview only |
| `"split"` | Side-by-side editor + preview |

### Sidebar (ActiveSidebar)

| Value | Panel |
|-------|-------|
| `"explorer"` | File tree |
| `"chat"` | AI chat |
| `"search"` | Search panel |
| `null` | Sidebar collapsed |

## Requirements

### Requirement: ActivityBar Navigation

The ActivityBar MUST provide icon-based navigation for all primary panels.

#### Scenario: Switch to explorer
- GIVEN any sidebar is active
- WHEN user clicks the explorer icon
- THEN `activeSidebar` = `"explorer"` and file tree renders

#### Scenario: Profile popover with gamification
- GIVEN user is authenticated
- WHEN user clicks the avatar icon
- THEN a popover shows: Level, Total XP, Streak, plan, logout button

### Requirement: Command Palette

Ctrl+K or Ctrl+P opens the CommandPalette with all registered commands.

#### Scenario: Available commands
- GIVEN the palette is open
- THEN 10 commands are available: New File, Report Bug, Toggle Theme, Missions, Chat Fullscreen, New Chat, Explorer, Export, Editor Settings, AI Settings

### Requirement: Chat Fullscreen Mode

The chat panel MUST support fullscreen mode, hiding all other panels.

### Requirement: Responsive Mobile Layout

On mobile viewports (<768px), the ActivityBar collapses and navigation uses a bottom tab bar or hamburger menu.

### Requirement: Gamification Integration

XPBar and MilestoneToast overlay are rendered globally in App.tsx.

## Desktop-Specific (Tauri v2)

- **TitleBar**: Custom window title bar with traffic lights (macOS) or min/max/close (Windows)
- **Native FS**: Tauri IPC commands for file system access via `src-tauri/src/commands/fs.rs`
- **MCP Bridge**: `src/services/mcpClient.ts` — Rust-React bridge for local terminal commands
- **Single instance**: Window management enforces single app instance

## Files

- `src/App.tsx` — Root component, layout orchestration
- `src/stores/ui.ts` — UIStore (views, sidebar, panels, fullscreen)
- `src/components/layout/ActivityBar.tsx` — Primary navigation
- `src/components/layout/ActionBar.tsx` — Top toolbar
- `src/components/layout/StatusBar.tsx` — Bottom status bar
- `src/components/layout/CommandPalette.tsx` — Omnibar (Ctrl+K)
- `src/components/layout/ChatPanel.tsx` — AI chat panel
- `src/components/layout/EditorPanel.tsx` — Code editor
- `src/components/gamification/XPBar.tsx` — XP progress bar
- `src/components/gamification/MilestoneToast.tsx` — Achievement overlay
- `src/renderer/LegacyLogicManager.tsx` — TEMPORARY: legacy business logic (pending decomposition)
