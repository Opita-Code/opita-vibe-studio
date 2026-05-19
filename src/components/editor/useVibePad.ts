/**
 * Vibe Pad — Core lifecycle hook.
 *
 * Creates, configures, and destroys a CodeMirror EditorView.
 * Handles bidirectional value sync and dynamic language reconfiguration.
 */

import { useRef, useEffect, useCallback } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { vibePadTheme, vibePadHighlight } from "./vibe-pad-theme";
import { loadLanguage } from "./language-loader";
import { navigateHighlight } from "./extensions/navigate-highlight";
import { agentGutter } from "./extensions/agent-gutter";
import { agentActivity } from "./extensions/agent-activity";
import { detectLanguage } from "@/lib/language";

// ─── Types ──────────────────────────────────────────────────────

interface UseVibePadOptions {
  /** File path — used for language detection */
  path: string;
  /** Current document value */
  value: string;
  /** Callback when user edits */
  onChange?: (value: string) => void;
}

// ─── Hook ───────────────────────────────────────────────────────

/**
 * Mounts a CodeMirror 6 EditorView into the given container ref.
 *
 * - Creates the view on mount, destroys on unmount
 * - Syncs external `value` changes into the editor without loops
 * - Reconfigures the language extension when `path` changes
 * - Listens for `vibe:navigate-to-line` events
 */
export function useVibePad(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { path, value, onChange }: UseVibePadOptions,
) {
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Compartment for hot-swapping language extension
  const langCompartment = useRef(new Compartment());
  const currentPathRef = useRef(path);

  // Track the active path for navigate-highlight
  const activePathRef = useRef(path);
  activePathRef.current = path;
  const getActivePath = useCallback(() => activePathRef.current, []);

  // ─── Mount / Unmount ────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current?.(update.state.doc.toString());
      }
    });

    const baseExtensions: Extension[] = [
      // Core editing
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      foldGutter(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),

      // Search
      highlightSelectionMatches(),

      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
      ]),

      // Theme
      vibePadTheme,
      vibePadHighlight,

      // Agent-native extensions
      navigateHighlight(getActivePath),
      agentGutter(getActivePath),
      agentActivity(getActivePath),

      // Config
      EditorView.lineWrapping,
      indentUnit.of("  "),
      EditorState.tabSize.of(2),

      // Language (compartment for hot-swap)
      langCompartment.current.of([]),

      // Change listener
      updateListener,
    ];

    const state = EditorState.create({
      doc: value,
      extensions: baseExtensions,
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    // Load initial language
    const langId = detectLanguage(path);
    loadLanguage(langId).then((ext) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: langCompartment.current.reconfigure(ext),
        });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount — path and value changes handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // ─── Sync external value → editor ──────────────────────────

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  // ─── Reconfigure language on path change ───────────────────

  useEffect(() => {
    if (currentPathRef.current === path) return;
    currentPathRef.current = path;

    const langId = detectLanguage(path);
    loadLanguage(langId).then((ext) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: langCompartment.current.reconfigure(ext),
        });
      }
    });
  }, [path]);

  return viewRef;
}
