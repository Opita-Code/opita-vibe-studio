/**
 * VibeLens — Motor de preview nativo de Vibe Studio.
 *
 * Renderiza los archivos del proyecto en tiempo real usando
 * un entorno aislado (sandbox). Soporta React, TypeScript,
 * vanilla JS, y sitios estáticos.
 *
 * Arquitectura:
 * - usePreviewFiles() → mapea archivos del proyecto al sandbox
 * - SandpackProvider → motor de bundling interno (detalle de implementación)
 * - VibeLensOverlay → UX de carga/error personalizada
 * - VibeLensRenderer → iframe de renderizado
 *
 * El usuario NUNCA ve "Sandpack" — todo es "VibeLens" o "Vista Previa".
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { usePreviewFiles } from "./usePreviewFiles";
import { VibeEnginePreview } from "./VibeEnginePreview";
import { EmptyPreviewState } from "./EmptyPreviewState";
import { DeviceFrame } from "./DeviceFrame";
import { useUIStore } from "@/stores/ui";
import { registerPreviewRefresh } from "@/lib/preview-refresh";

// ─── Types ──────────────────────────────────────────────────────

export interface LivePreviewHandle {
  /** Forces Sandpack to re-bundle (manual reload button / agent refresh). */
  refreshPreview(): void;
}

interface LivePreviewProps {
  /** Device key — only changes when the emulated device changes. */
  device?: string;
}

// ─── Refresh Trigger ────────────────────────────────────────────

/**
 * Bridge entre el imperative refreshPreview() handle y el Sandpack
 * instance. Sandpack's dispatch({type:"refresh"}) re-runs el bundler sin
 * destruir el iframe state (vs el viejo force-remount).
 *
 * También registra el refresh en el registry global (preview-refresh.ts)
 * para que la tool `refresh_preview` del agente pueda dispararlo.
 */
function PreviewRefresher({ onRef }: { onRef: (fn: () => void) => void }) {
  const { dispatch } = useSandpack();
  const latestDispatchRef = useRef(dispatch);
  latestDispatchRef.current = dispatch;

  useEffect(() => {
    const refresh = () => {
      latestDispatchRef.current({ type: "refresh" });
    };
    onRef(refresh);
    const unregister = registerPreviewRefresh(refresh);
    return () => {
      onRef(() => {});
      unregister();
    };
  }, [onRef]);

  return null;
}

// ─── Main Component ─────────────────────────────────────────────

/**
 * LivePreview — Entry point for VibeLens.
 *
 * Reads project files from the store, maps them to a virtual filesystem,
 * auto-detects the framework, and renders a live preview.
 *
 * The SandpackProvider keeps a STABLE key (device only). File changes flow
 * through the reactive `files` prop — Sandpack detects them and re-bundles
 * incrementally WITHOUT destroying iframe state (this replaced the old
 * key={version} force-remount that killed the bundler on every save).
 */
export const LivePreview = forwardRef<LivePreviewHandle, LivePreviewProps>(
  function LivePreview(_props, ref) {
    const { files, template, hasPreviewableFiles, fileCount } = usePreviewFiles();
    const previewDevice = useUIStore((s) => s.previewDevice);

    // Imperative refresh: lets EditorPanel / agent call refreshPreview()
    // without a version counter.
    const refreshFnRef = useRef<(() => void) | null>(null);
    useImperativeHandle(ref, () => ({
      refreshPreview() {
        refreshFnRef.current?.();
      },
    }), []);

    // If no previewable files, show the branded empty state
    if (!hasPreviewableFiles) {
      return (
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <div className="flex-1 relative w-full h-full bg-obsidian-950">
            <EmptyPreviewState />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col flex-1 overflow-hidden relative group">
        <div className="flex-1 relative w-full h-full bg-obsidian-950">
          {/*
            Key = device only. File updates arrive via the reactive `files`
            prop — Sandpack re-bundles incrementally. No version counter.
          */}
          <SandpackProvider
            key={`vibelens-${previewDevice}`}
            template={template}
            theme="dark"
            files={files}
            options={{
              classes: {
                "sp-wrapper": "h-full w-full",
                "sp-layout": "h-full w-full bg-transparent border-0",
                "sp-preview": "h-full w-full",
                "sp-preview-iframe": "h-full w-full",
              },
              initMode: "user-visible",
            }}
          >
            <PreviewRefresher onRef={(fn) => { refreshFnRef.current = fn; }} />
            <DeviceFrame device={previewDevice}>
              <VibeEnginePreview />
            </DeviceFrame>
          </SandpackProvider>

          {/* VibeLens status badge */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/5 z-10 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-aura-cyan animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              VibeLens · {fileCount} archivo{fileCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

// Backward compatibility — used by legacy code paths
export function buildPreviewContent() {
  return { html: "", isFullDocument: false };
}
