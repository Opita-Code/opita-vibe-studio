import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "@/lib/types";
import { ApplyCodeBlock } from "@/components/chat/ApplyCodeBlock";
import { InlineRoadmap } from "@/components/chat/InlineRoadmap";
import { InlineSteps } from "@/components/chat/InlineSteps";
import { FileChangeSummary } from "@/components/chat/FileChangeSummary";
import { ConfirmationCard } from "@/components/chat/ConfirmationCard";
import { Copy, Check, Terminal, FileEdit, HardDrive, BookOpen, ChevronDown, ChevronRight, X, Pencil } from "lucide-react";
import { useProjectStore } from "@/stores/project";
import { GRACE_WINDOW_MS } from "@/agent/useAgentHandler";
import { SectionRenderer } from "@/components/chat/SectionRenderer";

// ─── Phase Labels ───────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  thinking: "Analizando",
  planning: "Planificando",
  building: "Construyendo",
  verifying: "Verificando",
  chatting: "Respondiendo",
};

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
  /** Callback para cancelar el mensaje pendiente */
  onCancel?: (messageId: string) => void;
  /** Callback para editar el mensaje pendiente */
  onEdit?: (messageId: string) => void;
}

// ─── Pending Message Actions ──────────────────────────────────

/**
 * Barra de gracia: se muestra en mensajes de usuario con deliveryStatus === "pending".
 * Incluye barra de cuenta regresiva animada + botones Cancel/Editar.
 */
function PendingMessageActions({
  messageId,
  onCancel,
  onEdit,
}: {
  messageId: string;
  onCancel: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="mt-2 flex flex-col gap-1.5"
    >
      {/* Barra de cuenta regresiva */}
      <div className="w-full h-0.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: GRACE_WINDOW_MS / 1000, ease: "linear" }}
        />
      </div>
      {/* Botones */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          id={`cancel-msg-${messageId}`}
          onClick={() => onCancel(messageId)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          aria-label="Cancelar mensaje"
        >
          <X size={11} />
          Cancelar
        </button>
        <button
          id={`edit-msg-${messageId}`}
          onClick={() => onEdit(messageId)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-sky-400/80 hover:text-sky-400 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 transition-all"
          aria-label="Editar mensaje"
        >
          <Pencil size={11} />
          Editar
        </button>
      </div>
    </motion.div>
  );
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

// ─── Step Item (legacy — used when no agentExecution) ────────────

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

// ─── Reasoning Accordion (legacy — used when no agentExecution) ─

function ReasoningAccordion({ steps, thinkContent, isStreaming }: { steps?: import("@/lib/types").SubagentStep[], thinkContent?: string | null, isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default
  const hasSteps = steps && steps.length > 0;
  const stepCount = steps?.length || 0;
  const label = isStreaming
    ? "Pensando..."
    : stepCount > 0
      ? `${stepCount} operación${stepCount === 1 ? "" : "es"}`
      : "Razonamiento";
  
  if (!hasSteps && !thinkContent) return null;

  return (
    <div className="mb-2 w-full animate-fade-in">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-mono text-emerald-400/70 hover:text-emerald-400 transition-colors"
      >
        {/* Spinning donut when streaming, static chevron otherwise */}
        {isStreaming ? (
          <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin text-emerald-400" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        ) : (
          isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        )}
        <span>{label}</span>
      </button>
      {isOpen && (
        <div className="mt-2 pl-4 border-l-2 border-emerald-500/20 flex flex-col gap-2">
          {thinkContent && (
            <div className="text-xs text-emerald-300/70 font-mono whitespace-pre-wrap italic leading-relaxed max-h-[300px] overflow-y-auto scroll-smooth">
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

// ─── Agent Execution Header ─────────────────────────────────────

function AgentExecutionHeader({ phase, progress, status }: { phase: string; progress: number; status: string }) {
  const label = PHASE_LABELS[phase] ?? phase;
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="flex items-center gap-2.5 mb-2">
      {/* Status indicator */}
      {isRunning ? (
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
      ) : isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      ) : isError ? (
        <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
      )}

      <span className={`text-[11px] font-semibold tracking-wide uppercase ${
        isRunning ? "text-cyan-300" :
        isDone ? "text-emerald-400/70" :
        isError ? "text-red-400" :
        "text-amber-400"
      }`}>
        {label}
        {isRunning && "..."}
      </span>

      {isRunning && (
        <span className="text-[10px] font-mono text-white/30 ml-auto">
          {progress}%
        </span>
      )}

      {isDone && (
        <span className="text-[10px] font-mono text-emerald-400/50 ml-auto">
          ✓ completo
        </span>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Burbuja de mensaje individual — Agent-Aware.
 *
 * Cuando el mensaje tiene `agentExecution`, la burbuja se transforma
 * en un mini-dashboard con:
 * - Header de fase + progreso
 * - Inline Roadmap
 * - Inline Steps
 * - File Change Summary
 * - Confirmation Card (si awaiting-confirmation)
 *
 * Mensajes sin agentExecution se renderizan como antes.
 */
export function MessageBubble({ message, isThinking = false, onCancel, onEdit }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [copied, setCopied] = useState(false);

  const hasAgentExecution = !!message.agentExecution;
  const execution = message.agentExecution;

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

  // Extract thinking/reasoning content
  // Priority: 1. message.reasoning (persisted), 2. <think> tag parsing (legacy)
  let thinkContent: string | null = null;
  let cleanContent = message.content;
  
  if (!isUser) {
    // Persisted reasoning (from AI SDK reasoning tokens)
    if (message.reasoning) {
      thinkContent = message.reasoning;
    }
    // Legacy: parse <think> tags from inline content
    const thinkMatch = message.content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thinkMatch) {
      if (!thinkContent) thinkContent = thinkMatch[1].trim();
      cleanContent = message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, "").trim();
    }
  }

  // Determine if reasoning should show as "live" (streaming indicator)
  const reasoningIsLive = isThinking || (isThinking === false && !cleanContent && !!thinkContent);

  // Check if this message uses the new sections model
  const hasSections = !isUser && (message.sections?.length ?? 0) > 0;

  // Skip rendering empty assistant bubbles (tool-only responses with no text)
  if (!isUser && !isThinking && !cleanContent.trim() && !hasSections) {
    // Still show reasoning/steps accordion if present (legacy path)
    if (!hasAgentExecution && (message.subagentSteps?.length || thinkContent)) {
      return (
        <ReasoningAccordion steps={message.subagentSteps} thinkContent={thinkContent} isStreaming={false} />
      );
    }
    // Agent-aware path: show execution dashboard even without text
    if (hasAgentExecution) {
      return (
        <div className="mb-4 flex justify-start pr-12 animate-fade-in">
          <div className="rounded-2xl rounded-tl-sm bg-obsidian-900/60 border border-white/5 text-white/80 backdrop-blur-3xl px-4 py-3 shadow-xl relative overflow-hidden w-full max-w-full">
            <div className="absolute inset-0 bg-aura-purple/5 animate-pulse mix-blend-screen pointer-events-none" />
            <div className="relative z-10">
              <AgentExecutionHeader
                phase={execution!.phase}
                progress={execution!.progress}
                status={execution!.status}
              />
              {execution!.roadmap.length > 0 && (
                <InlineRoadmap goals={execution!.roadmap} progress={execution!.progress} />
              )}
              {execution!.steps.length > 0 && (
                <InlineSteps steps={execution!.steps} isLive={execution!.status === "running"} />
              )}
              {execution!.status === "done" && execution!.filesChanged.length > 0 && (
                <FileChangeSummary files={execution!.filesChanged} />
              )}
              {execution!.status === "awaiting-confirmation" && (
                <ConfirmationCard execution={execution!} messageId={message.id} />
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {/* Legacy Reasoning Accordion (only for non-agent messages) */}
      {!isUser && !hasAgentExecution && (message.subagentSteps?.length || thinkContent) ? (
        <ReasoningAccordion steps={message.subagentSteps} thinkContent={thinkContent} isStreaming={reasoningIsLive} />
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
          {/* ── Agent Execution Header (inside the bubble) ──
               Solo se muestra mientras la ejecución está activa.
               Si status=done y hay texto, el contenido es suficiente. */}
          {!isUser && hasAgentExecution && execution!.status !== "done" && (
            <AgentExecutionHeader
              phase={execution!.phase}
              progress={execution!.progress}
              status={execution!.status}
            />
          )}

          {isUser ? (
            <>
              <p className="whitespace-pre-wrap text-sm">{cleanContent}</p>
              <AnimatePresence>
                {message.deliveryStatus === "pending" && onCancel && onEdit && (
                  <PendingMessageActions
                    messageId={message.id}
                    onCancel={onCancel}
                    onEdit={onEdit}
                  />
                )}
              </AnimatePresence>
            </>
          ) : isThinking ? (
            <ThinkingContent />
          ) : hasSections ? (
            /* ── Sections-based rendering (new path) ── */
            <div className="flex flex-col gap-1">
              {message.sections!.map((section) => (
                <SectionRenderer key={section.id} section={section} />
              ))}
            </div>
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

          {/* ── Agent Execution Widgets (inside the bubble) ── */}
          {!isUser && hasAgentExecution && (
            <>
              {execution!.roadmap.length > 0 && (
                <InlineRoadmap goals={execution!.roadmap} progress={execution!.progress} />
              )}
              {execution!.steps.length > 0 && (
                <InlineSteps steps={execution!.steps} isLive={execution!.status === "running"} />
              )}
              {execution!.status === "done" && execution!.filesChanged.length > 0 && (
                <FileChangeSummary files={execution!.filesChanged} />
              )}
              {execution!.status === "awaiting-confirmation" && (
                <ConfirmationCard execution={execution!} messageId={message.id} />
              )}
              {execution!.status === "error" && execution!.error && (
                <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/15 text-[11px] text-red-400/80">
                  ⚠️ {execution!.error}
                </div>
              )}
            </>
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
