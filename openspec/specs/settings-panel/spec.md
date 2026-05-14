# Settings Panel Specification

## Purpose

Full-screen overlay settings panel accessible from the ActivityBar gear icon (`Ctrl+,`). Hosts AI provider configuration, appearance controls, and subscription management across tabbed sections.

## Architecture

- **SettingsPanel**: `src/components/settings/SettingsPanel.tsx` — Overlay with tab navigation
- **ByokPanel**: `src/components/settings/ByokPanel.tsx` — BYOK provider grid
- **SubagentPanel**: `src/components/settings/SubagentPanel.tsx` — Pro agent configuration
- **ContextPanel**: `src/components/settings/ContextPanel.tsx` — Context capture settings
- **PrivacyPanel**: `src/components/settings/PrivacyPanel.tsx` — Privacy controls
- **State**: `settingsVisible` in `src/stores/ui.ts`

## Requirements

### Requirement: Settings Access

Settings opens via the ActivityBar gear button (`button[title="Configuración (Ctrl+,)"]`) or via `Ctrl+,` keyboard shortcut. It renders as a full-screen overlay with backdrop blur.

### Requirement: Tab Navigation

The settings panel has the following tabs:

| Tab | Content | Visibility |
|-----|---------|-----------|
| Conexiones IA | BYOK provider grid — configure API keys for AI providers | Always |
| Apariencia | Chat position (left/right), theme preferences | Always |
| Suscripción y Uso | Plan info, token usage, prompt limits | Always |
| Agentes Pro | Subagent configuration | Pro plan only |

#### Scenario: Default tab

- GIVEN settings panel opens
- WHEN it renders
- THEN "Conexiones IA" tab is active by default
- AND the heading "Conexiones IA" is visible as `h2`

#### Scenario: Guest user tabs

- GIVEN `authMode === "unauthenticated"`
- WHEN settings panel renders
- THEN "Agentes Pro" tab is NOT visible

### Requirement: Apariencia Tab

The Apariencia tab allows changing the chat panel position (left/right) via a toggle. The change takes effect immediately and persists in the UI store.

#### Scenario: Change chat position

- GIVEN user is on the Apariencia tab
- WHEN user toggles chat position to "Izquierda"
- THEN the SidebarSlot renders on the left side of the editor
- AND the change persists across page reloads

### Requirement: Close Settings

Settings can be closed by clicking the X button, pressing `Escape`, or clicking the backdrop.

## Files

- `src/components/settings/SettingsPanel.tsx`
- `src/components/settings/ByokPanel.tsx`
- `src/components/settings/SubagentPanel.tsx`
- `src/components/settings/ContextPanel.tsx`
- `src/components/settings/PrivacyPanel.tsx`
- `src/stores/ui.ts` — `settingsVisible`, `setSettingsVisible`
