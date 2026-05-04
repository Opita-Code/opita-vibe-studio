import Editor from "@monaco-editor/react";
import { detectLanguage } from "@/lib/language";

// ─── Props ──────────────────────────────────────────────────────

interface MonacoEditorProps {
  /** Ruta del archivo (se usa para detectar lenguaje) */
  path: string;
  /** Contenido actual */
  value: string;
  /** Callback cuando cambia el contenido */
  onChange: (value: string) => void;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Editor de código basado en Monaco Editor.
 * Se carga de forma diferida (lazy load vía @monaco-editor/react).
 * Detecta el lenguaje automáticamente según la extensión del archivo.
 */
export function MonacoEditor({ path, value, onChange }: MonacoEditorProps) {
  const language = detectLanguage(path);

  return (
    <Editor
      theme="vs-dark"
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        tabSize: 2,
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        smoothScrolling: true,
        padding: { top: 8 },
      }}
      loading={
        <div className="flex items-center justify-center h-full text-[#616161]">
          Cargando editor...
        </div>
      }
    />
  );
}
