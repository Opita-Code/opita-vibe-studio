import Editor, { DiffEditor } from "@monaco-editor/react";
import { detectLanguage } from "@/lib/language";

// ─── Props ──────────────────────────────────────────────────────

interface MonacoEditorProps {
  /** Ruta del archivo (se usa para detectar lenguaje) */
  path: string;
  /** Contenido actual */
  value: string;
  /** Callback cuando cambia el contenido */
  onChange?: (value: string) => void;
  /** Modo diff */
  isDiff?: boolean;
  originalValue?: string;
  modifiedValue?: string;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Editor de código basado en Monaco Editor.
 * Se carga de forma diferida (lazy load vía @monaco-editor/react).
 * Detecta el lenguaje automáticamente según la extensión del archivo.
 */
export function MonacoEditor({ path, value, onChange, isDiff, originalValue, modifiedValue }: MonacoEditorProps) {
  const language = detectLanguage(path);

  // Definir el tema custom de Vibe Studio
  const handleEditorWillMount = (monaco: any) => {
    monaco.editor.defineTheme('vibe-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { background: '0A0B0E' }
      ],
      colors: {
        'editor.background': '#0B0D13', // Deep Vibe background
        'editor.lineHighlightBackground': '#ffffff0a', // sutil
        'editorLineNumber.foreground': '#475569',
        'editorIndentGuide.background': '#ffffff0d',
        'editorIndentGuide.activeBackground': '#ffffff26',
        'editor.selectionBackground': '#00f0ff33', // vibe-cyan with transparency
      }
    });
  };

  const EditorComponent = (
    <Editor
      theme="vibe-dark"
      beforeMount={handleEditorWillMount}
      language={language}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        minimap: { enabled: true, scale: 0.75, autohide: true }, // Encendido pero sutil
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontLigatures: true,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        tabSize: 2,
        renderLineHighlight: "all",
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        padding: { top: 24, bottom: 24 }, // Editor Zen
        formatOnPaste: true,
        formatOnType: true,
        stickyScroll: { enabled: true }, // Contexto fijo en funciones largas
        bracketPairColorization: { enabled: true },
        suggest: { showIcons: true, snippetsPreventQuickSuggestions: false },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
      loading={
        <div className="flex items-center justify-center h-full text-[#616161]">
          Cargando editor...
        </div>
      }
    />
  );

  if (isDiff) {
    return (
      <DiffEditor
        theme="vibe-dark"
        beforeMount={handleEditorWillMount}
        language={language}
        original={originalValue}
        modified={modifiedValue}
        options={{
          minimap: { enabled: true, scale: 0.75, autohide: true },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontLigatures: true,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          renderSideBySide: true,
          readOnly: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full text-[#616161]">
            Cargando visor de diferencias...
          </div>
        }
      />
    );
  }

  return EditorComponent;
}
