import { useState, useCallback } from "react";
import { useProjectStore } from "../../stores/project";
import { exportProjectAsZip } from "../../lib/export";
import { getFileSystemBackend } from "../../lib/fs-backend/factory";
import { isTauri } from "../../lib/platform";

/**
 * Export button that creates a ZIP archive of the current project.
 * - Browser: triggers a download via blob URL
 * - Tauri: opens a native save dialog
 * Disabled when no project is open or during export.
 */
export function ExportButton() {
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId);
  const workspaces = useProjectStore((s) => s.workspaces);
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const rootPath = activeWs?.path || null;
  const files = activeWs?.files || [];
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!rootPath || isExporting) return;

    setIsExporting(true);

    try {
      const backend = getFileSystemBackend();
      const blob = await exportProjectAsZip(files, rootPath, backend);

      const projectName = rootPath.split(/[/\\]/).pop() || "proyecto";

      if (isTauri()) {
        // ── Tauri: native save dialog ───────────────────────
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile: tauriWriteFile } = await import("@tauri-apps/plugin-fs");
          const path = await save({
            filters: [{ name: "ZIP", extensions: ["zip"] }],
            defaultPath: `${projectName}.zip`,
          });
          if (path) {
            const bytes = await blob.arrayBuffer();
            await tauriWriteFile(path, new Uint8Array(bytes));
          }
        } catch {
          return;
        }
      } else {
        // ── Browser: download via blob URL ──────────────────
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      // Export failed silently — button re-enables via finally
    } finally {
      setIsExporting(false);
    }
  }, [rootPath, files, isExporting]);

  return (
    <button
      onClick={handleExport}
      disabled={!rootPath || isExporting}
      className="text-slate-400 hover:text-vibe-cyan transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label="Exportar proyecto"
      title="Exportar Proyecto"
    >
      {isExporting ? (
        <span className="text-xs font-mono">...</span>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M2.5 10.5a.5.5 0 0 1 .5.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2a.5.5 0 0 1 1 0v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a.5.5 0 0 1 .5-.5z" />
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
        </svg>
      )}
    </button>
  );
}
