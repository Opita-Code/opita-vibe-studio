# Proposal: Vibe Studio IDE Architecture

## Intent
Transform Vibe Studio from a monolithic React SPA into a modular, extensible Web IDE. The new architecture will strictly decouple the Engine (Core/Host) from the Presentation (Renderer) and introduce a formal Extension System, mirroring the design principles of modern IDEs like VS Code, while deeply integrating into the Opita OS ecosystem.

## Proposed Architecture

### 1. The Core Host (Engine)
The Core Host is the brain of Vibe Studio. It runs independently of the React component tree and acts as the central registry.
- **State Management:** A headless Zustand store or a custom Event Bus that holds the absolute truth (Workspace State, Active Files, Extension Registry).
- **Service Locator / DI:** A dependency injection container where core services (FileSystem, Auth, AI Router) are registered and resolved.
- **Lifecycle Manager:** Handles bootstrapping the environment before React even mounts.

### 2. Extension System (The Plugin API)
Everything outside the absolute core should be an extension.
- **Contract:** Every extension exports an `activate(context: ExtensionContext)` and `deactivate()` method.
- **Contributions:** Extensions can contribute:
  - **Commands:** Actionable items (e.g., "AI: Generate Code").
  - **Views/Panels:** React components injected into specific UI slots (Sidebar, Activity Bar, Panel).
  - **Providers:** Custom logic implementations (e.g., `AnthropicProvider`, `SandpackPreviewProvider`).
- **Isolation:** Heavy operations (like the AI Pipeline) will run in Web Workers to prevent blocking the UI thread. The Preview engine will remain in an isolated IFrame.

### 3. Opita Ecosystem Integration
- **Identity (Opita Accounts):** Injected as a Core Service (`AuthService`). The Host will ensure valid sessions via `accounts.opitacode.com` before booting the workspace.
- **Monetization (Wompi):** Managed by a dedicated `BillingExtension` that hooks into the UI and listens for "Premium Feature" triggers.
- **Context & Storage (Context7 + S3):** Handled by a `WorkspaceStorageService` that abstracts local IndexedDB, S3 remote sync, and Context7 documentation lookups.

### 4. The Renderer (Presentation)
- **Dumb UI:** React components will solely act as visual consumers of the Core Host state.
- **Slot-Based Layout:** The UI will define layout slots (e.g., `SidebarSlot`, `EditorSlot`). Extensions will ask the Core to render their views into these slots.
- **Glass & Glow:** The premium aesthetic remains, but applied via a centralized theme engine (`ThemeService`).

## Migration Strategy (Recycling)
1. **Bootstrap the Host:** Create the new `src/core` folder and establish the Event Bus and Extension Registry.
2. **Wrap MVP Features:** Refactor the existing AI Pipeline (`src/pipeline`) and Sandpack logic into the new `Extension` format.
3. **Swap the UI:** Rebuild `App.tsx` as a slot-based layout that reads from the Core, stripping out legacy business logic.

## Open Questions & Risks
- **Complexity:** A true plugin system adds boilerplate. Is the team ready to adopt the `activate(context)` pattern for all new features?
- **Worker Communication:** Moving the AI Pipeline to a Web Worker requires asynchronous IPC (PostMessage). This will require refactoring how streaming responses are handled.

