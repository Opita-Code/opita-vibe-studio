# Desktop Shell Specification

## Summary

Tauri v2 desktop shell with a micro-kernel extension architecture. The shell uses a CoreHost to register extensions (views, commands) at boot, rendering them into layout slots (SidebarSlot, EditorSlot, StatusbarSlot).

## Architecture

### Extension System

- **CoreHost**: `src/core/CoreHost.ts` — Boots extensions, provides `ExtensionContext` with `views.registerView()` and `commands.registerCommand()`
- **coreStore**: `src/core/state/coreStore.ts` — Zustand store holding registered views and commands
- **Extensions**: `src/extensions/` — Self-registering modules:
  - `vibe-ai` — Registers ChatPanel as sidebar view (lazy-loaded)
  - `vibe-preview` — Registers preview as editor view
  - `vibe-viewtabs` — Registers ViewTabs as editor chrome

### Layout Slots

- **SidebarSlot**: `src/renderer/layouts/SidebarSlot.tsx` — Renders views with `target: "sidebar"`, sorted by `order`
- **EditorSlot**: `src/renderer/layouts/EditorSlot.tsx` — Renders editor-target views
- **StatusbarSlot**: `src/renderer/layouts/StatusbarSlot.tsx` — Renders statusbar-target views

### Desktop-Specific Features

- **TitleBar**: `src/components/layout/TitleBar.tsx` — Custom window title bar with traffic lights
- **Window management**: Single instance enforcement, custom window controls
- **Native FS**: Tauri IPC commands for file system access (`src-tauri/src/commands/fs.rs`)
- **MCP Bridge**: `src/services/mcpClient.ts` — Rust-React bridge for local terminal commands

## Requirements

### Requirement: Extension Registration

All UI panels MUST be registered as extensions via `CoreHost.boot()`. Hardcoded panel rendering is legacy and being migrated to slot-based architecture.

#### Scenario: Chat panel registration

- GIVEN the `vibe-ai` extension is loaded
- WHEN `CoreHost.boot()` runs
- THEN `registerView({ id: 'vibe.view.chat', target: 'sidebar', component: ChatPanelLazy })` is called
- AND the ChatPanel becomes available in SidebarSlot when `activeSidebar === "chat"`

### Requirement: Platform Detection

The app detects Tauri vs browser at runtime via `src/lib/platform.ts`. Desktop-specific features (TitleBar, native FS, MCP) are only enabled in Tauri context.

### Requirement: ActivityBar Navigation

The ActivityBar (`src/components/layout/ActivityBar.tsx`) provides primary navigation:
- Explorer (`Ctrl+B`) — toggles ExplorerDock
- Search (`Ctrl+Shift+F`) — toggles search sidebar
- Vibe AI Chat (`Ctrl+L`) — toggles chat sidebar
- Bug Report — opens BugReportModal
- Settings (`Ctrl+,`) — opens SettingsPanel
- Landing link (guests only) — external link to vibe.opitacode.com
- User avatar (authenticated) — shows initial, click to logout

## Files

- `src/core/CoreHost.ts`
- `src/core/state/coreStore.ts`
- `src/core/types.ts`
- `src/extensions/vibe-ai/index.ts`
- `src/extensions/vibe-preview/index.ts`
- `src/extensions/vibe-viewtabs/index.ts`
- `src/renderer/layouts/SidebarSlot.tsx`
- `src/renderer/layouts/EditorSlot.tsx`
- `src/renderer/layouts/StatusbarSlot.tsx`
- `src/components/layout/ActivityBar.tsx`
- `src/components/layout/TitleBar.tsx`
- `src/lib/platform.ts`
