# Terminal Specification

## Purpose

Integrated terminal panel for executing commands. Togglable via `Ctrl+J` or the MobileNavBar "Terminal" tab.

## Architecture

- **TerminalPanel**: `src/components/terminal/TerminalPanel.tsx` — Terminal UI with output display
- **State**: `terminalVisible` in `src/stores/ui.ts`
- **MCP Bridge**: `src/services/mcpClient.ts` — Routes commands to Tauri backend for local execution

## Requirements

### Requirement: Toggle Terminal

The terminal panel toggles via `Ctrl+J` keyboard shortcut or the "Terminal" button in MobileNavBar. When visible, it appears at the bottom of the editor area.

### Requirement: Command Execution

In Tauri mode, commands are executed via the MCP bridge (`handleMcpToolRequest`). In web mode, terminal functionality is limited to display only.

### Requirement: Spanish Output

Terminal status messages and labels are in Spanish (e.g., "Terminal", "Ejecutando...").

## Files

- `src/components/terminal/TerminalPanel.tsx`
- `src/stores/ui.ts` — `terminalVisible`, `setTerminalVisible`
- `src/services/mcpClient.ts`
