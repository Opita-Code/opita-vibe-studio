/**
 * Vibe Pad — Navigate-to-line highlight extension.
 *
 * Listens for `vibe:navigate-to-line` CustomEvents, scrolls the editor
 * to the target line, and applies a temporary highlight decoration.
 */

import {
  StateField,
  StateEffect,
  type Extension,
  RangeSet,
} from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";

// ─── Constants ──────────────────────────────────────────────────

const HIGHLIGHT_DURATION_MS = 2500;

// ─── Effects ────────────────────────────────────────────────────

const addHighlight = StateEffect.define<{ from: number; to: number }>();
const clearHighlight = StateEffect.define<null>();

// ─── Decoration ─────────────────────────────────────────────────

const highlightDecoration = Decoration.line({
  class: "cm-vibe-highlight",
});

// ─── State Field ────────────────────────────────────────────────

const highlightField = StateField.define<DecorationSet>({
  create() {
    return RangeSet.empty;
  },
  update(value, tr) {
    // Map existing decorations through document changes
    let result = value.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(addHighlight)) {
        result = RangeSet.of([
          highlightDecoration.range(effect.value.from),
        ]);
      } else if (effect.is(clearHighlight)) {
        result = RangeSet.empty;
      }
    }
    return result;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// ─── Extension ──────────────────────────────────────────────────

/**
 * Creates a navigate-to-line extension for Vibe Pad.
 *
 * Listens for `vibe:navigate-to-line` CustomEvents with detail:
 *   { file: string, line: number, endLine?: number }
 *
 * The `activePathGetter` is called to check if the event targets
 * the file currently open in this editor instance.
 */
export function navigateHighlight(
  activePathGetter: () => string | null,
): Extension {
  return [
    highlightField,
    EditorView.domEventHandlers({}), // ensures view is available
    ViewPlugin.define((view) => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail as {
          file: string;
          line: number;
          endLine?: number;
        };

        const activePath = activePathGetter();
        if (!activePath || !detail.file) return;

        const normalizedActive = activePath.replace(/\\/g, "/");
        const normalizedTarget = detail.file.replace(/\\/g, "/");
        if (
          !normalizedActive.endsWith(normalizedTarget) &&
          normalizedActive !== normalizedTarget
        )
          return;

        const line = detail.line;
        const doc = view.state.doc;
        if (line < 1 || line > doc.lines) return;

        const lineInfo = doc.line(line);

        // Scroll to center
        view.dispatch({
          effects: EditorView.scrollIntoView(lineInfo.from, { y: "center" }),
          selection: { anchor: lineInfo.from },
        });

        // Apply highlight
        view.dispatch({
          effects: addHighlight.of({ from: lineInfo.from, to: lineInfo.to }),
        });

        // Clear after duration
        setTimeout(() => {
          view.dispatch({
            effects: clearHighlight.of(null),
          });
        }, HIGHLIGHT_DURATION_MS);

        // Focus editor
        view.focus();
      };

      window.addEventListener("vibe:navigate-to-line", handler);
      return {
        destroy() {
          window.removeEventListener("vibe:navigate-to-line", handler);
        },
      };
    }),
  ];
}

// ─── Import for ViewPlugin ──────────────────────────────────────

import { ViewPlugin } from "@codemirror/view";
