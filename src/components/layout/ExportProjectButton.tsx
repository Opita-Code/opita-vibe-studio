/**
 * ExportProjectButton — Download current project as ZIP.
 *
 * Generates a ZIP file from all fileContents in the active workspace
 * and triggers a browser download. Zero permissions required.
 */

import { useState } from "react";
import { Download } from "lucide-react";
import { useProjectStore } from "@/stores/project";

export function ExportProjectButton() {
  const [isExporting, setIsExporting] = useState(false);
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId);
  const workspaces = useProjectStore((s) => s.workspaces);
  const fileContents = useProjectStore((s) => s.fileContents);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  if (!workspace) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Dynamic import to avoid bundling JSZip when not needed
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      const prefix = `${workspace.id}/`;

      for (const [fullPath, content] of Object.entries(fileContents)) {
        // Strip workspace prefix to get relative path
        let relativePath = fullPath;
        if (fullPath.startsWith(prefix)) {
          relativePath = fullPath.slice(prefix.length);
        } else if (fullPath.startsWith("template://")) {
          // template://react-landing/src/App.tsx → src/App.tsx
          const parts = fullPath.split("/");
          const templatePrefix = parts.slice(0, 3).join("/") + "/";
          relativePath = fullPath.slice(templatePrefix.length);
        }

        if (relativePath) {
          zip.file(relativePath, content);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workspace.name || "proyecto"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
      title="Exportar proyecto como ZIP"
      aria-label="Exportar proyecto"
    >
      <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-bounce" : ""}`} />
      <span className="hidden sm:inline">Exportar</span>
    </button>
  );
}
