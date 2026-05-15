import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/types";
import { ApplyCodeBlock } from "@/components/chat/ApplyCodeBlock";
import { Copy, Check, Terminal, FileEdit, HardDrive, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useProjectStore } from "@/stores/project";

// ─── Thinking Phrases ───────────────────────────────────────────

const THINKING_PHRASES = [
  "Afinando el aura del código...",
  "Inyectando flow en los componentes...",
  "Destilando lógica premium...",
  "Calculando la estética del algoritmo...",
  "Calibrando el flujo de trabajo...",
  "Conectando las vibras del backend...",
  "Compilando con extra Vibe...",
  "Diseñando píxeles telepáticamente...",
  "Sincronizando frecuencias de la base de datos...",
  "Preparando el lienzo digital...",
  "Invocando los espíritus de la sintaxis...",
  "Haciendo magia con TypeScript...",
  "Consultando con los ancestros del código...",
  "Alineando los chakras del DOM...",
  "Destilando variables del universo...",
  "Optimizando las vibras cuánticas...",
];

// ─── Props ─────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  /** True cuando el asistente está "pensando" (streaming activo, contenido vacío) */
  isThinking?: boolean;
}

// ─── Inline Thinking ────────────────────────────────────────────

function ThinkingContent() {
  const [phrase, setPhrase] = useState(() =>
    THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]
  );

  useEffect(() => {
    let idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    const interval = setInterval(() => {
      idx = (idx + 1) % THINKING_PHRASES.length;
      setPhrase(THINKING_PHRASES[idx]);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-4 h-4 relative flex items-center justify-center flex-shrink-0">
        <div className="absolute inset-0 bg-aura-cyan rounded-full animate-ping opacity-20"></div>
        <div className="w-2 h-2 bg-gradient-to-br from-aura-cyan to-aura-purple rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></div>
      </div>
      <span className="text-sm font-medium bg-gradient-to-r from-aura-cyan to-aura-purple bg-clip-text text-transparent opacity-90 transition-all duration-500">
        {phrase}
      </span>
    </div>
  );
}

// ─── Step Item ──────────────────────────────────────────────────

function StepItem({ step }: { step: import("@/lib/types").SubagentStep }) {
  const isModifying = step.tool === "write_local_file" || step.tool === "apply_diff" || step.tool === "delete_file";
  
  const handleStepClick = () => {
    if (isModifying && step.target) {
      useProjectStore.getState().openDiffMode(step.target);
    }
  };

  let Icon = Terminal;
  if (step.tool.includes("read") || step.tool.includes("docs") || step.tool.includes("search")) {
    Icon = BookOpen;
  } else if (isModifying) {
    Icon = FileEdit;
  } else if (step.tool.includes("memory")) {
    Icon = HardDrive;
  }

  return (
    <div 
      className={`flex items-start gap-2 mt-2 px-3 py-1.5 rounded-md text-xs font-mono 
      ${isModifying ? "cursor-pointer bg-white/5 hover:bg-white/10 text-aura-cyan/90 transition-colors" : "text-[#888] bg-black/20"}`}
      onClick={isModifying ? handleStepClick : undefined}
      title={isModifying ? "Ver antes y después (Diff)" : undefined}
    >
      <Icon size={14} className="mt-0.5 opacity-70 shrink-0" />
      <div className="flex flex-col">
        <span className="opacity-90">{step.phrase}</span>
        {step.target && <span className="opacity-60 truncate max-w-[300px]">{step.target}</span>}
      </div>
    </div>
  );
}

// ─── Reasoning Accordion ────────────────────────────────────────

function ReasoningAccordion({ steps, thinkContent }: { steps?: import("@/lib/types").SubagentStep[], thinkContent?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasSteps = steps && steps.length > 0;
  
  if (!hasSteps && !thinkContent) return null;

  return (
    <div className="mb-2 w-full max-w-[85%] pr-12 animate-fade-in">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-mono text-aura-cyan/60 hover:text-aura-cyan transition-colors"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Razonamiento del Agente</span>
      </button>
      {isOpen && (
        <div className="mt-2 pl-4 border-l-2 border-white/5 flex flex-col gap-2">
          {thinkContent && (
            <div className="text-xs text-[#888] font-mono whitespace-pre-wrap italic">
              {thinkContent}
            </div>
          )}
          {hasSteps && (
            <div className="flex flex-col gap-1 mt-1">
              {steps.map(step => (
                <StepItem key={step.id} step={step} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Burbuja de mensaje individual.
 * - Usuario: alineada a la derecha, fondo azul.
 * - Asistente: alineada a la izquierda, fondo gris, renderiza Markdown.
 * - Sistema: centrada, texto itálico.
 * - Thinking: cuando isThinking=true, muestra frases rotativas de "pensando".
 */
export function MessageBubble({ message, isThinking = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs italic text-[#616161]">{message.content}</span>
      </div>
    );
  }

  // Extract <think> content
  let thinkContent = null;
  let cleanContent = message.content;
  
  if (!isUser) {
    const thinkMatch = message.content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thinkMatch) {
      thinkContent = thinkMatch[1].trim();
      cleanContent = message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, "").trim();
    }
  }

  return (
    <>
      {/* Reasoning Accordion (Outside the bubble, only for assistant) */}
      {!isUser && (message.subagentSteps?.length || thinkContent) ? (
        <ReasoningAccordion steps={message.subagentSteps} thinkContent={thinkContent} />
      ) : null}

      <div className={`mb-4 flex group ${isUser ? "justify-end pl-12" : "justify-start pr-12"} animate-fade-in`}>
        {isUser && (
        <div className="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-white/40 hover:text-white/90 hover:bg-white/5 transition-all"
            title="Copiar mensaje"
            aria-label="Copiar mensaje"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      )}

      <div
        className={`rounded-2xl transition-all ${
          isUser
            ? "rounded-br-sm bg-obsidian-800 border border-white/5 text-white/90 shadow-lg px-4 py-2"
            : "rounded-tl-sm bg-obsidian-900/60 border border-white/5 text-white/80 backdrop-blur-3xl px-4 py-3 shadow-xl relative overflow-hidden"
        }`}
      >
        {!isUser && (
          <div className="absolute inset-0 bg-aura-purple/5 animate-pulse mix-blend-screen pointer-events-none" />
        )}
        <div className="relative z-10">
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{cleanContent}</p>
          ) : isThinking ? (
            <ThinkingContent />
          ) : (
            <div className="prose prose-invert max-w-none prose-sm prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className ?? "");
                    const code = String(children).replace(/\n$/, "");

                    if (!match) {
                      return (
                        <code
                          className="rounded bg-black/40 px-1 text-aura-cyan"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    return <ApplyCodeBlock code={code} language={match[1]} />;
                  },
                }}
              >
                {cleanContent || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {!isUser && !isThinking && (
        <div className="flex items-start pt-2 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-white/40 hover:text-white/90 hover:bg-white/5 transition-all"
            title="Copiar respuesta"
            aria-label="Copiar respuesta"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
    </>
  );
}
