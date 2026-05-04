import { useCallback, useEffect } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { FileTabs } from "@/components/editor/FileTabs";
import { ResizeHandle } from "@/components/layout/ResizeHandle";

/**
 * Panel central — Editor de código arriba, vista previa abajo.
 * Incluye tabs de archivos abiertos, editor Monaco, y Ctrl+S para guardar.
 */
export function EditorPanel() {
  const previewRatio = useUIStore((s) => s.previewRatio);
  const setPreviewRatio = useUIStore((s) => s.setPreviewRatio);

  const activeTab = useProjectStore((s) => s.activeTab);
  const fileContents = useProjectStore((s) => s.fileContents);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  const saveFile = useProjectStore((s) => s.saveFile);

  const activeContent = activeTab ? (fileContents[activeTab] ?? "") : "";
  const statusMessage = useProjectStore((s) => s.statusMessage);

  // ── Ctrl+S: guardar archivo activo ─────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const tab = useProjectStore.getState().activeTab;
        if (tab) {
          saveFile(tab);
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

  return (
    <section className="flex flex-1 flex-col overflow-hidden min-w-0">
      {/* Editor de código (arriba) */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ flexBasis: `${(1 - previewRatio) * 100}%` }}
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
              <p className="text-xs">Abrí un archivo del explorador para empezar</p>
            </div>
          )}
        </div>
      </div>

      {/* Handle de redimensionamiento */}
      <ResizeHandle orientation="vertical" onResize={handlePreviewResize} />

      {/* Vista previa (abajo) */}
      <div
        className="flex items-center justify-center overflow-hidden bg-[#1a1a1a]"
        style={{ flexBasis: `${previewRatio * 100}%` }}
      >
        <p className="text-sm text-[#616161]">Vista previa en vivo</p>
      </div>
    </section>
  );
}
