/**
 * PersonaSelector — Quick-switch dropdown for Aura's communication persona.
 *
 * Renders a compact badge showing the active persona icon.
 * On click, opens a dropdown with all available personas.
 * Pro personas show a lock badge for free users.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ChevronUp } from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { PERSONAS, type PersonaId } from "@/lib/types";

export function PersonaSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const persona = useUIStore((s) => s.persona);
  const customPersonaPrompt = useUIStore((s) => s.customPersonaPrompt);
  const setPersona = useUIStore((s) => s.setPersona);
  const setCustomPersonaPrompt = useUIStore((s) => s.setCustomPersonaPrompt);
  const plan = useAuthStore((s) => s.plan);

  const activePersona = PERSONAS.find((p) => p.id === persona) || PERSONAS[1]; // default: creator
  const isFree = plan === "free" || !plan;

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  function handleSelect(id: PersonaId) {
    const config = PERSONAS.find((p) => p.id === id);
    if (!config) return;

    // Pro gate
    if (config.tier === "pro" && isFree) return;

    setPersona(id);
    if (id !== "custom") setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-white/60 hover:text-white/90 hover:bg-white/5 transition-all"
        title={`Persona: ${activePersona.label}`}
      >
        <span className="text-sm">{activePersona.icon}</span>
        <span className="hidden sm:inline">{activePersona.label}</span>
        <ChevronUp
          size={10}
          className={`opacity-40 transition-transform ${isOpen ? "" : "rotate-180"}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-64 bg-obsidian-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                Persona de Aura
              </span>
            </div>

            <div className="py-1">
              {PERSONAS.map((p) => {
                const isActive = p.id === persona;
                const isLocked = p.tier === "pro" && isFree;

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    disabled={isLocked}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? "bg-vibe-purple/15 text-white"
                        : isLocked
                          ? "opacity-40 cursor-not-allowed"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-base w-6 text-center">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium">{p.label}</span>
                        {p.tier === "pro" && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                            {isLocked && <Lock size={8} />}
                            Pro
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/40 block truncate">
                        {p.description}
                      </span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-vibe-purple shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom persona textarea */}
            {persona === "custom" && !isFree && (
              <div className="px-3 py-2 border-t border-white/5">
                <textarea
                  value={customPersonaPrompt}
                  onChange={(e) => setCustomPersonaPrompt(e.target.value)}
                  placeholder="Describe cómo quieres que Aura se comunique contigo..."
                  maxLength={500}
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-[11px] text-white/80 placeholder:text-white/25 resize-none focus:outline-none focus:border-vibe-purple/40"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[9px] text-white/30">
                    {customPersonaPrompt.length}/500
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
