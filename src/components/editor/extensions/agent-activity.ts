/**
 * Vibe Pad — Agent activity extension.
 *
 * Reflects the agent's execution state visually in the editor:
 * - Building phase → shimmer bar on top (via CSS class toggle)
 * - File changed → brief flash
 * - Error → red flash
 * - Done → clear all activity indicators
 */

import type { Extension } from "@codemirror/state";
import { ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { agentBus, type AgentBusEvent } from "@/stores/agent";

// ─── Extension ──────────────────────────────────────────────────

/**
 * Creates an agent activity extension.
 *
 * Toggles CSS classes on the editor root (.cm-editor) to reflect
 * agent state. The visual effects are defined in `vibe-pad-theme.ts`:
 *
 * - `.cm-agent-building` → shimmer gradient bar at top
 */
export function agentActivity(
  activePathGetter: () => string | null,
): Extension {
  return ViewPlugin.define((view) => {
    const root = view.dom;

    const unsub = agentBus.subscribe((event: AgentBusEvent) => {
      switch (event.type) {
        case "phase": {
          if (event.phase === "building") {
            root.classList.add("cm-agent-building");
          } else {
            root.classList.remove("cm-agent-building");
          }
          break;
        }

        case "file-changed": {
          const activePath = activePathGetter();
          if (!activePath) break;

          const normalizedActive = activePath.replace(/\\/g, "/");
          const normalizedTarget = event.path.replace(/\\/g, "/");

          if (
            normalizedActive.endsWith(normalizedTarget) ||
            normalizedActive === normalizedTarget
          ) {
            // Flash effect on the editor — brief cyan border
            root.style.boxShadow = "inset 0 0 0 1px rgba(6, 182, 212, 0.4)";
            setTimeout(() => {
              root.style.boxShadow = "";
            }, 600);
          }
          break;
        }

        case "done":
          root.classList.remove("cm-agent-building");
          // Brief success flash
          root.style.boxShadow = "inset 0 0 0 1px rgba(16, 185, 129, 0.3)";
          setTimeout(() => {
            root.style.boxShadow = "";
          }, 1000);
          break;

        case "error":
          root.classList.remove("cm-agent-building");
          // Brief error flash
          root.style.boxShadow = "inset 0 0 0 1px rgba(244, 63, 94, 0.4)";
          setTimeout(() => {
            root.style.boxShadow = "";
          }, 1500);
          break;
      }
    });

    return {
      update(_update: ViewUpdate) {
        // Reactive via agentBus — no polling needed
      },
      destroy() {
        unsub();
        root.classList.remove("cm-agent-building");
        root.style.boxShadow = "";
      },
    };
  });
}
