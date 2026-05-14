import { useCallback, useState } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { FileTree } from "@/components/files/FileTree";
import { getFileSystemBackend } from "@/lib/fs-backend";

/**
 * Dock colapsable del explorador de archivos.
 *
 * - Colapsado: barra vertical de 32px con icono de carpeta.
 * - Expandido: panel de 240px con el árbol de archivos.
 * - Transición suave en el ancho.
 * - Estado controlado por `explorerVisible` en el store.
 */
export function ExplorerDock() {
  const activeSidebar = useUIStore((s) => s.activeSidebar);
  const setActiveSidebar = useUIStore((s) => s.setActiveSidebar);
  const workspaces = useProjectStore((s) => s.workspaces);
  const isLoading = useProjectStore((s) => s.isLoading);
  const openProject = useProjectStore((s) => s.openProject);
  const addWorkspace = useProjectStore((s) => s.addWorkspace);

  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Record<string, boolean>>({});

  const handleToggle = useCallback(() => {
    setActiveSidebar(activeSidebar === "explorer" ? null : "explorer");
  }, [activeSidebar, setActiveSidebar]);

  const toggleWorkspace = (id: string) => {
    setCollapsedWorkspaces((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenFolder = useCallback(async () => {
    try {
      const backend = getFileSystemBackend();
      if (!backend.isAvailable()) return;
      const path = await backend.selectDirectory();
      if (path) {
        if (workspaces.length === 0) {
          await openProject(path);
        } else {
          await addWorkspace(path);
        }
        setActiveSidebar("explorer");
      }
    } catch {
      // Usuario canceló o error
    }
  }, [openProject, addWorkspace, workspaces.length, setActiveSidebar]);

  return (
    <>
      {/* Backdrop para móvil */}
      {activeSidebar === "explorer" && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] transition-opacity duration-300"
          onClick={handleToggle}
          aria-hidden="true"
        />
      )}
      
      {activeSidebar === "explorer" && (
        <div
          data-testid="explorer-dock"
          className="flex flex-col bg-obsidian-950/80 backdrop-blur-xl border-r border-white/10 overflow-hidden shrink-0 transition-all duration-300 ease-in-out fixed md:relative z-[100] md:z-40 h-full top-0 left-0 w-[280px] md:w-[240px] shadow-[4px_0_15px_rgba(0,0,0,0.5)]"
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-3 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">
              Explorador
            </span>
            <button
              onClick={handleToggle}
              className="text-xs text-slate-400 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-white/10"
              aria-label="Colapsar explorador"
              title="Colapsar"
            >
              ✕
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && workspaces.length === 0 ? (
              <div className="flex items-center justify-center h-16">
                <span className="text-xs text-slate-500">Cargando...</span>
              </div>
            ) : workspaces.length > 0 ? (
              <div className="flex flex-col">
                {workspaces.map((ws) => {
                  const isCollapsed = collapsedWorkspaces[ws.id] || false;
                  return (
                    <div key={ws.id} className="border-b border-white/5 last:border-0 pb-2">
                      {/* Ruta del proyecto / Cabecera colapsable */}
                      <div
                        className="px-2 py-1 flex items-center justify-between group bg-white/5 hover:bg-aura-purple/10 cursor-pointer select-none transition-colors"
                        onClick={() => toggleWorkspace(ws.id)}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <svg
                            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
                              isCollapsed ? "-rotate-90" : "rotate-0"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <p className="text-xs text-slate-300 font-semibold truncate group-hover:text-white transition-colors" title={ws.path}>
                            {ws.name.toUpperCase()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useProjectStore.getState().removeWorkspace(ws.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition-all shrink-0"
                          title="Cerrar Carpeta"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Árbol de archivos */}
                      {!isCollapsed && (
                        <div className="mt-1">
                          <FileTree nodes={ws.files} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 gap-4 px-6 mt-4">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400 text-center font-medium">
                  Explorador de Archivos
                </p>
                <button
                  onClick={handleOpenFolder}
                  className="w-full text-xs text-white bg-white/5 hover:bg-white/10 border border-white/10 py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 mt-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Añadir Proyecto
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
