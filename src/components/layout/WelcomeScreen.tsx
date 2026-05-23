import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { getFileSystemBackend } from "@/lib/fs-backend";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { FolderOpen } from "lucide-react";

// ─── Suggestion Chips ───────────────────────────────────────────

interface Suggestion {
  emoji: string;
  label: string;
  /** Prefills the chat with this prompt */
  prompt: string;
  /** Optional: loads a template into the editor first */
  templateId?: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    emoji: "🌐",
    label: "Landing page",
    prompt: "Crea una landing page moderna y atractiva para un producto de software. Incluye hero, features y CTA.",
    templateId: "react-landing",
  },
  {
    emoji: "👤",
    label: "Portfolio",
    prompt: "Crea un portfolio personal profesional con secciones de experiencia, proyectos y contacto.",
    templateId: "portfolio",
  },
  {
    emoji: "✅",
    label: "App de tareas",
    prompt: "Crea una app de gestión de tareas con React. Debe tener agregar, completar y eliminar tareas.",
    templateId: "todo-app",
  },
  {
    emoji: "📊",
    label: "Dashboard",
    prompt: "Crea un dashboard con gráficas, cards de métricas y una tabla de datos. Usa colores modernos.",
  },
];

// ─── Helper: dispatch to chat ───────────────────────────────────

function sendToChat(prompt: string) {
  window.dispatchEvent(
    new CustomEvent("vibe:prefill-chat", { detail: { message: prompt } })
  );
  // Ensure chat sidebar is open
  useUIStore.getState().setActiveSidebar("chat");
}

// ─── Component ──────────────────────────────────────────────────

/**
 * WelcomeScreen — Chat-first entry point.
 *
 * Shows when no file is open. The textarea is the hero:
 * typing here prefills the chat and lets the AI take it from there.
 * Templates are quick-action chips, not a gallery of cards.
 */
export function WelcomeScreen() {
  const openProject = useProjectStore((s) => s.openProject);
  const scaffoldTemplate = useProjectStore((s) => s.scaffoldTemplate);

  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    sendToChat(trimmed);
    setValue("");
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleSuggestion = useCallback(
    (s: Suggestion) => {
      if (s.templateId) {
        const template = PROJECT_TEMPLATES.find((t) => t.id === s.templateId);
        if (template) {
          scaffoldTemplate(template);
          useUIStore.getState().setActiveSidebar("explorer");
          useUIStore.getState().setActiveView("split");
          useUIStore.getState().setVibeLensEnabled(true);
          import("@/lib/vibe-events").then(({ vibeEvents }) => {
            vibeEvents.emit({ type: "template_used", templateId: template.id });
          });
        }
      }
      sendToChat(s.prompt);
    },
    [scaffoldTemplate]
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      const backend = getFileSystemBackend();
      if (!backend.isAvailable()) return;
      const path = await backend.selectDirectory();
      if (path) {
        await openProject(path);
        useUIStore.getState().setActiveSidebar("explorer");
        useUIStore.getState().setActiveView("editor");
      }
    } catch {
      // User cancelled
    }
  }, [openProject]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-6 relative overflow-hidden bg-obsidian-950">
      {/* Decorative orbs */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-aura-purple/[0.04] blur-[90px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-15%] left-[-8%] w-[35%] h-[35%] rounded-full bg-aura-cyan/[0.04] blur-[70px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-6 max-w-lg w-full z-10">
        {/* Heading */}
        <div className="text-center space-y-1">
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.25em]">
            Vibe Studio
          </p>
          <h1 className="text-xl font-semibold text-white/80 tracking-tight">
            ¿Qué quieres construir hoy?
          </h1>
        </div>

        {/* Hero textarea */}
        <div className="w-full relative group">
          <textarea
            ref={textareaRef}
            id="welcome-chat-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descríbelo con tus palabras... la IA se encarga del código."
            aria-label="Describe tu idea para que Vibe AI la construya"
            rows={3}
            className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm text-white/80 placeholder-white/25 outline-none transition-all duration-300
              focus:border-aura-purple/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-aura-purple/20
              group-hover:border-white/12
              shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          />
          {/* Send button — only visible when there's text */}
          {value.trim() && (
            <button
              onClick={handleSubmit}
              className="absolute right-3 bottom-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-aura-purple/80 hover:bg-aura-purple text-white text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.4)]"
              aria-label="Enviar idea a Vibe AI"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Construir
            </button>
          )}
        </div>

        {/* Suggestion chips */}
        <div className="w-full">
          <p className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-2.5 text-center">
            Comienza con un template
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSuggestion(s)}
                aria-label={`Sugerencia: ${s.label}`}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                  bg-white/[0.03] border border-white/[0.06] text-left
                  hover:border-white/12 hover:bg-white/[0.06]
                  transition-all duration-200 active:scale-[0.97]
                  text-white/50 hover:text-white/80 text-xs font-medium group"
              >
                <span className="text-base leading-none group-hover:scale-110 transition-transform duration-200">
                  {s.emoji}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary action */}
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-2 text-[11px] font-mono text-white/20 hover:text-white/50 uppercase tracking-widest transition-colors duration-200"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Abrir proyecto existente
        </button>
      </div>
    </div>
  );
}
