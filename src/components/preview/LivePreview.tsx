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
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import { usePreviewFiles } from "./usePreviewFiles";
import { VibeEnginePreview } from "./VibeEnginePreview";
import { EmptyPreviewState } from "./EmptyPreviewState";
import { DeviceFrame } from "./DeviceFrame";
import { useUIStore } from "@/stores/ui";

// ─── Types ──────────────────────────────────────────────────────

interface LivePreviewProps {
  /** Version counter — increments on save/tab-switch to force refresh */
  version: number;
}

// ─── Main Component ─────────────────────────────────────────────

/**
 * LivePreview — Entry point for VibeLens.
 *
 * Reads project files from the store, maps them to a virtual filesystem,
 * auto-detects the framework, and renders a live preview.
 * Wraps content in a DeviceFrame when mobile/tablet preview is active.
 *
 * Falls back to EmptyPreviewState when there are no previewable files.
 */
export function LivePreview({ version }: LivePreviewProps) {
  const { files, template, hasPreviewableFiles, fileCount } = usePreviewFiles();
  const previewDevice = useUIStore((s) => s.previewDevice);

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
          key includes version + device to force remount on save or device change.
        */}
        <SandpackProvider
          key={`vibelens-${version}-${previewDevice}`}
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
}

// Backward compatibility — used by legacy code paths
export function buildPreviewContent() {
  return { html: "", isFullDocument: false };
}
