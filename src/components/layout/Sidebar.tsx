import { useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { FileTree } from "@/components/files/FileTree";
import { openFolderDialog } from "@/lib/ipc";

interface SidebarProps {
  width: number;
}

/**
 * Panel lateral izquierdo — Explorador de archivos.
 * Muestra el árbol de archivos del proyecto abierto y un botón
 * para abrir carpetas.
 */
export function Sidebar({ width }: SidebarProps) {
  const rootPath = useProjectStore((s) => s.rootPath);
  const files = useProjectStore((s) => s.files);
  const isLoading = useProjectStore((s) => s.isLoading);
  const openProject = useProjectStore((s) => s.openProject);
  const statusMessage = useProjectStore((s) => s.statusMessage);

  const handleOpenFolder = useCallback(async () => {
    try {
      const path = await openFolderDialog();
      if (path) {
        await openProject(path);
      }
    } catch {
      // Usuario canceló o error de IPC
    }
  }, [openProject]);

  return (
    <aside
      className="flex flex-col bg-[#252526] border-r border-[#333] overflow-hidden shrink-0"
      style={{ width }}
    >
      {/* Encabezado con acciones */}
      <div className="flex items-center justify-between border-b border-[#333] px-3 py-1.5 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#969696]">
          Explorador
        </span>

        <button
          onClick={handleOpenFolder}
          className="text-xs text-[#969696] hover:text-[#d4d4d4] transition-colors px-1.5 py-0.5 rounded hover:bg-[#333]"
          title="Abrir carpeta"
        >
          📂
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <span className="text-xs text-[#616161]">Cargando...</span>
          </div>
        ) : rootPath ? (
          <>
            {/* Ruta del proyecto */}
            <div className="px-3 py-1 border-b border-[#333]">
              <p className="text-xs text-[#616161] truncate" title={rootPath}>
                {rootPath.split(/[/\\]/).pop()}
              </p>
            </div>

            {/* Árbol de archivos */}
            <FileTree nodes={files} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-3 px-4">
            <p className="text-sm text-[#616161] text-center">
              Abrí un proyecto para empezar
            </p>
            <button
              onClick={handleOpenFolder}
              className="text-xs bg-[#007acc] text-white px-3 py-1.5 rounded hover:bg-[#0098ff] transition-colors"
            >
              Abrir carpeta
            </button>
          </div>
        )}
      </div>

      {/* Mensaje de estado en el footer del sidebar */}
      {statusMessage && statusMessage !== "Guardado" && statusMessage !== "Listo" && (
        <div className="px-3 py-1 border-t border-[#333] shrink-0">
          <p className="text-xs text-[#969696] truncate">{statusMessage}</p>
        </div>
      )}
    </aside>
  );
}
