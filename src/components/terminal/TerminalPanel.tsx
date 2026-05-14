import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
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
  const rootPath = useProjectStore((s) => s.activeWorkspaceId);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [confirmCommand, setConfirmCommand] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const setTerminalVisible = useUIStore((s) => s.setTerminalVisible);
  const activeTerminalTab = useUIStore((s) => s.activeTerminalTab);
  const setActiveTerminalTab = useUIStore((s) => s.setActiveTerminalTab);
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

  // ── Manejar eventos globales (ej: WelcomeScreen inyecta comando) ──
  useEffect(() => {
    const handleRunCommand = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setCommand(customEvent.detail);
        // Pequeño timeout para que react actualice el input antes de ejecutar
        setTimeout(() => executeCommand(customEvent.detail), 100);
      }
    };
    
    window.addEventListener("vibe:run-terminal-command", handleRunCommand);
    return () => window.removeEventListener("vibe:run-terminal-command", handleRunCommand);
  }, [executeCommand]);

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
    <>
      {/* Backdrop for mobile */}
      <div 
        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
        onClick={() => setTerminalVisible(false)}
        aria-hidden="true"
      />
      <div className="flex flex-col bg-obsidian-950/95 backdrop-blur-xl font-mono text-xs border-t border-white/10 md:shrink-0 fixed md:absolute bottom-16 md:bottom-0 left-0 right-0 z-[100] md:z-30 shadow-[0_-15px_40px_rgba(0,0,0,0.4)]" style={{ height: height || 300, maxHeight: '80dvh' }}>
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pl-0 pr-3 py-0 bg-obsidian-900/60 backdrop-blur-3xl border-b border-white/5 shrink-0 h-8">
        <div role="tablist" aria-label="Paneles de terminal" className="flex h-full">
          {(["terminal", "problems", "console", "git", "logs"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTerminalTab(tab)}
              role="tab"
              aria-selected={activeTerminalTab === tab}
              className={`px-4 flex items-center text-[11px] uppercase tracking-wider font-semibold border-r border-white/5 transition-colors ${
                activeTerminalTab === tab
                  ? "text-aura-cyan bg-white/5 border-b-2 border-b-aura-cyan"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border-b-2 border-b-transparent"
              }`}
            >
              {tab === "terminal" && "Terminal"}
              {tab === "problems" && "Problemas"}
              {tab === "console" && "Consola"}
              {tab === "git" && "Git"}
              {tab === "logs" && "Logs"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de presets */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              aria-label="Comandos predefinidos"
              className="px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Comandos predefinidos"
            >
              📋 Presets
            </button>

            {showPresets && (
              <div role="menu" aria-label="Comandos predefinidos" className="absolute right-0 bottom-full mb-1 z-50 bg-obsidian-800/90 backdrop-blur-3xl border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto min-w-[200px] overflow-hidden">
                {PRESET_COMMANDS.map((preset) => (
                  <button
                    key={preset.command}
                    onClick={() => handlePresetSelect(preset)}
                    role="menuitem"
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${
                      preset.dangerous ? "text-red-400" : "text-slate-200"
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
            className="px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Limpiar terminal"
          >
            🗑️
          </button>
          
          <div className="w-px h-3 bg-white/10 mx-1" aria-hidden="true"></div>

          {/* Botón cerrar */}
          <button
            onClick={() => setTerminalVisible(false)}
            aria-label="Cerrar terminal"
            className="px-2 py-0.5 text-xs text-slate-400 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
            title="Ocultar terminal"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Output & Input ──────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTerminalTab === "terminal" ? (
          <>
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[13px] tracking-wide"
            >
              {output.length === 0 ? (
                <p className="text-[#616161] italic">
                  Escribe un comando o selecciona un preset para empezar
                </p>
              ) : (
                output.map((line) => (
                  <div
                    key={line.id}
                    className={`${lineColor(line.type)} whitespace-pre-wrap break-all leading-relaxed`}
                  >
                    {line.text}
                  </div>
                ))
              )}

              {/* Spinner cuando está ejecutando */}
              {isRunning && (
                <div className="flex items-center gap-3 text-[#888] mt-2" role="status" aria-label="Ejecutando comando">
                  <span className="inline-block w-4 h-4 border-[3px] border-[#4ec9b0] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span className="animate-pulse">Ejecutando...</span>
                </div>
              )}
            </div>

            {/* ── Input ────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 bg-transparent shrink-0">
              <span className="text-aura-cyan shrink-0 font-bold drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">❯</span>
              <textarea
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un comando..."
                disabled={isRunning}
                rows={1}
                aria-label="Entrada de comando de terminal"
                className="flex-1 bg-transparent text-slate-200 outline-none resize-none placeholder-slate-600 font-mono text-[13px] leading-relaxed tracking-wide"
                style={{ minHeight: 24 }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <p className="text-sm font-medium tracking-wide">El panel <span className="text-aura-cyan/70 uppercase">"{activeTerminalTab}"</span> está en desarrollo</p>
          </div>
        )}
      </div>

      {/* ── Diálogo de confirmación ─────────────────────────── */}
      {confirmCommand && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar comando peligroso" className="bg-obsidian-800/90 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
            <p className="text-sm text-red-400 font-semibold mb-3">
              ⚠️ Comando peligroso
            </p>
            <p className="text-sm text-slate-300 mb-2">
              ¿Estás seguro de ejecutar este comando?
            </p>
            <code className="block text-xs bg-obsidian-900 border border-white/5 text-slate-300 p-3 rounded-lg mb-6 font-mono">
              {confirmCommand}
            </code>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmCommand(null)}
                aria-label="Cancelar comando peligroso"
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDangerous}
                aria-label="Confirmar ejecución de comando peligroso"
                className="px-4 py-2 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-lg transition-all shadow-lg"
              >
                Ejecutar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
