import { useState, useCallback, useRef, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useProjectStore } from "@/stores/project";
import { suggestFilename } from "@/lib/language";
import { writeFile } from "@/lib/ipc";
import { Copy, Check } from "lucide-react";

// ─── Props ─────────────────────────────────────────────────────

interface ApplyCodeBlockProps {
  /** Código del bloque */
  code: string;
  /** Lenguaje (undefined = inline code, no mostrar botón) */
  language: string | undefined;
}

// ─── Constants ──────────────────────────────────────────────────

const SYNTAX_STYLES = {
  margin: "0.5rem 0",
  borderRadius: "0.375rem",
  fontSize: "0.8rem",
};

// ─── Component ──────────────────────────────────────────────────

/**
 * Envuelve un bloque de código con un botón "Aplicar" que permite
 * guardar el código como archivo en el proyecto.
 *
 * Estados:
 * - idle: código visible + botón Aplicar flotante
 * - prompting: input para nombre de archivo
 * - confirm_overwrite: confirmación de sobreescritura
 * - saving: guardando
 * - saved: confirmación breve de éxito
 * - error: mensaje de error
 */
export function ApplyCodeBlock({ code, language }: ApplyCodeBlockProps) {
  const rootPath = useProjectStore((s) => s.activeWorkspaceId);
  const openTabs = useProjectStore((s) => s.openTabs);
  const fileContents = useProjectStore((s) => s.fileContents);
  const openFile = useProjectStore((s) => s.openFile);

  const [showDialog, setShowDialog] = useState(false);
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsOverwrite, setNeedsOverwrite] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when dialog opens
  useEffect(() => {
    if (showDialog) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [showDialog]);

  // Reset when dialog closes
  const closeDialog = useCallback(() => {
    setShowDialog(false);
    setStatus("idle");
    setError(null);
    setNeedsOverwrite(false);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  // Handle opening the save dialog
  const handleApply = useCallback(() => {
    setShowDialog(true);
    if (!rootPath) {
      setStatus("error");
      setError("Abre un proyecto primero");
      return;
    }
    setFilename(suggestFilename(language ?? "plaintext"));
    setStatus("idle");
    setError(null);
    setNeedsOverwrite(false);
  }, [rootPath, language]);

  // Check if file already exists
  const checkOverwrite = useCallback(
    (fullPath: string): boolean => {
      return openTabs.includes(fullPath) || fileContents[fullPath] !== undefined;
    },
    [openTabs, fileContents],
  );

  // Handle the actual save
  const handleSave = useCallback(async () => {
    if (!rootPath || !filename.trim()) return;

    const separator = rootPath.endsWith("/") || rootPath.endsWith("\\") ? "" : "/";
    const fullPath = `${rootPath}${separator}${filename.trim()}`;

    // Check overwrite
    if (!needsOverwrite && checkOverwrite(fullPath)) {
      setNeedsOverwrite(true);
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await writeFile(fullPath, code);
      setStatus("saved");
      // Open the file in the editor after a brief delay
      setTimeout(() => {
        openFile(fullPath);
        closeDialog();
      }, 600);
    } catch (err) {
      setStatus("error");
      setError(
        `Error al guardar: ${err instanceof Error ? err.message : "Error desconocido"}`,
      );
    }
  }, [rootPath, filename, code, needsOverwrite, checkOverwrite, openFile, closeDialog]);

  const isSaveDisabled = !filename.trim() || status === "saving";

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaveDisabled) {
        handleSave();
      }
      if (e.key === "Escape") {
        closeDialog();
      }
    },
    [handleSave, closeDialog, isSaveDisabled],
  );

  // ── Inline code (no language) — no Apply button ─────────────
  if (!language) {
    return <code className="rounded bg-[#3c3c3c] px-1 text-[#ce9178]">{code}</code>;
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="relative group my-2">
      {/* Syntax-highlighted code block */}
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={SYNTAX_STYLES}
      >
        {code}
      </SyntaxHighlighter>

      {/* Floating Buttons */}
      {!showDialog && status !== "saved" && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 focus-within:opacity-100">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-[#444]/80 backdrop-blur-sm text-[#d4d4d4] hover:bg-[#555] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vibe-indigo)]"
            title="Copiar código"
            aria-label="Copiar código"
          >
            {copied ? <Check size={12} className="text-[#4ade80]" /> : <Copy size={12} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={handleApply}
            className="px-2 py-1 text-xs rounded text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vibe-indigo)] shadow-sm hover:opacity-90"
            style={{ backgroundColor: "var(--vibe-indigo)" }}
            title="Guardar este código como archivo"
            aria-label="Aplicar código"
          >
            Aplicar
          </button>
        </div>
      )}

      {/* Saved indicator */}
      {status === "saved" && (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-[#2d8830] text-white">
          ✓ Guardado
        </div>
      )}

      {/* Save dialog */}
      {showDialog && (
        <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-[#2d2d2d] border border-[var(--vibe-indigo)] rounded-md shadow-xl">
          {/* Overwrite confirmation */}
          {needsOverwrite ? (
            <div>
              <p className="text-xs text-[#e2b714] mb-2">
                ⚠️ El archivo <strong>{filename.trim()}</strong> ya existe. ¿Sobrescribir?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaveDisabled}
                  className="px-3 py-1 text-xs rounded bg-[#d73a49] text-white hover:bg-[#e34f5e] transition-colors disabled:opacity-50"
                >
                  Sobrescribir
                </button>
                <button
                  onClick={closeDialog}
                  className="px-3 py-1 text-xs rounded bg-[#444] text-[#d4d4d4] hover:bg-[#555] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : status === "error" ? (
            <div>
              <p className="text-xs text-[#f48771] mb-2">{error}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaveDisabled}
                  style={{ backgroundColor: "var(--vibe-indigo)" }}
                  className="px-3 py-1 text-xs rounded text-white hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  Reintentar
                </button>
                <button
                  onClick={closeDialog}
                  className="px-3 py-1 text-xs rounded bg-[#444] text-[#d4d4d4] hover:bg-[#555] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-[#969696] block mb-1">
                Nombre del archivo:
              </label>
              <input
                ref={inputRef}
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#3c3c3c] text-[#cccccc] text-sm px-2 py-1 border border-[#555] rounded outline-none focus:border-[var(--vibe-indigo)] mb-2"
                placeholder="archivo.ext"
              />
              {!rootPath && (
                <p className="text-xs text-[#e2b714] mb-2">
                  ⚠️ No hay proyecto abierto — el archivo se guardará en la raíz
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaveDisabled}
                  style={{ backgroundColor: "var(--vibe-indigo)" }}
                  className="px-3 py-1 text-xs rounded text-white hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {status === "saving" ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={closeDialog}
                  className="px-3 py-1 text-xs rounded bg-[#444] text-[#d4d4d4] hover:bg-[#555] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
