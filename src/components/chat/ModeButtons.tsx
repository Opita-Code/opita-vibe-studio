/**
 * Controles de modo de Aura — 2 dropdowns.
 *
 * Dropdown 1: Modo de operación (Auto / Construir / Planear / Modo Vibe)
 * Dropdown 2: Modo de ejecución (Interactivo / Auto)
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chat";
import { getSelectableModes } from "@/modes";
import { Zap, MessageCircle, ChevronDown } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

interface ModeButtonsProps {
  onActivate: (modeId: string, prompt: string) => void;
}

// ─── Mode Colors ───────────────────────────────────────────────

const MODE_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  auto: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", glow: "shadow-[0_0_8px_rgba(6,182,212,0.15)]" },
  construir: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", glow: "shadow-[0_0_8px_rgba(168,85,247,0.15)]" },
  planear: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", glow: "shadow-[0_0_8px_rgba(244,63,94,0.15)]" },
  vibe: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", glow: "shadow-[0_0_8px_rgba(245,158,11,0.15)]" },
};

// ─── Dropdown Hook ─────────────────────────────────────────────

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return { open, setOpen, ref };
}

// ─── Component ─────────────────────────────────────────────────

export function ModeButtons({ onActivate }: ModeButtonsProps) {
  const activeMode = useChatStore((s) => s.activeMode);
  const executionMode = useChatStore((s) => s.executionMode);
  const setExecutionMode = useChatStore((s) => s.setExecutionMode);
  const setActiveMode = useChatStore((s) => s.setActiveMode);

  const modeDropdown = useDropdown();
  const execDropdown = useDropdown();

  const modes = getSelectableModes();
  const currentMode = modes.find((m) => m.id === activeMode) ?? modes[0];
  const colors = MODE_COLORS[currentMode.id] ?? MODE_COLORS.auto;

  const isAutoExec = executionMode === "automatic";

  return (
    <div className="flex items-center gap-2 mb-3">
      {/* ─── Dropdown 1: Modo de Operación ─── */}
      <div className="relative" ref={modeDropdown.ref}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => modeDropdown.setOpen(!modeDropdown.open)}
          aria-label={`Modo: ${currentMode.name}`}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${colors.text} ${colors.bg} ${colors.border} ${colors.glow}`}
        >
          <span className="text-xs">{currentMode.icon}</span>
          {currentMode.name}
          <motion.div
            animate={{ rotate: modeDropdown.open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ChevronDown size={10} className="opacity-50" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
        {modeDropdown.open && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute bottom-full left-0 mb-2 w-52 bg-obsidian-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 origin-bottom-left"
          >
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
              Modo de Aura
            </div>
            {modes.map((mode) => {
              const mColors = MODE_COLORS[mode.id] ?? MODE_COLORS.auto;
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    setActiveMode(mode.id);
                    onActivate(mode.id, "");
                    modeDropdown.setOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                    isActive
                      ? `${mColors.bg} ${mColors.text}`
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{mode.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{mode.name}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{mode.description}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* ─── Dropdown 2: Modo de Ejecución ─── */}
      <div className="relative" ref={execDropdown.ref}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => execDropdown.setOpen(!execDropdown.open)}
          aria-label={`Ejecución: ${isAutoExec ? "Auto" : "Interactivo"}`}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${
            isAutoExec
              ? "text-orange-400 bg-orange-500/10 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.1)]"
              : "text-sky-400 bg-sky-500/10 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.1)]"
          }`}
        >
          {isAutoExec ? <Zap size={11} /> : <MessageCircle size={11} />}
          {isAutoExec ? "Auto" : "Interactivo"}
          <motion.div
            animate={{ rotate: execDropdown.open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ChevronDown size={10} className="opacity-50" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
        {execDropdown.open && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute bottom-full left-0 mb-2 w-52 bg-obsidian-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 origin-bottom-left"
          >
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
              Ejecución
            </div>
            <button
              onClick={() => { setExecutionMode("interactive"); execDropdown.setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                !isAutoExec ? "bg-sky-500/10 text-sky-400" : "text-white/70 hover:bg-white/5"
              }`}
            >
              <MessageCircle size={12} />
              <div className="flex-1">
                <div className="font-medium">Interactivo</div>
                <div className="text-[10px] text-white/40 mt-0.5">Tú diriges cada paso</div>
              </div>
            </button>
            <button
              onClick={() => { setExecutionMode("automatic"); execDropdown.setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                isAutoExec ? "bg-orange-500/10 text-orange-400" : "text-white/70 hover:bg-white/5"
              }`}
            >
              <Zap size={12} />
              <div className="flex-1">
                <div className="font-medium">Auto</div>
                <div className="text-[10px] text-white/40 mt-0.5">Aura encadena hasta completar</div>
              </div>
            </button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Phase Confirmation Bar ─────────────────────────────────────

/**
 * Barra de confirmación que aparece cuando el pipeline está en modo
 * interactivo y espera aprobación del usuario después de una fase.
 */
export function PhaseConfirmationBar() {
  const pending = useChatStore((s) => s.pendingConfirmation);
  const confirmPhase = useChatStore((s) => s.confirmPhase);
  const abortStreaming = useChatStore((s) => s.abortStreaming);

  if (!pending) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/10 bg-obsidian-900/80 backdrop-blur-sm animate-fade-in">
      <div className="flex-1 text-xs text-white/50">
        ⏸️ Plan listo — ¿continuar con la construcción?
      </div>
      <button
        onClick={() => {
          abortStreaming();
        }}
        className="px-3 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
      >
        Cancelar
      </button>
      <button
        onClick={() => {
          confirmPhase();
        }}
        className="px-3 py-1 text-[11px] font-medium rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shadow-[0_0_12px_rgba(16,185,129,0.1)]"
      >
        ✓ Continuar
      </button>
    </div>
  );
}
