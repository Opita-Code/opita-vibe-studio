# Proposal: Vibe Studio Chat-First Redesign

## Intent

Transform Vibe-Studio from an editor-first desktop IDE (auth gate, hidden settings, nested panels) into a **chat-first + preview-first** vibe-coding environment. Chat is always visible. Preview is the default workspace. Editor and file explorer are secondary tools accessed on demand. No blocking login screen — SSO detection runs silently, app opens in guest mode if no session exists.

## Scope

### In Scope
- Remove `LoginScreen` auth gate — app loads guest-first, silent SSO detection with session sharing from cuenta.opitacode.com
- Dedicated `SettingsPanel` (gear icon in top bar) housing `ByokPanel`, `PlanCard`, and `TokenBar`
- 2-column layout: Chat (left, always visible, resizable) | Preview/Editor+Explorer (right)
- ViewTabs: Preview (default), Editor, Horizontal Split (↔)
- Explorer: collapsible dock within code section, collapsed by default, opens on demand
- Zustand store migration for new defaults (`explorerVisible: false`, `activeView: "preview"`, `chatWidth`, `settingsVisible`)

### Out of Scope
- Real OAuth/SSO endpoint implementation (keep mock SSO with session detection pattern)
- New visual design system (stays within Concepto 01/brand tokens)
- Rust/Tauri backend changes
- New features beyond layout restructure
- Terminal integration (deferred)

## Capabilities

### New Capabilities
- `settings-panel`: Slide-out settings accessible from gear icon. Hosts BYOK config, plan info, token usage. Persists open/close state across sessions.
- `view-tabs`: Three-way view switcher (Preview | Editor | Split) for the code section. Controls which content fills the right column.

### Modified Capabilities
- `auth`: Login gate removed → guest-first access + silent SSO. Non-blocking "Iniciar sesión" action in user menu.
- `desktop-shell`: New top bar with gear icon, user menu. 2-column layout replaces 3-column.
- `chat-assistant`: Chat always visible (no Ctrl+B toggle). Resizable width via drag handle.
- `code-editor`: Editor shares view area with Preview via ViewTabs. Default view is Preview, not Editor.
- `live-preview`: Preview is default view, always mounted. No visibility toggle.
- `file-system`: Explorer renders inside code section dock, not standalone sidebar. Collapsed by default.
- `byok-config`: Panel renders inside SettingsPanel (was orphaned). Core key management behavior unchanged.

## Approach

**Phased implementation via 3 chained PRs:**

| PR | Focus | Est. lines | Changes |
|----|-------|------------|---------|
| 1 | Auth de-gating + Settings panel | ~150 | Remove login gate, add guest mode, build SettingsPanel, integrate orphaned components |
| 2 | Layout restructure | ~250 | 2-column layout, ViewTabs, collapsible explorer dock, chat always visible + resizable |
| 3 | Polish + transitions | ~100 | Horizontal split, collapse animations, explorer icon bar, state migration, test updates |

PR 1 is low-risk and self-contained (no layout changes yet). PR 2 is the core restructure. PR 3 adds polish.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | **Rewrite** | Remove login gate, new 2-col layout, SSO auto-detect, settings drawer |
| `src/stores/ui.ts` | Modified | Add `explorerVisible`, `activeView`, `chatWidth`, `settingsVisible`. Remove `chatVisible`. |
| `src/stores/auth.ts` | Modified | Add `authMode` (guest/authenticated), silent auto-login action |
| `src/components/layout/` | **Restructured** | `EditorPanel` → embed FileTree + ViewTabs. `Sidebar` → remove/repurpose. `ChatPanel` → no toggle, add resize. |
| `src/components/settings/` | New | `SettingsPanel.tsx` (slide-out), integrate `ByokPanel`, `PlanCard`, `TokenBar` full mode |
| `src/components/layout/ViewTabs.tsx` | New | Preview/Editor/Split tab switcher |
| `src/components/layout/ExplorerDock.tsx` | New | Collapsible explorer with icon bar |
| `src/components/auth/LoginScreen.tsx` | Repurposed | Modal/prompt, not app gate |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SSO endpoint not ready | High | Mock session detection with placeholder; real SSO deferred to future change |
| Zustand state migration breaks persisted defaults | Medium | Migration function in ui store; clear persisted state on version mismatch |
| CSS regression from layout rewrite | Medium | Chained PRs isolate CSS changes; preserve Tailwind tokens |
| Test suite breakage (525 tests) | High | Update tests per PR; run full suite between PRs |

## Rollback Plan

Each PR is independently revertible. Revert in reverse order (3 → 2 → 1). No database migrations — all changes are frontend-only. Zustand stores can be reset by clearing localStorage `vibe-ui-state` key.

## Dependencies

- None (frontend-only changes, no backend requirements)

## Success Criteria

- [ ] App opens directly to main UI without login prompt (guest mode on cold start)
- [ ] Chat panel is always visible, no toggle needed
- [ ] Preview is the default view in code section
- [ ] Settings panel accessible via gear icon, hosts BYOK + Plan + Tokens
- [ ] Explorer is collapsed by default, expands on click
- [ ] View tabs switch between Preview, Editor, and Split
- [ ] Existing 525 tests pass (updated where layout changed)
- [ ] No regressions in file system, editor, or chat functionality
