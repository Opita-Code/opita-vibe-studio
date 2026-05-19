/**
 * Vibe Pad — Agent gutter extension.
 *
 * Shows aura-purple dot markers in the gutter for lines
 * that were modified by the AI agent. Subscribes to the
 * agentBus for `file-changed` events.
 */

import {
  StateField,
  StateEffect,
  RangeSet,
  type Extension,
} from "@codemirror/state";
import {
  GutterMarker,
  gutter,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { agentBus, type AgentBusEvent } from "@/stores/agent";

// ─── Constants ──────────────────────────────────────────────────

/** How long agent markers remain visible (ms) */
const MARKER_TTL_MS = 30_000;

// ─── Effects ────────────────────────────────────────────────────

/** Mark specific lines as agent-modified */
const markLines = StateEffect.define<{ from: number; to: number }[]>();

/** Clear all agent markers */
const clearMarkers = StateEffect.define<null>();

// ─── Gutter Marker ──────────────────────────────────────────────

class AgentDotMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-agent-marker";
    dot.textContent = "●";
    return dot;
  }
}

const agentDot = new AgentDotMarker();

// ─── State Field ────────────────────────────────────────────────

const agentMarkerField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(value, tr) {
    // Map through document changes
    let result = value.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(markLines)) {
        const markers = effect.value.map((range) =>
          agentDot.range(range.from),
        );
        // Merge with existing markers
        result = RangeSet.of(
          [...rangeSetToArray(result), ...markers].sort(
            (a, b) => a.from - b.from,
          ),
        );
      } else if (effect.is(clearMarkers)) {
        result = RangeSet.empty;
      }
    }

    return result;
  },
});

/** Helper to convert RangeSet to array for merging */
function rangeSetToArray(
  set: RangeSet<GutterMarker>,
): { from: number; to: number; value: GutterMarker }[] {
  const result: { from: number; to: number; value: GutterMarker }[] = [];
  const cursor = set.iter();
  while (cursor.value) {
    result.push({ from: cursor.from, to: cursor.to, value: cursor.value });
    cursor.next();
  }
  return result;
}

// ─── Extension ──────────────────────────────────────────────────

/**
 * Creates an agent gutter extension.
 *
 * @param activePathGetter — returns the currently active file path
 */
export function agentGutter(
  activePathGetter: () => string | null,
): Extension {
  const agentGutterColumn = gutter({
    class: "cm-agent-gutter",
    markers: (view) => view.state.field(agentMarkerField),
  });

  const agentPlugin = ViewPlugin.define((view) => {
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const unsub = agentBus.subscribe((event: AgentBusEvent) => {
      if (event.type === "file-changed") {
        const activePath = activePathGetter();
        if (!activePath) return;

        const normalizedActive = activePath.replace(/\\/g, "/");
        const normalizedTarget = event.path.replace(/\\/g, "/");

        if (
          !normalizedActive.endsWith(normalizedTarget) &&
          normalizedActive !== normalizedTarget
        )
          return;

        // Mark all lines as agent-modified (we don't have line-level granularity yet)
        const doc = view.state.doc;
        const allLines: { from: number; to: number }[] = [];
        for (let i = 1; i <= Math.min(doc.lines, 500); i++) {
          const line = doc.line(i);
          allLines.push({ from: line.from, to: line.to });
        }

        view.dispatch({
          effects: markLines.of(allLines),
        });

        // Auto-clear after TTL
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
          if (view.state) {
            view.dispatch({ effects: clearMarkers.of(null) });
          }
        }, MARKER_TTL_MS);
      }

      if (event.type === "done") {
        // Keep markers visible for a bit after done, then clear
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
          if (view.state) {
            view.dispatch({ effects: clearMarkers.of(null) });
          }
        }, 5000);
      }
    });

    return {
      update(_update: ViewUpdate) {
        // No-op — reactive via agentBus subscription
      },
      destroy() {
        unsub();
        if (clearTimer) clearTimeout(clearTimer);
      },
    };
  });

  return [agentMarkerField, agentGutterColumn, agentPlugin];
}
