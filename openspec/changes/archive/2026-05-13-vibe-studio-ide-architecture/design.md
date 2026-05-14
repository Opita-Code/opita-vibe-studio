# Design: Vibe Studio IDE Architecture

## 1. Directory Structure

We will restructure `src/` to reflect the clean architecture:

```
src/
├── core/                  # The Engine (No React dependency where possible)
│   ├── host/              # Bootstrapper and Extension Manager
│   ├── services/          # Auth, Storage, Telemetry
│   ├── state/             # Global Zustand stores (headless)
│   └── types/             # Contracts (ExtensionContext, etc)
├── extensions/            # The Plugins (Internal first)
│   ├── vibe-ai/           # The AI Pipeline, LLM Routers, Chat View
│   ├── vibe-preview/      # Sandpack isolation, Preview View
│   └── vibe-billing/      # Wompi integration, Premium gates
├── renderer/              # The UI (React)
│   ├── layouts/           # Slots (Sidebar, Editor, Statusbar)
│   ├── components/        # Dumb Glass & Glow design tokens
│   └── App.tsx            # The Root Renderer
└── main.tsx               # Entry point
```

## 2. Bootstrapping Flow (The Lifecycle)

To ensure the engine is ready before the UI mounts, the startup sequence is strictly linear:

1. **Phase 1: Core Init (`main.tsx`)**
   - Initialize the `CoreHost` singleton.
   - Resolve Core Services (Auth check, load local settings).
2. **Phase 2: Extension Activation**
   - Read the manifest of active extensions.
   - Call `activate(context)` on each extension sequentially (or parallel if independent).
   - Extensions register their commands and views into the `CoreHost`.
3. **Phase 3: Renderer Mount**
   - The React root is rendered.
   - Layout components read the registered views from the `CoreHost` and paint the UI.

## 3. Sandboxing & Workers (Future-proofing)
- The `vibe-preview` extension will mount an iframe. The iframe communicates with the `CoreHost` via `window.postMessage`.
- Heavy AST parsing or AI streaming from `vibe-ai` can be moved to a Web Worker inside its extension folder.

## 4. Migration Plan (How to build this without breaking prod)
- **Step 1:** Create `src/core` and port the current Zustand stores into the headless Host model.
- **Step 2:** Create the `vibe-ai` extension folder and move the `pipeline` logic there.
- **Step 3:** Refactor `App.tsx` into the slot-based `src/renderer`.
- **Step 4:** Delete old legacy folders (`src/pipeline`, `src/stores`, etc.).
