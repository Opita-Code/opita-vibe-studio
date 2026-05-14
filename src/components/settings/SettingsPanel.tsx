import { useState, useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { ByokPanel } from "@/components/settings/ByokPanel";
import { PrivacyPanel } from "@/components/settings/PrivacyPanel";
import { SubagentPanel } from "@/components/settings/SubagentPanel";
import { PlanCard } from "@/components/usage/PlanCard";
import { TokenBar } from "@/components/usage/TokenBar";
import { ContextPanel } from "@/components/settings/ContextPanel";
import { motion, AnimatePresence } from "framer-motion";
import { Blocks, Palette, CreditCard, Bot, ShieldCheck, X } from "lucide-react";

type SettingsCategory = "conexiones" | "apariencia" | "uso" | "agentes" | "privacidad";

export function SettingsPanel() {
  const settingsVisible = useUIStore((s) => s.settingsVisible);
  const setSettingsVisible = useUIStore((s) => s.setSettingsVisible);
  
  // Layout states
  const chatPosition = useUIStore((s) => s.chatPosition);
  const setChatPosition = useUIStore((s) => s.setChatPosition);
  const chatWidth = useUIStore((s) => s.chatWidth);
  const setChatWidth = useUIStore((s) => s.setChatWidth);
  const vibeLensEnabled = useUIStore((s) => s.vibeLensEnabled);
  const setVibeLensEnabled = useUIStore((s) => s.setVibeLensEnabled);
  
  const authMode = useAuthStore((s) => s.authMode);
  const plan = useAuthStore((s) => s.plan);
  const isAuthenticated = authMode === "authenticated";
  
  const [activeTab, setActiveTab] = useState<SettingsCategory>("conexiones");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    if (!settingsVisible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSettingsVisible(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [settingsVisible, setSettingsVisible]);

  // Auto-focus dialog on open
  useEffect(() => {
    if (settingsVisible && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [settingsVisible]);

  // Focus trap
  const handleTrapKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // Avoid rendering anything if not visible, but AnimatePresence handles the exit.
  // We'll wrap the whole return in AnimatePresence.

  const categories = [
    { id: "conexiones", label: "Conexiones IA", icon: Blocks },
    { id: "apariencia", label: "Apariencia", icon: Palette },
    { id: "uso", label: "Suscripción y Uso", icon: CreditCard },
    ...(plan === "pro" ? [{ id: "agentes", label: "Agentes Pro", icon: Bot }] : []),
    ...(isAuthenticated ? [{ id: "privacidad", label: "Privacidad", icon: ShieldCheck }] : []),
  ] as const;

  return (
    <AnimatePresence>
      {settingsVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-obsidian-950/70 backdrop-blur-md p-4 md:p-8"
          onClick={() => setSettingsVisible(false)}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Configuración de Vibe Studio"
            tabIndex={-1}
            onKeyDown={handleTrapKeyDown}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-5xl h-[85vh] bg-[#0D0D12]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_80px_-15px_rgba(0,0,0,1)] overflow-hidden flex flex-col md:flex-row outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-white/[0.02] flex flex-col">
              <div className="p-6 shrink-0 flex items-center justify-between">
                <h2 className="text-base font-bold tracking-wide text-slate-200 flex items-center gap-3">
                  <span className="text-aura-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">⚙️</span>
                  Configuración
                </h2>
                <button
                  onClick={() => setSettingsVisible(false)}
                  className="md:hidden text-slate-500 hover:text-white transition-colors p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeTab === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveTab(cat.id as SettingsCategory)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-aura-cyan/10 text-aura-cyan shadow-[inset_2px_0_0_0_rgba(6,182,212,1)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <Icon size={16} className={isActive ? "text-aura-cyan" : "opacity-70"} />
                      {cat.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent">
              <div className="absolute top-4 right-4 hidden md:block z-10">
                <button
                  onClick={() => setSettingsVisible(false)}
                  className="text-slate-500 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors p-2 rounded-full border border-white/5"
                  aria-label="Cerrar configuración"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="max-w-3xl"
                  >
                    {activeTab === "conexiones" && <ByokPanel />}
                    
                    {activeTab === "uso" && (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-200 mb-1">Suscripción y Uso</h3>
                          <p className="text-sm text-slate-400 mb-6">Administra tu plan de Opita OS y monitorea tu consumo de inteligencia artificial.</p>
                        </div>
                        <PlanCard />
                        <TokenBar />
                      </div>
                    )}

                    {activeTab === "privacidad" && isAuthenticated && (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-200 mb-1">Privacidad y Telemetría</h3>
                          <p className="text-sm text-slate-400 mb-6">Controla cómo interactúan tus datos con los servicios de IA de Opita.</p>
                        </div>
                        <PrivacyPanel />
                      </div>
                    )}

                    {activeTab === "agentes" && plan === "pro" && (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-200 mb-1">Agentes Pro</h3>
                          <p className="text-sm text-slate-400 mb-6">Configuración avanzada para subagentes autónomos y manejo de contexto profundo.</p>
                        </div>
                        <SubagentPanel />
                        <ContextPanel />
                      </div>
                    )}

                    {activeTab === "apariencia" && (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-200 mb-1">Apariencia y Entorno</h3>
                          <p className="text-sm text-slate-400 mb-6">Personaliza tu espacio de trabajo en Vibe Studio.</p>
                        </div>

                        <div className="grid gap-6">
                          <div className="p-5 bg-white/[0.02] rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-slate-200">VibeLens (Modo Aislado)</h3>
                              <button
                                onClick={() => setVibeLensEnabled(!vibeLensEnabled)}
                                role="switch"
                                aria-checked={vibeLensEnabled}
                                aria-label="Activar VibeLens modo aislado"
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-900 ${
                                  vibeLensEnabled ? 'bg-aura-cyan' : 'bg-obsidian-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    vibeLensEnabled ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                              Permite a la IA aislar y previsualizar componentes individualmente usando Sandpack en un entorno virtual.
                            </p>
                          </div>

                          <div className="p-5 bg-white/[0.02] rounded-xl border border-white/5">
                            <h3 className="text-sm font-semibold text-slate-200 mb-2">Posición del Asistente</h3>
                            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                              Elige dónde anclar el panel de Vibe AI en tu entorno de trabajo.
                            </p>
                            <div className="flex gap-3 max-w-md">
                              <button
                                onClick={() => setChatPosition("left")}
                                aria-pressed={chatPosition === "left"}
                                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-aura-purple focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-900 ${
                                  chatPosition === "left"
                                    ? "bg-aura-purple/20 text-aura-purple border border-aura-purple/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                    : "bg-obsidian-900/50 text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 border border-white/5"
                                }`}
                              >
                                Anclar a la Izquierda
                              </button>
                              <button
                                onClick={() => setChatPosition("right")}
                                aria-pressed={chatPosition === "right"}
                                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-aura-purple focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-900 ${
                                  chatPosition === "right"
                                    ? "bg-aura-purple/20 text-aura-purple border border-aura-purple/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                    : "bg-obsidian-900/50 text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 border border-white/5"
                                }`}
                              >
                                Anclar a la Derecha
                              </button>
                            </div>
                          </div>

                          <div className="p-5 bg-white/[0.02] rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-slate-200">Ancho Base del Panel</h3>
                              {Math.round(chatWidth) !== 400 && (
                                <button
                                  onClick={() => setChatWidth(400)}
                                  className="text-[10px] uppercase font-bold text-aura-cyan hover:text-white transition-colors px-2 py-1 rounded border border-aura-cyan/30 hover:border-aura-cyan/60 bg-aura-cyan/10 hover:bg-aura-cyan/20"
                                >
                                  Restablecer a 400px
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-lg">
                              Ajusta el ancho predeterminado del asistente. También puedes arrastrar la barra divisoria directamente en el editor.
                            </p>
                            <div className="flex items-center gap-4 max-w-md">
                              <input
                                type="range"
                                min="280"
                                max="600"
                                value={chatWidth}
                                onChange={(e) => setChatWidth(Number(e.target.value))}
                                className="flex-1 h-1.5 bg-obsidian-700 rounded-lg appearance-none cursor-pointer accent-aura-cyan"
                              />
                              <span className="text-sm text-slate-300 font-mono w-12 text-right bg-black/20 px-2 py-1 rounded border border-white/5">{Math.round(chatWidth)}px</span>
                            </div>
                          </div>

                          <div className="p-5 bg-white/[0.02] rounded-xl border border-white/5">
                            <h3 className="text-sm font-semibold text-slate-200 mb-4">Atajos de Teclado Universales</h3>
                            <div className="space-y-4 max-w-md">
                              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-sm text-slate-300">Alternar Editor / Vista Previa</span>
                                <kbd className="px-2 py-1 bg-obsidian-950 border border-white/10 rounded text-slate-300 font-mono text-xs shadow-inner">Ctrl+Tab</kbd>
                              </div>
                              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-sm text-slate-300">Mostrar / Ocultar Explorador</span>
                                <kbd className="px-2 py-1 bg-obsidian-950 border border-white/10 rounded text-slate-300 font-mono text-xs shadow-inner">Ctrl+B</kbd>
                              </div>
                              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-sm text-slate-300">Abrir Configuración</span>
                                <kbd className="px-2 py-1 bg-obsidian-950 border border-white/10 rounded text-slate-300 font-mono text-xs shadow-inner">Ctrl+,</kbd>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-300">Abrir OmniBar</span>
                                <kbd className="px-2 py-1 bg-obsidian-950 border border-white/10 rounded text-slate-300 font-mono text-xs shadow-inner">Ctrl+P / Ctrl+K</kbd>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
