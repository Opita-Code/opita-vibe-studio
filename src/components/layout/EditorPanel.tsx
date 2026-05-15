import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";

const MonacoEditor = lazy(() =>
  import("@/components/editor/MonacoEditor").then((m) => ({ default: m.MonacoEditor }))
);
import { FileTabs } from "@/components/editor/FileTabs";
import { LivePreview } from "@/components/preview/LivePreview";
import { WelcomeScreen } from "@/components/layout/WelcomeScreen";

/**
 * Panel de contenido del área derecha.
 *
 * Renderiza según `activeView` usando renderizado SIMULTÁNEO con CSS
 * visibility en vez de conditional rendering. Esto evita el flashbang
 * blanco al cambiar de vista porque el iframe y Monaco se mantienen
 * montados en el DOM y solo cambia su visibilidad.
 *
 * - `"preview"` → LivePreview a ancho completo (editor oculto)
 * - `"editor"` → MonacoEditor (preview oculto)
 * - `"split"` → Preview + Editor con divisor redimensionable
 *   - `splitOrientation: "vertical"` → arriba/abajo (default)
 *   - `splitOrientation: "horizontal"` → izquierda/derecha
 */
export function EditorPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const activeTab = useProjectStore((s) => s.activeTab);
  const fileContents = useProjectStore((s) => s.fileContents);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  const saveFile = useProjectStore((s) => s.saveFile);
  const statusMessage = useProjectStore((s) => s.statusMessage);

  const diffMode = useProjectStore((s) => s.diffMode);
  const diffOriginalContent = useProjectStore((s) => s.diffOriginalContent);
  const diffModifiedContent = useProjectStore((s) => s.diffModifiedContent);
  const closeDiffMode = useProjectStore((s) => s.closeDiffMode);

  const activeContent = activeTab ? (fileContents[activeTab] ?? "") : "";
  // Preview version counter — increments on save/tab-switch to trigger refresh
  const [version, setVersion] = useState(0);
  const prevActiveTabRef = useRef(activeTab);

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

  const editorSection = activeTab ? (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      <FileTabs />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-obsidian-900 h-full text-slate-500 font-mono text-sm">
            <span className="animate-pulse">Iniciando motor del editor...</span>
          </div>
        }>
          {diffMode && (
            <div className="absolute top-12 right-6 z-50">
              <button
                onClick={closeDiffMode}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded-md border border-red-500/30 shadow-lg backdrop-blur-md transition-all font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Salir del Diff
              </button>
            </div>
          )}
          <MonacoEditor
            path={activeTab}
            value={activeContent}
            onChange={(value) => setFileContent(activeTab, value)}
            isDiff={diffMode}
            originalValue={diffOriginalContent}
            modifiedValue={diffModifiedContent}
          />
        </Suspense>
      </div>
    </div>
  ) : (
    <WelcomeScreen />
  );

  const previewDevice = useUIStore((s) => s.previewDevice);
  const setPreviewDevice = useUIStore((s) => s.setPreviewDevice);

  const previewSection = (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0 bg-transparent">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0 bg-obsidian-900 border-b border-white/5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vista Previa
        </span>

        {/* Device selector */}
        <div className="flex items-center gap-0.5 bg-white/5 rounded-md p-0.5">
          {([
            { id: "desktop" as const, icon: "M3 5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm5 14h8", label: "Escritorio" },
            { id: "iphone" as const, icon: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 18h.01", label: "iPhone" },
            { id: "android" as const, icon: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm3 18h4", label: "Android" },
            { id: "tablet" as const, icon: "M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 18h.01", label: "Tablet" },
          ]).map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setPreviewDevice(id)}
              aria-label={`Vista ${label}`}
              title={label}
              className={`p-1 rounded transition-all ${
                previewDevice === id
                  ? "bg-aura-cyan/20 text-aura-cyan shadow-sm"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
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
          <button
            onClick={() => setActiveView("editor")}
            aria-label="Cerrar vista previa"
            className="px-2 py-1 text-xs text-slate-500 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
            title="Cerrar vista previa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Live Preview iframe */}
      <LivePreview version={version} />
    </div>
  );

  // ── View state flags ──────────────────────────────────────
  const isPreview = activeView === "preview";
  const isEditor = activeView === "editor";
  const isSplit = activeView === "split";

  // Todos los paneles se mantienen montados en el DOM; solo cambia
  // su visibilidad vía CSS. Esto evita el flashbang blanco porque
  // el iframe y Monaco no se desmontan/recrean en cada cambio.

  return (
    <section
      className={`flex flex-1 overflow-hidden min-w-0 ${
        isEditor || (isSplit && activeView === "split") ? "flex-row" : "flex-col"
      }`}
    >
      <div
        className={`overflow-hidden transition-opacity duration-150 flex flex-col flex-1 ${
          isPreview ? "hidden" : "flex"
        }`}
      >
        {editorSection}
      </div>

      {/* Divisor en modo split */}
      {isSplit && (
        <div className="w-1 bg-black/40 border-x border-white/5 cursor-col-resize shrink-0 hover:bg-vibe-purple/50 transition-colors" />
      )}

      {/* Preview panel — oculto solo en modo editor total */}
      <div
        className={`overflow-hidden transition-opacity duration-150 ${
          isEditor ? "hidden" : "flex-1 flex flex-col"
        }`}
      >
        {previewSection}
      </div>
    </section>
  );
}
