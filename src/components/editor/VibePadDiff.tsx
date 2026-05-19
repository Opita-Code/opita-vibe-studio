/**
 * Vibe Pad — Diff view component.
 *
 * Uses @codemirror/merge MergeView to show side-by-side diffs
 * with Aura theme applied to both panels.
 *
 * Added lines: emerald tint. Deleted lines: rose tint.
 */

import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { vibePadTheme, vibePadHighlight } from "./vibe-pad-theme";
import { loadLanguage } from "./language-loader";
import { detectLanguage } from "@/lib/language";

// ─── Diff-specific theme overrides ──────────────────────────────

const diffThemeOverrides = EditorView.theme(
  {
    // Inserted lines (right panel)
    ".cm-mergeView .cm-changedLine": {
      backgroundColor: "rgba(16, 185, 129, 0.08)",
      borderLeft: "3px solid rgba(16, 185, 129, 0.5)",
    },
    ".cm-mergeView .cm-deletedLine": {
      backgroundColor: "rgba(244, 63, 94, 0.08)",
      borderLeft: "3px solid rgba(244, 63, 94, 0.5)",
    },
    // Merge view gap (connector lines)
    ".cm-mergeViewGap": {
      backgroundColor: "#09090b",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
    },
    // Panel headers
    ".cm-mergeView": {
      height: "100%",
    },
  },
  { dark: true },
);

// ─── Props ──────────────────────────────────────────────────────

interface VibePadDiffProps {
  path: string;
  originalValue: string;
  modifiedValue: string;
}

// ─── Component ──────────────────────────────────────────────────

export function VibePadDiff({
  path,
  originalValue,
  modifiedValue,
}: VibePadDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const langId = detectLanguage(path);

    loadLanguage(langId).then((langExt) => {
      if (!containerRef.current) return;

      const sharedExtensions = [
        vibePadTheme,
        vibePadHighlight,
        diffThemeOverrides,
        langExt,
        lineNumbers(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
      ];

      const mv = new MergeView({
        a: {
          doc: originalValue,
          extensions: sharedExtensions,
        },
        b: {
          doc: modifiedValue,
          extensions: sharedExtensions,
        },
        parent: container,
      });

      mergeViewRef.current = mv;
    });

    return () => {
      mergeViewRef.current?.destroy();
      mergeViewRef.current = null;
    };
  }, [path, originalValue, modifiedValue]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      data-testid="vibe-pad-diff"
    />
  );
}
