import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project";
import { execShell } from "@/lib/ipc";
import { translateOutput, isErrorOutput } from "@/lib/terminal-translations";

// ─── Constants ─────────────────────────────────────────────────

/** Máximo de líneas visibles en la salida */
const MAX_OUTPUT_LINES = 500;

/** Timeout de ejecución en milisegundos */
const COMMAND_TIMEOUT_MS = 30_000;

// ─── Tipos ─────────────────────────────────────────────────────

interface OutputLine {
  id: number;
  text: string;
  type: "stdout" | "stderr" | "system" | "error" | "warning";
}

interface PresetCommand {
  label: string;
  command: string;
  dangerous?: boolean;
}

// ─── Presets ───────────────────────────────────────────────────

/**
 * Comandos predefinidos que el usuario puede seleccionar del dropdown.
 * Los comandos marcados como `dangerous: true` requieren confirmación.
 */
const PRESET_COMMANDS: PresetCommand[] = [
  { label: "Git: estado", command: "git status" },
  { label: "Git: iniciar repo", command: "git init" },
  { label: "Git: agregar todo", command: "git add ." },
  { label: "Git: confirmar", command: 'git commit -m "mensaje"' },
  { label: "npm: iniciar proyecto", command: "npm init -y" },
  { label: "npm: instalar dependencias", command: "npm install" },
  { label: "npm: ejecutar dev", command: "npm run dev" },
  { label: "npm: ejecutar test", command: "npm test" },
  { label: "npm: construir", command: "npm run build" },
  { label: "Git: push forzado", command: "git push --force", dangerous: true },
  { label: "Eliminar node_modules", command: "rm -rf node_modules", dangerous: true },
];

// ─── Componente principal ──────────────────────────────────────

interface TerminalPanelProps {
  /** Alto del panel en píxeles (para layout redimensionable) */
  height?: number;
}

/**
 * Panel de terminal simplificado para el MVP.
 *
 * - Input de comando con Enter para ejecutar
 * - Dropdown de comandos predefinidos
 * - Salida con colores (stdout verde, stderr rojo)
 * - Timeout de 30 segundos
 * - Traducción de mensajes comunes al español
 * - Confirmación para comandos peligrosos
 */
export function TerminalPanel({ height }: TerminalPanelProps) {
  const rootPath = useProjectStore((s) => s.rootPath);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [confirmCommand, setConfirmCommand] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextIdRef = useRef(1);

  // ── Auto-scroll al final de la salida ─────────────────────
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // ── Enfocar input al abrir ────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Generar IDs para líneas de salida ─────────────────────
  const nextId = useCallback(() => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    return id;
  }, []);

  // ── Agregar línea de salida ───────────────────────────────
  const addOutput = useCallback(
    (text: string, type: OutputLine["type"]) => {
      setOutput((prev) => {
        const lines = text.split("\n").filter(Boolean);
        const newLines = lines.map((line) => ({
          id: nextId(),
          text: line,
          type: type as OutputLine["type"],
        }));
        const combined = [...prev, ...newLines];
        // Limitar a MAX_OUTPUT_LINES
        if (combined.length > MAX_OUTPUT_LINES) {
          return combined.slice(combined.length - MAX_OUTPUT_LINES);
        }
        return combined;
      });
    },
    [nextId],
  );

  // ── Ejecutar comando ───────────────────────────────────────
  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim() || isRunning) return;

      const cwd = rootPath ?? ".";
      setIsRunning(true);

      // Mostrar el comando ejecutado
      addOutput(`❯ ${cmd}`, "system");

      try {
        // Crear un timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("⏱️ Comando cancelado: excedió 30 segundos")),
            COMMAND_TIMEOUT_MS,
          ),
        );

        const execPromise = execShell(cmd, cwd);

        const result = await Promise.race([execPromise, timeoutPromise]);

        // stdout
        if (result.stdout) {
          const translated = translateOutput(result.stdout);
          addOutput(translated, "stdout");
        }

        // stderr
        if (result.stderr) {
          const translated = translateOutput(result.stderr);
          addOutput(translated, isErrorOutput(result.stderr) ? "stderr" : "warning");
        }

        // Exit code
        if (result.exit_code !== 0) {
          addOutput(`⚠️ Código de salida: ${result.exit_code}`, "error");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        addOutput(message, "error");
      } finally {
        setIsRunning(false);
        setCommand("");
        inputRef.current?.focus();
      }
    },
    [rootPath, isRunning, addOutput],
  );

  // ── Manejar selección de preset ────────────────────────────
  const handlePresetSelect = useCallback((preset: PresetCommand) => {
    setShowPresets(false);

    if (preset.dangerous) {
      setConfirmCommand(preset.command);
      return;
    }

    setCommand(preset.command);
    inputRef.current?.focus();
  }, []);

  // ── Manejar confirmación de comando peligroso ──────────────
  const handleConfirmDangerous = useCallback(() => {
    if (confirmCommand) {
      executeCommand(confirmCommand);
      setConfirmCommand(null);
    }
  }, [confirmCommand, executeCommand]);

  // ── Manejar tecla Enter ────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        executeCommand(command);
      }
    },
    [command, executeCommand],
  );

  // ── Limpiar terminal ───────────────────────────────────────
  const handleClear = useCallback(() => {
    setOutput([]);
  }, []);

  // ── Color según tipo de línea ──────────────────────────────
  const lineColor = (type: OutputLine["type"]): string => {
    switch (type) {
      case "stdout":
        return "text-[#4ec9b0]";
      case "stderr":
        return "text-[#f44747]";
      case "system":
        return "text-[#888]";
      case "error":
        return "text-[#f44747]";
      case "warning":
        return "text-[#cca700]";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] font-mono text-xs">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#333] shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#969696]">
          Terminal
        </span>

        <div className="flex items-center gap-2">
          {/* Botón de presets */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              aria-label="Comandos predefinidos"
              className="px-2 py-0.5 text-xs text-[#888] hover:text-[#d4d4d4] hover:bg-[#333] rounded transition-colors"
              title="Comandos predefinidos"
            >
              📋 Presets
            </button>

            {showPresets && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#2d2d2d] border border-[#444] rounded shadow-xl max-h-60 overflow-y-auto min-w-[200px]">
                {PRESET_COMMANDS.map((preset) => (
                  <button
                    key={preset.command}
                    onClick={() => handlePresetSelect(preset)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#3a3a3a] transition-colors flex items-center gap-2 ${
                      preset.dangerous ? "text-[#f44747]" : "text-[#d4d4d4]"
                    }`}
                  >
                    {preset.dangerous && <span>⚠️</span>}
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botón limpiar */}
          <button
            onClick={handleClear}
            aria-label="Limpiar terminal"
            className="px-2 py-0.5 text-xs text-[#888] hover:text-[#d4d4d4] hover:bg-[#333] rounded transition-colors"
            title="Limpiar terminal"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* ── Output ──────────────────────────────────────────── */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5"
        style={{ maxHeight: height ? height - 80 : undefined }}
      >
        {output.length === 0 ? (
          <p className="text-[#616161] italic">
            Escribe un comando o selecciona un preset para empezar
          </p>
        ) : (
          output.map((line) => (
            <div
              key={line.id}
              className={`${lineColor(line.type)} whitespace-pre-wrap break-all leading-5`}
            >
              {line.text}
            </div>
          ))
        )}

        {/* Spinner cuando está ejecutando */}
        {isRunning && (
          <div className="flex items-center gap-2 text-[#888] mt-1">
            <span className="inline-block w-3 h-3 border-2 border-[#4ec9b0] border-t-transparent rounded-full animate-spin" />
            <span>Ejecutando...</span>
          </div>
        )}
      </div>

      {/* ── Input ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#333] bg-[#252526]">
        <span className="text-[#4ec9b0] shrink-0">❯</span>
        <textarea
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un comando..."
          disabled={isRunning}
          rows={1}
          className="flex-1 bg-transparent text-[#d4d4d4] outline-none resize-none placeholder-[#616161] font-mono text-xs leading-5"
          style={{ minHeight: 20 }}
        />
      </div>

      {/* ── Diálogo de confirmación ─────────────────────────── */}
      {confirmCommand && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] border border-[#444] rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <p className="text-xs text-[#f44747] font-semibold mb-2">
              ⚠️ Comando peligroso
            </p>
            <p className="text-sm text-[#d4d4d4] mb-1">
              ¿Estás seguro de ejecutar este comando?
            </p>
            <code className="block text-xs bg-[#1e1e1e] text-[#d4d4d4] p-2 rounded mb-3 font-mono">
              {confirmCommand}
            </code>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmCommand(null)}
                aria-label="Cancelar comando peligroso"
                className="px-3 py-1 text-xs text-[#888] hover:text-[#d4d4d4] hover:bg-[#3a3a3a] rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDangerous}
                aria-label="Confirmar ejecución de comando peligroso"
                className="px-3 py-1 text-xs bg-[#c72e2e] text-white rounded hover:bg-[#e04040] transition-colors"
              >
                Ejecutar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
