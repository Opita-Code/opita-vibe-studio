import { EmptyPreviewState } from "./EmptyPreviewState";

interface LivePreviewProps {
  version: number;
}

export function LivePreview({ version: _version }: LivePreviewProps) {
  // Desactivado temporalmente: Entorno estricto Backend-First.
  // El renderizado de Sandpack consumía recursos y no es necesario para programar APIs.
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative group">
      <div className="flex-1 relative w-full h-full bg-slate-950">
        <EmptyPreviewState />
      </div>
    </div>
  );
}

// Dummy export to keep EditorPanel happy before we refactor it
export function buildPreviewContent() {
  return { html: "", isFullDocument: false };
}
