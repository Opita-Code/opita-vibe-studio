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
          <MonacoEditor
            path={activeTab}
            value={activeContent}
            onChange={(value) => setFileContent(activeTab, value)}
          />
        </Suspense>
      </div>
    </div>
  ) : (
    <WelcomeScreen />
  );

  const previewSection = (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0 bg-transparent">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0 bg-obsidian-900 border-b border-white/5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vista Previa
        </span>
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
