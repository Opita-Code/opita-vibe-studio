# Design: Vibe Studio Chat-First Redesign

## Technical Approach

Transform the editor-first 3-column IDE into a **chat-first 2-column layout** with silent SSO detection and guest-first access. Chat occupies the left column (always visible, resizable). Preview, Editor, and Explorer share the right column via a ViewTabs state machine. Settings slide out from a top-bar gear icon. The login gate is removed; SSO runs silently in the background.

Core strategy: **minimal store surgery**. Extend `useUIStore` with 5 fields instead of creating a new store. Auth transitions from boolean `isAuthenticated` gate to `authMode` (guest | authenticated) with silent detection on mount.

## Architecture Decisions

### Decision 1: Extend useUIStore vs. new layoutStore

| Option | Tradeoff |
|--------|----------|
| New `layoutStore` | Clean separation but spreads related state across stores |
| Extend `useUIStore` | All panel layout in one place, simpler selectors, fewer imports |

**Choice**: Extend `useUIStore`. Add `activeView`, `explorerVisible`, `chatWidth`, `settingsVisible`, `splitRatio`. Remove `chatVisible`, `previewVisible`, `previewRatio`.

**Rationale**: `sidebarWidth`, `previewRatio`, and the new fields are all panel-layout state. Keeping them together avoids cross-store coordination and simplifies the ViewTabs state machine.

### Decision 2: authMode over isAuthenticated boolean

**Choice**: Replace `isAuthenticated: boolean` with `authMode: "guest" | "authenticated"`. Guest mode renders the main UI with 30-prompt cap.

**Rationale**: A boolean cannot express the guest-vs-authenticated distinction needed for showing/hiding BYOK, unlimited prompts, and user avatar. `authMode` maps directly to plan tiers.

### Decision 3: ViewTabs as store-controlled state machine

**Choice**: ViewTabs reads `activeView` from `useUIStore`. Three states: `"preview"` (default), `"editor"`, `"split"`. Tab click sets state; split button toggles between preview and split.

**Rationale**: Store persistence (localStorage) and keyboard shortcuts need a single source of truth. Uncontrolled component state loses these capabilities.

### Decision 4: Explorer as collapsible dock inside right column

**Choice**: Collapsible dock (32px icon bar collapsed, 240px expanded) rendered inside the right-column flex container. Uses `explorerVisible` (default false).

**Rationale**: Keeps the 2-column promise. Explorer is a tool, not a permanent fixture. Matches VS Code's activity bar pattern without a third column.

## Data Flow

```
App mounts
  ├─→ detectSession() [async, non-blocking]
  │     ├─ token found + valid → authMode = "authenticated"
  │     └─ no token / expired  → authMode = "guest"
  │
  └─→ render 2-col layout immediately
        ├─ Left col: ChatPanel
        │     ├─ GuestBanner (authMode === "guest")
        │     ├─ MessageList + ChatInput
        │     └─ ResizeHandle (right edge)
        └─ Right col: ViewTabs + Content
              ├─ activeView === "preview" → LivePreview
              ├─ activeView === "editor"  → ExplorerDock + MonacoEditor
              └─ activeView === "split"   → LivePreview (top) | Editor (bottom)

Top bar: gear icon → SettingsPanel (slide-out, z-50)
  └─ BYOK | Plan | Tokens tabs
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/App.tsx` | **Rewrite** | 2-col layout, top bar, SSO detection, no login gate |
| `src/stores/ui.ts` | Modify | Add `activeView`, `explorerVisible`, `chatWidth`, `settingsVisible`, `splitRatio`; remove `chatVisible`, `previewVisible`, `previewRatio` |
| `src/stores/auth.ts` | Modify | Add `authMode`, `sessionDetected`, `detectSession()`; repurpose `enableGuestMode()` |
| `src/components/layout/ViewTabs.tsx` | **Create** | Preview\|Editor\|Split tab bar |
| `src/components/settings/SettingsPanel.tsx` | **Create** | Slide-out panel (360px, z-50) with tabs |
| `src/components/layout/ExplorerDock.tsx` | **Create** | Collapsible dock: icon bar → FileTree |
| `src/components/auth/GuestBanner.tsx` | **Create** | Prompt counter + login CTA in ChatPanel |
| `src/components/layout/ChatPanel.tsx` | Modify | Remove toggle, add ResizeHandle, add GuestBanner |
| `src/components/layout/Sidebar.tsx` | **Delete** | Functionality moved to ExplorerDock |
| `src/components/layout/EditorPanel.tsx` | **Rewrite** | ViewTabs-controlled: Preview OR Editor OR Split |
| `src/components/auth/LoginScreen.tsx` | Modify | Render as modal, not startup gate |
| `src/components/layout/StatusBar.tsx` | Modify | Show auth status (guest/logged in) |

## Interfaces / Contracts

```typescript
// New UI store fields
type ActiveView = "preview" | "editor" | "split";

// Added to UIState:
activeView: ActiveView;       // default "preview"
explorerVisible: boolean;     // default false
chatWidth: number;            // default 320, clamp [280, 50vw]
settingsVisible: boolean;     // default false
splitRatio: number;           // default 0.5, clamp [0.2, 0.8]

// Removed from UIState:
chatVisible, previewVisible, previewRatio

// Auth store changes
type AuthMode = "guest" | "authenticated";

// Added to AuthState (replaces isAuthenticated):
authMode: AuthMode;           // default "guest"
sessionDetected: boolean;     // true once detection completes

// New action:
detectSession(): Promise<void>;  // silent, non-blocking
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | ViewTabs transitions, authMode logic, store clamp functions | Vitest pure function tests |
| Integration | SettingsPanel open/close, ExplorerDock expand/collapse, ChatPanel resize, GuestBanner visibility | @testing-library/react + jsdom |
| Regression | All 525+ existing tests pass (layout-affecting tests updated) | `npx vitest run` |

## Migration / Rollout

Each PR independently revertible (reverse order: 3→2→1). No backend migrations. Zustand `vibe-ui-state` stores new defaults; on schema mismatch (old keys detected), clear storage and re-initialize. No data loss — all user content is project files.

## Open Questions

- [ ] Real SSO endpoint from cuenta.opitacode.com — deferred to future change (mock only)
- [ ] First-run tooltip for Settings discoverability — can be added in PR 3 polish
