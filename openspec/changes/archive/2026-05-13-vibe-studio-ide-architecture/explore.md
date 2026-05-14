# Exploration: Vibe Studio IDE Architecture

## Contextual Background
Vibe Studio has successfully proven the business model as a functional prototype. However, its current architecture resembles a monolithic React Single Page Application (SPA) rather than a true IDE. The core logic (`App.tsx`), state management (`stores/`), UI components, and the AI pipeline (`pipeline/`) are tightly coupled. 

While this MVP approach allowed for rapid iteration and market validation, it hit a ceiling. It lacks the foundational capabilities of a conventional IDE, such as Visual Studio or VS Code, specifically:
- No isolated extension host.
- No dynamic plugin system.
- Tightly coupled execution environments.
- High cognitive load for maintaining the monolithic `App.tsx`.

## The Problem
To scale Vibe Studio and fully integrate it into the Opita Ecosystem, we need to dismantle the MVP and rebuild it with a true IDE architecture. The engine needs to be exposed in a way that allows third-party (or internal modular) extensions to hook into the lifecycle (e.g., custom linters, AI providers, custom UI panels). 

## Exploration of the Solution Space

### 1. The "True IDE" Architecture Model
A modern web-based or desktop IDE separates concerns aggressively:
- **Core / Host Process:** Manages the file system, project state, and extension lifecycle.
- **Renderer / Presentation Layer:** A dumb UI that only renders what the Core tells it to and sends user intents back.
- **Extension Host:** An isolated environment (Web Workers, IFrames, or a separate Node/Rust process) where plugins run without blocking the UI.

### 2. Ecosystem Integration (Opita OS)
The new architecture must connect natively to the Opita ecosystem:
- **Identity:** `accounts.opitacode.com` for SSO.
- **Monetization:** Decoupled Wompi billing engine.
- **Storage/Compute:** Context7 and AWS S3 hybrid context architecture.

### 3. Recycling the Valuable Parts
We don't need to throw away the actual *value* of the MVP:
- The **AI Pipeline** (`src/pipeline/`) can be extracted and wrapped as the first "Core Plugin".
- The **Sandpack Previewer** can be decoupled into a "Preview Extension".
- The **Glass & Glow** visual identity remains the presentation layer standard.

## Next Steps
The next phase is to propose a concrete architectural design (The Proposal) that defines the Core-Extension API, the messaging bridge (IPC/PostMessage), and how the UI will consume these modules.
