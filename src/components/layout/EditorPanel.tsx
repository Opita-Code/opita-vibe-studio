import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { FileTabs } from "@/components/editor/FileTabs";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { LivePreview, buildPreviewContent } from "@/components/preview/LivePreview";

/**
 * Panel central — Editor de código arriba, vista previa abajo.
 * Incluye tabs de archivos abiertos, editor Monaco, Ctrl+S para guardar,
 * y vista previa en vivo con sandboxed iframe.
 */
export function EditorPanel() {
  const previewRatio = useUIStore((s) => s.previewRatio);
  const setPreviewRatio = useUIStore((s) => s.setPreviewRatio);
  const previewVisible = useUIStore((s) => s.previewVisible);
  const togglePreview = useUIStore((s) => s.togglePreview);

  const activeTab = useProjectStore((s) => s.activeTab);
  const fileContents = useProjectStore((s) => s.fileContents);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  const saveFile = useProjectStore((s) => s.saveFile);
  const statusMessage = useProjectStore((s) => s.statusMessage);

  const activeContent = activeTab ? (fileContents[activeTab] ?? "") : "";

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

  // ── Preview resize handler ─────────────────────────────────
  const handlePreviewResize = useCallback(
    (delta: number) => {
      const ratioDelta = delta / 600;
      setPreviewRatio(previewRatio - ratioDelta);
    },
    [previewRatio, setPreviewRatio],
  );

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

  return (
    <section className="flex flex-1 flex-col overflow-hidden min-w-0">
      {/* Editor de código (arriba) */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ flexBasis: previewVisible ? `${(1 - previewRatio) * 100}%` : "100%" }}
      >
        {/* Tabs de archivos abiertos */}
        <FileTabs />

        {/* Editor o placeholder */}
        <div className="flex-1 overflow-hidden">
          {activeTab ? (
            <MonacoEditor
              path={activeTab}
              value={activeContent}
              onChange={(value) => setFileContent(activeTab, value)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#616161] gap-2">
              <p className="text-sm">Editor de código</p>
              <p className="text-xs">Abre un archivo del explorador para empezar</p>
            </div>
          )}
        </div>
      </div>

      {/* Handle de redimensionamiento (solo si preview visible) */}
      {previewVisible && (
        <ResizeHandle orientation="vertical" onResize={handlePreviewResize} />
      )}

      {/* Vista previa (abajo) — solo renderizada si visible */}
      {previewVisible && (
        <div
          className="flex flex-col overflow-hidden bg-[#1a1a1a]"
          style={{ flexBasis: `${previewRatio * 100}%` }}
        >
          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-3 py-1 shrink-0 bg-[#252526] border-b border-[#333]">
            <button
              onClick={togglePreview}
              aria-label="Alternar vista previa"
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#888] hover:text-[#d4d4d4] hover:bg-[#333] rounded transition-colors"
              title={previewVisible ? "Ocultar vista previa" : "Mostrar vista previa"}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx={12} cy={12} r={3} />
              </svg>
              <span>Vista Previa</span>
            </button>

            {/* Reload button */}
            <button
              onClick={() => setVersion((v) => v + 1)}
              aria-label="Recargar vista previa"
              className="px-2 py-1 text-xs text-[#888] hover:text-[#d4d4d4] hover:bg-[#333] rounded transition-colors"
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
      )}
    </section>
  );
}
