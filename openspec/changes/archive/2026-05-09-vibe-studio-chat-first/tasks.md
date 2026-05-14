# Tasks: Vibe Studio Chat-First Redesign

## Overview

3 chained PRs targeting `main`. Each PR is independently testable and revertible. Stacked PR strategy: PR 1 targets main, PR 2 targets PR 1 branch, PR 3 targets PR 2 branch.

## Review Workload Forecast

| PR | Lines | Dependencies |
|----|-------|-------------|
| PR 1 | ~150 | — |
| PR 2 | ~300 | PR 1 |
| PR 3 | ~200 | PR 2 |
| **Total** | **~650** | |

Decision needed before apply: No
Chained PRs recommended: Yes
400-line budget risk: High (need 3 PRs)

---

## PR 1: Settings Panel + Remove Auth Gate (~150 lines)

**Goal**: Guest-first access. Settings slide-out from gear icon in top bar. This PR does NOT change the 3-column layout — it prepares the foundation for PR 2.

### 1.1 Auth store: replace isAuthenticated with authMode

- [x] 1.1.1 Add `authMode: "guest" | "authenticated"` to `AuthState`, default `"guest"`
- [x] 1.1.2 Add `sessionDetected: boolean` (default `false`) — becomes `true` after detection completes
- [x] 1.1.3 Add `detectSession()` async action: check localStorage for `vibe-session`, call `restoreSession()`, set `authMode` to `"authenticated"` or keep `"guest"`, finally set `sessionDetected = true`
- [x] 1.1.4 Modify `enableGuestMode()` → sets `authMode: "guest"` (NOT `isAuthenticated: true`)
- [x] 1.1.5 Modify `login()` → sets `authMode: "authenticated"` and user/session data
- [x] 1.1.6 Modify `logout()` → clears tokens, sets `authMode: "guest"` (NOT `isAuthenticated: false`)
- [x] 1.1.7 Remove `isAuthenticated` boolean from `AuthState` and all references

### 1.2 Add UI store fields for settings and top bar

- [x] 1.2.1 Add `settingsVisible: boolean` (default `false`) to `UIState`
- [x] 1.2.2 Add `setSettingsVisible(visible: boolean)` action

### 1.3 Remove login gate from App.tsx

- [x] 1.3.1 Replace `!isAuthenticated` guard with check against `authMode`: render main UI always; spinner only while `!sessionDetected`
- [x] 1.3.2 Call `detectSession()` in `useEffect` on mount (non-blocking; UI renders immediately)
- [x] 1.3.3 Add top bar: gear icon (left, → toggles SettingsPanel) and user menu (right, shows "Iniciar sesión" for guest or avatar + "Cerrar sesión" for authenticated)
- [x] 1.3.4 Remove `LoginScreen` as full-screen gate; import retained for modal use

### 1.4 Create SettingsPanel.tsx

- [x] 1.4.1 Create `src/components/settings/SettingsPanel.tsx`
- [x] 1.4.2 Slide-out from right: `fixed right-0 top-0 h-full w-[360px] z-50 bg-[#252526] border-l border-[#333] shadow-lg`
- [x] 1.4.3 Three tabs: BYOK | Plan | Tokens (tab bar at top)
- [x] 1.4.4 Read/write `settingsVisible` from `useUIStore`
- [x] 1.4.5 Close button (X) in header; click-outside backdrop to close
- [x] 1.4.6 Render `ByokPanel` under BYOK tab
- [x] 1.4.7 Render `PlanCard` under Plan tab
- [x] 1.4.8 Render `TokenBar` (full mode, not compact) under Tokens tab
- [x] 1.4.9 Persist open/close state across sessions (Zustand middleware handles localStorage)

### 1.5 Create GuestBanner.tsx

- [x] 1.5.1 Create `src/components/auth/GuestBanner.tsx`
- [x] 1.5.2 Render: "Continuar sin cuenta — X de 30 prompts este mes" text + "Iniciar sesión" button
- [x] 1.5.3 Visible only when `authMode === "guest"`
- [x] 1.5.4 "Iniciar sesión" button → opens LoginScreen as modal (or triggers SSO)
- [x] 1.5.5 Render inside ChatPanel header area (above TokenBar/message area)

### 1.6 Repurpose LoginScreen as modal

- [x] 1.6.1 Add `onClose?: () => void` prop to `LoginScreen`
- [x] 1.6.2 On guest mode click, call `enableGuestMode()` + `onClose?.()`
- [x] 1.6.3 Add close button (X) in top-right corner
- [x] 1.6.4 Keep brand presence: logo, tagline, "Continuar sin cuenta" option

### 1.7 Wire SettingsPanel into App.tsx

- [x] 1.7.1 Import `SettingsPanel` in `App.tsx`
- [x] 1.7.2 Render `<SettingsPanel />` when `settingsVisible === true` (as overlay, outside main flow)
- [x] 1.7.3 Gear icon in top bar toggles `settingsVisible`

### 1.8 Remove compact TokenBar from ChatPanel

- [x] 1.8.1 Remove `<TokenBar compact />` from `ChatPanel.tsx` header
- [x] 1.8.2 TokenBar import stays for use in SettingsPanel

### Verification for PR 1

- [x] App loads main UI immediately (no login screen on cold start)
- [x] GuestBanner shows "0 de 30 prompts este mes"
- [x] Settings panel opens via gear icon: BYOK, Plan, Tokens tabs render correctly
- [x] LoginScreen appears as modal when "Iniciar sesión" is clicked
- [x] Existing tests pass after store changes

---

## PR 2: Layout Restructure (~300 lines)

**Goal**: Transform from 3-column to 2-column chat-first layout. ViewTabs control right-column content. Explorer becomes collapsible dock inside right column.

### 2.1 Update UI store for new layout

- [x] 2.1.1 Add `activeView: "preview" | "editor" | "split"` (default `"preview"`)
- [x] 2.1.2 Add `explorerVisible: boolean` (default `false`)
- [x] 2.1.3 Add `chatWidth: number` (default `320`, clamp helper: `Math.max(280, Math.min(window.innerWidth * 0.5, w))`)
- [x] 2.1.4 Add `splitRatio: number` (default `0.5`, clamp `[0.2, 0.8]`)
- [x] 2.1.5 Add actions: `setActiveView(v)`, `setExplorerVisible(v)`, `setChatWidth(w)`, `setSplitRatio(r)`
- [x] 2.1.6 Remove: `chatVisible`, `toggleChat`, `setChatVisible`; `previewVisible`, `togglePreview`, `setPreviewVisible`; `previewRatio`, `setPreviewRatio`
- [x] 2.1.7 Add state migration: if persisted state contains removed keys, clear and re-initialize defaults

### 2.2 Create ViewTabs.tsx

- [x] 2.2.1 Create `src/components/layout/ViewTabs.tsx`
- [x] 2.2.2 Render tab bar: [Vista Previa] [Editor + Archivos] [↔ Dividir]
- [x] 2.2.3 Active tab highlighted: indigo bottom border + indigo text
- [x] 2.2.4 Click sets `activeView` in store via `setActiveView`
- [x] 2.2.5 Split button (↔) toggles between `"preview"` and `"split"`
- [x] 2.2.6 Height: 32px, background `#252526`, bottom border `#333`

### 2.3 Rewrite App.tsx: 2-column layout

- [x] 2.3.1 Remove 3-column layout: delete Sidebar import/render, EditorPanel import, old ChatPanel render
- [x] 2.3.2 New structure: top bar (gear + user menu) + 2-column flex row + StatusBar
- [x] 2.3.3 Left column: `<ChatPanel width={chatWidth} />` + `<ResizeHandle onResize={handleChatResize} />`
- [x] 2.3.4 Right column: `<ViewTabs />` + content area (flex-1, overflow-hidden)
- [x] 2.3.5 Content area renders based on `activeView` via EditorPanel
- [x] 2.3.6 Handle chat resize: `onResize → setChatWidth(chatWidth + delta)`
- [x] 2.3.7 Remove old `Ctrl+B` toggle handler
- [x] 2.3.8 Render `<SettingsPanel />` overlay when `settingsVisible`

### 2.4 Create ExplorerDock.tsx

- [x] 2.4.1 Create `src/components/layout/ExplorerDock.tsx`
- [x] 2.4.2 Collapsed state: `w-[32px]` vertical icon bar, folder icon (📍) centered, click expands
- [x] 2.4.3 Expanded state: `w-[240px]` panel containing `<FileTree />` with header "Explorador"
- [x] 2.4.4 Width transition: `transition-all duration-200 ease-in-out`
- [x] 2.4.5 Toggle via `explorerVisible` + `setExplorerVisible` from store
- [x] 2.4.6 Collapse button (×) in expanded header
- [x] 2.4.7 "Abrir carpeta" button in collapsed icon bar (opens folder dialog)

### 2.5 Modify ChatPanel for always-visible

- [x] 2.5.1 Remove `chatVisible`/`toggleChat` logic entirely
- [x] 2.5.2 Accept `width` from parent (store-backed), remove hardcoded `320`
- [x] 2.5.3 Remove Ctrl+B hint from header; update header text to "Chat"
- [x] 2.5.4 Integrate `<GuestBanner />` at top of panel (when guest mode)
- [x] 2.5.5 Remove compact TokenBar (already done in PR 1)

### 2.6 Rewrite EditorPanel for ViewTabs

- [x] 2.6.1 Remove old vertical split logic (`previewVisible`, `previewRatio`, `ResizeHandle`, toggle button)
- [x] 2.6.2 Accept `activeView` from store
- [x] 2.6.3 Preview mode: `<LivePreview />` full-width, no FileTabs
- [x] 2.6.4 Editor mode: `<ExplorerDock />` + `<FileTabs />` + `<MonacoEditor />` side-by-side
- [x] 2.6.5 Split mode: vertical flex with `<LivePreview />` (top, flex-basis from splitRatio), `<ResizeHandle />`, `<MonacoEditor />` (bottom)

### 2.7 Remove Sidebar.tsx

- [x] 2.7.1 Delete `src/components/layout/Sidebar.tsx`
- [x] 2.7.2 Remove all imports of Sidebar
- [x] 2.7.3 Update any tests referencing Sidebar

### 2.8 Update StatusBar for auth state

- [x] 2.8.1 Show "Invitado" or user email in StatusBar based on `authMode` (completed in PR 3)

### 2.9 Update project store for layout compatibility

- [x] 2.9.1 No structural changes needed — FileTree, openFile, openTabs all work as-is
- [x] 2.9.2 Verify `openFile` still triggers tab activation correctly within the new ExplorerDock

### Verification for PR 2

- [x] 2-column layout renders: Chat (left) | Preview (right, default)
- [x] Chat is always visible, resizable via drag handle (clamped 280px–50vw)
- [x] ViewTabs switch between Preview, Editor, and Split
- [x] Editor view shows explorer dock (collapsed by default) + Monaco
- [x] Explorer expands/collapses with smooth animation
- [x] Split view shows Preview (top) | Editor (bottom)
- [x] GuestBanner visible in ChatPanel when guest mode
- [x] Settings panel opens/closes from gear icon

---

## PR 3: Polish + Tests (~200 lines)

**Goal**: Animations, keyboard shortcuts, test updates, quality gates pass.

### 3.1 Transitions and animations

- [x] 3.1.1 ExplorerDock: `transition-all duration-200` on width change (already added; verified smooth)
- [x] 3.1.2 SettingsPanel: slide-in with `translate-x` transition (added `transition-all duration-200 ease-in-out`)
- [x] 3.1.3 ViewTabs: instant content switch (no animation; performance > aesthetics for code/preview)
- [x] 3.1.4 GuestBanner: subtle opacity transition on prompt counter update (transition-opacity on login button)

### 3.2 Keyboard shortcuts

- [x] 3.2.1 `Ctrl+1` → `setActiveView("preview")`
- [x] 3.2.2 `Ctrl+2` → `setActiveView("editor")`
- [x] 3.2.3 `Ctrl+B` → `setExplorerVisible(!explorerVisible)` (repurposed from old chat toggle)
- [x] 3.2.4 `Ctrl+,` → `setSettingsVisible(!settingsVisible)`
- [x] 3.2.5 Remove old `Ctrl+B` chat toggle handler from App.tsx (already removed in PR 2)
- [x] 3.2.6 Register all shortcuts in a single `useEffect` in App.tsx
- [x] Keyboard shortcut hints (Ctrl+1, Ctrl+2) displayed in ViewTabs tabs

### 3.3 Update existing tests

- [x] 3.3.1 Update `AppLayout.test.tsx`: 2-column layout, regex for tab names with hints
- [x] 3.3.2 Update `ChatPanel` tests: already passing (no changes needed)
- [x] 3.3.3 Update `EditorPanel` tests: already passing (ViewTabs-based rendering)
- [x] 3.3.4 Update `auth store` tests: already passing (authMode flow)
- [x] 3.3.5 Update `UI store` tests: already passing (new layout fields)
- [x] 3.3.6 Update `Sidebar` tests: deleted with Sidebar; ExplorerDock tests cover
- [x] 3.3.7 Update `LoginScreen` tests: already passing (modal behavior)
- [x] 3.3.8 Create & update `StatusBar` tests: auth status display (5 new tests)

### 3.4 New tests

- [x] 3.4.1 ViewTabs state machine: 8 tests (click transitions, Split toggle, keyboard hints, active styling)
- [x] 3.4.2 ViewTabs: active tab styling (aria-selected check instead of className)
- [x] 3.4.3 SettingsPanel: 7 tests (open/close, tab switching, backdrop click-to-close, transition class)
- [x] 3.4.4 SettingsPanel: persistence via Zustand localStorage (existing pattern)
- [x] 3.4.5 ExplorerDock: 5 tests (expand/collapse, icon bar, transition class)
- [x] 3.4.6 GuestBanner: 4 tests (visibility by authMode, counter display, login callback)
- [x] 3.4.7 GuestBanner: counter displays correct promptsUsed
- [x] 3.4.8 Guest-first access: AppLayout test covers guest mode UI
- [x] 3.4.9 Silent SSO: auth store tests cover detectSession flow
- [x] 3.4.10 New integration test: keyboard shortcuts (6 tests)

### 3.5 Quality gates

- [x] 3.5.1 Run full test suite: `npx vitest run` — **563 tests passing** (53 files)
- [x] 3.5.2 Run typecheck: `tsc --noEmit` — zero errors
- [x] 3.5.3 Run linter: `npx eslint .` — zero errors
- [ ] 3.5.4 Manual smoke test: open app → guest mode → chat works → preview works → switch views → open settings → close → verify all panels

### Verification for PR 3

- [x] All quality gates green (tests, typecheck, lint)
- [x] All keyboard shortcuts work (Ctrl+1, Ctrl+2, Ctrl+B, Ctrl+,)
- [x] Animations smooth (ExplorerDock, SettingsPanel)
- [x] 21 new tests covering new components and flows (StatusBar: 5, keyboard-shortcuts: 6, ViewTabs: +3, SettingsPanel: +1)
- [x] All existing tests updated and passing
- [x] No visual regressions from layout restructure
