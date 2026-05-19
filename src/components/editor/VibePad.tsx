/**
 * Vibe Pad — Agent-native code editor for Vibe Studio.
 *
 * Drop-in replacement for MonacoEditor.
 * Built on CodeMirror 6 with the Aura design system.
 */

import { useRef } from "react";
import { useVibePad } from "./useVibePad";

// ─── Props ──────────────────────────────────────────────────────

interface VibePadProps {
  /** File path (used for language detection) */
  path: string;
  /** Current document content */
  value: string;
  /** Callback when user edits */
  onChange?: (value: string) => void;
  /** Diff mode */
  isDiff?: boolean;
  /** Original content (for diff) */
  originalValue?: string;
  /** Modified content (for diff) */
  modifiedValue?: string;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Vibe Pad — the Vibe Studio code editor.
 *
 * Agent-native: designed for the flow agent writes → user reviews.
 * Uses CodeMirror 6 with full CSS control over every visual element.
 */
export function VibePad({
  path,
  value,
  onChange,
  isDiff,
  originalValue,
  modifiedValue,
}: VibePadProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Diff Mode ──────────────────────────────────────────────

  if (isDiff) {
    // Lazy-load diff component to keep main bundle light
    return (
      <VibePadDiffLazy
        path={path}
        originalValue={originalValue ?? ""}
        modifiedValue={modifiedValue ?? value}
      />
    );
  }

  // ─── Normal Mode ────────────────────────────────────────────

  return <VibePadEditor containerRef={containerRef} path={path} value={value} onChange={onChange} />;
}

// ─── Editor Sub-component (hooks must be called unconditionally) ─

function VibePadEditor({
  containerRef,
  path,
  value,
  onChange,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  path: string;
  value: string;
  onChange?: (value: string) => void;
}) {
  useVibePad(containerRef, { path, value, onChange });

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="h-full w-full overflow-hidden"
      data-testid="vibe-pad"
    />
  );
}

// ─── Lazy Diff ──────────────────────────────────────────────────

import { Suspense, lazy } from "react";

const VibePadDiffComponent = lazy(() =>
  import("./VibePadDiff").then((m) => ({ default: m.VibePadDiff })),
);

function VibePadDiffLazy(props: {
  path: string;
  originalValue: string;
  modifiedValue: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-slate-600 font-mono text-sm">
          <span className="animate-pulse">Cargando diff...</span>
        </div>
      }
    >
      <VibePadDiffComponent {...props} />
    </Suspense>
  );
}
