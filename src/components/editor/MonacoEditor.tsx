import { useRef, useEffect, useCallback } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { detectLanguage } from "@/lib/language";
import { useProjectStore } from "@/stores/project";

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

// ─── Highlight Duration ─────────────────────────────────────────

const HIGHLIGHT_DURATION_MS = 2500;

// ─── Component ──────────────────────────────────────────────────

/**
 * Editor de código basado en Monaco Editor.
 * Se carga de forma diferida (lazy load vía @monaco-editor/react).
 * Detecta el lenguaje automáticamente según la extensión del archivo.
 *
 * Listens for `vibe:navigate-to-line` custom events to scroll to a
 * specific line and apply a temporary highlight decoration.
 */
export function MonacoEditor({ path, value, onChange, isDiff, originalValue, modifiedValue }: MonacoEditorProps) {
  const language = detectLanguage(path);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const activeTab = useProjectStore((s) => s.activeTab);

  // ─── Theme ──────────────────────────────────────────────────

  const handleEditorWillMount = useCallback((monaco: any) => {
    monacoRef.current = monaco;
    monaco.editor.defineTheme('vibe-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { background: '0A0B0E' },
        // JSX/TSX component tags — distinct color
        { token: 'tag', foreground: '7dd3fc' },           // sky-300
        { token: 'tag.delimiter.jsx', foreground: '94a3b8' },
        { token: 'tag.attribute.name', foreground: 'c4b5fd' }, // violet-300
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

    // ─── TypeScript/JavaScript JSX Configuration ──────────
    // This enables proper JSX syntax coloring and IntelliSense

    const tsDefaults = monaco.languages.typescript.typescriptDefaults;
    const jsDefaults = monaco.languages.typescript.javascriptDefaults;

    const sharedCompilerOptions = {
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: "React.createElement",
      jsxFragmentFactory: "React.Fragment",
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      allowJs: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false,
      noEmit: true,
    };

    tsDefaults.setCompilerOptions(sharedCompilerOptions);
    jsDefaults.setCompilerOptions(sharedCompilerOptions);

    // Disable built-in diagnostics (we're an editor, not a type checker)
    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    jsDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    // Add React type stubs so JSX doesn't show "Cannot find module 'react'" errors
    tsDefaults.addExtraLib(
      `declare module 'react' {
        export function createElement(type: any, props?: any, ...children: any[]): any;
        export function useState<T>(initialState: T | (() => T)): [T, (s: T | ((prev: T) => T)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
        export function useRef<T>(initialValue: T): { current: T };
        export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
        export function useMemo<T>(factory: () => T, deps: any[]): T;
        export function useContext<T>(context: any): T;
        export function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (action: A) => void];
        export const Fragment: any;
        export default { createElement, Fragment };
      }`,
      "file:///node_modules/@types/react/index.d.ts"
    );
  }, []);

  // ─── Editor Mount ───────────────────────────────────────────

  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // ─── Navigate-to-line listener ──────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        file: string;
        line: number;
        endLine?: number;
      };

      // Only respond if this editor instance is showing the target file
      if (!activeTab || !detail.file) return;
      const normalizedActive = activeTab.replace(/\\/g, "/");
      const normalizedTarget = detail.file.replace(/\\/g, "/");
      if (!normalizedActive.endsWith(normalizedTarget) && normalizedActive !== normalizedTarget) return;

      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;

      const startLine = detail.line;
      const endLine = detail.endLine ?? detail.line;

      // Scroll to line
      editor.revealLineInCenter(startLine, 0 /* Smooth */);

      // Set cursor
      editor.setPosition({ lineNumber: startLine, column: 1 });

      // Apply temporary highlight decoration
      const newDecorations = editor.deltaDecorations(decorationsRef.current, [
        {
          range: new monaco.Range(startLine, 1, endLine, 1),
          options: {
            isWholeLine: true,
            className: "vibe-file-ref-highlight",
            glyphMarginClassName: "vibe-file-ref-glyph",
          },
        },
      ]);
      decorationsRef.current = newDecorations;

      // Remove highlight after duration
      setTimeout(() => {
        if (editorRef.current) {
          decorationsRef.current = editorRef.current.deltaDecorations(
            decorationsRef.current,
            []
          );
        }
      }, HIGHLIGHT_DURATION_MS);

      // Focus editor
      editor.focus();
    };

    window.addEventListener("vibe:navigate-to-line", handler);
    return () => window.removeEventListener("vibe:navigate-to-line", handler);
  }, [activeTab]);

  // ─── Diff Mode ────────────────────────────────────────────

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

  // ─── Normal Editor ────────────────────────────────────────

  return (
    <Editor
      theme="vibe-dark"
      beforeMount={handleEditorWillMount}
      onMount={handleEditorDidMount}
      language={language}
      path={path}
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
}
