import { useCallback } from "react";
import { useProjectStore } from "@/stores/project";

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
    <div className="flex items-center h-9 bg-[#252526] border-b border-[#333] overflow-x-auto shrink-0 select-none">
      {openTabs.map((path) => {
        const isActive = path === activeTab;
        const dirty = isDirty[path];

        return (
          <button
            key={path}
            onClick={() => setActiveTab(path)}
            className={`
              flex items-center gap-1.5 h-full px-3 text-xs border-r border-[#333]
              whitespace-nowrap transition-colors cursor-pointer
              ${isActive ? "bg-[#1e1e1e] text-[#e0e0e0]" : "bg-[#2d2d2d] text-[#969696] hover:text-[#d4d4d4]"}
            `}
            title={path}
          >
            {/* Indicador de cambios sin guardar */}
            {dirty ? (
              <span className="w-2 h-2 rounded-full bg-[#e2b714] shrink-0" />
            ) : (
              <span className="w-2 h-2 shrink-0" />
            )}

            {/* Nombre del archivo */}
            <span className="truncate max-w-[140px]">{getFileName(path)}</span>

            {/* Botón de cierre */}
            <span
              onClick={(e) => handleClose(e, path)}
              className="ml-0.5 w-4 h-4 flex items-center justify-center rounded hover:bg-[#444] text-[#616161] hover:text-[#e0e0e0] transition-colors"
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
