import { useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { EditorToolbar } from "./EditorToolbar";

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Extrae el nombre del archivo de una ruta.
 */
function getFileName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Barra de tabs de archivos abiertos.
 * Muestra: nombre del archivo, indicador de cambios sin guardar (dot), botón de cierre.
 */
export function FileTabs() {
  const openTabs = useProjectStore((s) => s.openTabs);
  const activeTab = useProjectStore((s) => s.activeTab);
  const isDirty = useProjectStore((s) => s.isDirty);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeTab = useProjectStore((s) => s.closeTab);

  const handleClose = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      closeTab(path);
    },
    [closeTab],
  );

  if (openTabs.length === 0) return null;

  return (
    <div
      className="flex items-center h-10 bg-glass border-b border-white/5 shrink-0 select-none shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)] z-10 relative w-full"
    >
      <div className="flex-1 flex overflow-x-auto h-full" role="tablist">
      {openTabs.map((path) => {
        const isActive = path === activeTab;
        const dirty = isDirty[path];

        return (
          <div
            key={path}
            onClick={() => setActiveTab(path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTab(path);
              }
            }}
            tabIndex={0}
            role="tab"
            aria-selected={isActive}
            className={`
              flex items-center gap-2 h-full px-4 text-xs font-medium border-r border-white/5
              whitespace-nowrap transition-all cursor-pointer relative overflow-hidden group outline-none
              ${isActive 
                ? "bg-white/5 text-white" 
                : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5 focus-visible:bg-white/10"
              }
            `}
            title={path}
          >
            {/* Indicador de pestaña activa (borde neón inferior) */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-vibe-cyan to-vibe-purple shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            )}
            {/* Indicador de cambios sin guardar */}
            {dirty ? (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.8)] shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 shrink-0" />
            )}

            {/* Nombre del archivo */}
            <span className="truncate max-w-[140px] pointer-events-none">{getFileName(path)}</span>

            {/* Botón de VibeLens manual (Solo si es componente React) */}
            {isActive && (path.endsWith('.tsx') || path.endsWith('.jsx')) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  import("@/stores/ui").then(({ useUIStore }) => {
                    useUIStore.getState().setPreviewTarget(path);
                    useUIStore.getState().setActiveView("split");
                  });
                }}
                title="Aislar Componente (VibeLens)"
                className="ml-2 w-4 h-4 flex items-center justify-center rounded-md hover:bg-aura-purple/20 text-aura-purple transition-all opacity-0 group-hover:opacity-100"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            )}

            {/* Botón de cierre */}
            <button
              onClick={(e) => handleClose(e, path)}
              aria-label={`Cerrar ${getFileName(path)}`}
              className="ml-1.5 w-4 h-4 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              ×
            </button>
          </div>
        );
      })}
      </div>
      <EditorToolbar />
    </div>
  );
}
