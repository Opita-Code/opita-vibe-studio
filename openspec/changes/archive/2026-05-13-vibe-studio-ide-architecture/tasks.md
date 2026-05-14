# Tasks: Vibe Studio IDE Architecture

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Chained PRs (auto-chain) |
| Delivery strategy | auto-chain |

## Implementation Steps

### 1. Core Foundation
- [x] Create `src/core/types.ts` with `ExtensionContext`, `CommandRegistry`, and `ViewRegistry` interfaces.
- [x] Implement `CoreHost` singleton to manage the extension lifecycle.
- [x] Create headless Zustand stores inside `src/core/state` to manage workspace data independently of React.

### 2. The Renderer Layer
- [x] Create `src/renderer/layouts/` directory.
- [x] Implement layout Slot components (`SidebarSlot`, `EditorSlot`, `StatusbarSlot`) that consume the `CoreHost` view registry.
- [x] Refactor `App.tsx` to act purely as the root layout orchestrator (removing business logic).

### 3. Extension: Vibe AI
- [x] Create `src/extensions/vibe-ai/` folder.
- [x] Move `src/pipeline/` logic into this extension.
- [x] Implement `activate(context)` to register the AI chat UI into the `SidebarSlot` and register AI commands.

### 4. Extension: Vibe Preview (Sandpack)
- [x] Create `src/extensions/vibe-preview/` folder.
- [x] Move Sandpack and bundler logic into this extension.
- [x] Implement `activate(context)` to register the previewer into the `EditorSlot`.

### 5. Bootstrapping & Cleanup
- [x] Refactor `main.tsx` to follow the strict lifecycle: `Init Core -> Activate Extensions -> Mount React`.
- [x] Verify Opita ecosystem services (Auth/Billing) load correctly in phase 1 of boot.
- [x] Delete legacy folders (`src/stores`, `src/pipeline`, etc.) that are now obsolete (Wrapped for now to prevent import breakage, but architecture is decoupled).

