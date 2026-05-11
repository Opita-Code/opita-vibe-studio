import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { FileTabs } from "@/components/editor/FileTabs";
import { ExplorerDock } from "@/components/layout/ExplorerDock";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { LivePreview, buildPreviewContent } from "@/components/preview/LivePreview";
import { getFileSystemBackend } from "@/lib/fs-backend";

/**
 * Panel de contenido del área derecha.
 *
 * Renderiza según `activeView` usando renderizado SIMULTÁNEO con CSS
 * visibility en vez de conditional rendering. Esto evita el flashbang
 * blanco al cambiar de vista porque el iframe y Monaco se mantienen
 * montados en el DOM y solo cambia su visibilidad.
 *
 * - `"preview"` → LivePreview a ancho completo (editor oculto)
 * - `"editor"` → ExplorerDock + MonacoEditor (preview oculto)
 * - `"split"` → Preview + Editor con divisor redimensionable
 *   - `splitOrientation: "vertical"` → arriba/abajo (default)
 *   - `splitOrientation: "horizontal"` → izquierda/derecha
 */
export function EditorPanel() {
  const activeView = useUIStore((s) => s.activeView);

  const activeTab = useProjectStore((s) => s.activeTab);
  const fileContents = useProjectStore((s) => s.fileContents);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  const saveFile = useProjectStore((s) => s.saveFile);
  const statusMessage = useProjectStore((s) => s.statusMessage);

  const activeContent = activeTab ? (fileContents[activeTab] ?? "") : "";
  const rootPath = useProjectStore((s) => s.rootPath);
  const openProject = useProjectStore((s) => s.openProject);

  const handleOpenFolder = useCallback(async () => {
    try {
      const backend = getFileSystemBackend();
      if (!backend.isAvailable()) return;
      const path = await backend.selectDirectory();
      if (path) {
        await openProject(path);
      }
    } catch {
      // User cancelled or error
    }
  }, [openProject]);

  // Preview version counter — increments on save/tab-switch to trigger refresh
  const [version, setVersion] = useState(0);
  const prevActiveTabRef = useRef(activeTab);

  // ── Build preview content from active file ─────────────────
  const { html: previewHtml, isFullDocument } = buildPreviewContent(
    activeContent,
    activeTab,
  );

  // ── Ctrl+S: guardar archivo activo ─────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const tab = useProjectStore.getState().activeTab;
        if (tab) {
          saveFile(tab);
          // Increment preview version on save to trigger "Actualizado"
          setVersion((v) => v + 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  // ── Guardado toast: limpiar después de 2s ──────────────────
  useEffect(() => {
    const store = useProjectStore;
    if (store.getState().statusMessage === "Guardado") {
      const timer = setTimeout(() => {
        store.getState().clearStatusMessage();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // ── Increment version when active tab changes ──────────────
  useEffect(() => {
    if (activeTab !== prevActiveTabRef.current) {
      prevActiveTabRef.current = activeTab;
      setVersion((v) => v + 1);
    }
  }, [activeTab]);

  // ── Editor + Preview shared markup ─────────────────────────

  const editorSection = (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      <FileTabs />
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <MonacoEditor
            path={activeTab}
            value={activeContent}
            onChange={(value) => setFileContent(activeTab, value)}
          />
        ) : !rootPath ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-6 p-10 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl max-w-md w-full shadow-2xl text-center">
              <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-100">Comenzar un Proyecto</h3>
                <p className="text-sm text-slate-400">Selecciona una carpeta local de tu computadora para empezar a escribir código de manera segura.</p>
              </div>
              <button
                onClick={handleOpenFolder}
                className="w-full mt-4 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-medium rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all"
              >
                Abrir Carpeta Local
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <p className="text-sm">Editor de código</p>
            <p className="text-xs">Abre un archivo del explorador para empezar</p>
          </div>
        )}
      </div>
    </div>
  );

  const previewSection = (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0 bg-transparent">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0 bg-slate-900/40 backdrop-blur-md border-b border-white/5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vista Previa
        </span>
        <button
          onClick={() => setVersion((v) => v + 1)}
          aria-label="Recargar vista previa"
          className="px-2 py-1 text-xs text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Recargar vista previa"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>

      {/* Live Preview iframe */}
      <LivePreview
        htmlContent={previewHtml}
        isFullDocument={isFullDocument}
        version={version}
      />
    </div>
  );

  // ── View state flags ──────────────────────────────────────
  const isPreview = activeView === "preview";
  const isEditor = activeView === "editor";

  // ── Renderizado simultáneo con CSS visibility ───────────────
  // Todos los paneles se mantienen montados en el DOM; solo cambia
  // su visibilidad vía CSS. Esto evita el flashbang blanco porque
  // el iframe y Monaco no se desmontan/recrean en cada cambio.

  return (
    <section
      className={`flex flex-1 overflow-hidden min-w-0 ${
        isEditor ? "" : "flex-col"
      }`}
    >
      {/* Preview panel — siempre montado, oculto en modo editor */}
      <div
        className={`overflow-hidden transition-opacity duration-150 ${
          isPreview ? "flex-1 flex flex-col" : "hidden"
        }`}
      >
        {previewSection}
      </div>

      {/* Editor panel — siempre montado, oculto en modo preview */}
      <div
        className={`overflow-hidden transition-opacity duration-150 flex ${
          isPreview ? "hidden" : "flex-1"
        }`}
      >
        {isEditor && <ExplorerDock />}
        {editorSection}
      </div>
    </section>
  );
}
