import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createFileSystemBackend, setFileSystemBackend } from "./lib/fs-backend";
import { host } from "./core/CoreHost";
import { vibeAIExtension } from "./extensions/vibe-ai";
import { vibePreviewExtension } from "./extensions/vibe-preview";
import { vibeViewTabsExtension } from "./extensions/vibe-viewtabs";
import "./index.css";

async function bootstrap() {
  try {
    // ─── Phase 0: Initialize platform-adaptive file system backend ───────────
    const backend = createFileSystemBackend();
    if (backend) {
      setFileSystemBackend(backend);
    }

    // ─── Phase 1: Core Init ───────────
    await host.initialize();

    // ─── Phase 2: Extension Activation ───────────
    // Load extensions in parallel if independent, or sequential if they have dependencies.
    await Promise.all([
      host.loadExtension(vibeAIExtension),
      host.loadExtension(vibePreviewExtension),
      host.loadExtension(vibeViewTabsExtension)
    ]);

    // ─── Phase 3: Mount Renderer ───────────
    // Only after the engine is fully primed, we allow React to paint the UI.
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

  } catch (error) {
    console.error("Failed to bootstrap Vibe Studio Engine:", error);
    // Fallback UI if the engine completely fails
    document.getElementById("root")!.innerHTML = `
      <div style="color: white; background: #0b0b0c; padding: 2rem; font-family: sans-serif; height: 100vh;">
        <h2>Engine Crash</h2>
        <p>Vibe Studio failed to initialize the Core Host.</p>
        <pre style="color: #ff4444; background: #222; padding: 1rem; border-radius: 8px;">${error}</pre>
      </div>
    `;
  }
}

// Start the engine
bootstrap();
