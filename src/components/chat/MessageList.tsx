import { useEffect, useRef } from "react";
import { MAX_CONTEXT_MESSAGES, getContextCount } from "@/stores/chat";
import type { Message } from "@/lib/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import vibeLogoUrl from "@/assets/vibe-logo.svg";

// ─── Props ─────────────────────────────────────────────────────

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  hasPipelinePhase?: boolean;
  onSuggestionClick?: (text: string) => void;
  onNewChat?: () => void;
  onCancelMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void;
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Lista desplazable de mensajes con auto-scroll al último contenido.
 * Muestra un indicador de contexto ("X/20 mensajes") en el encabezado.
 */
export function MessageList({ messages, isStreaming, onSuggestionClick, onNewChat, onCancelMessage, onEditMessage }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextCount = getContextCount(messages);

  // Auto-scroll cuando llegan nuevos mensajes o chunks de streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const starterPrompts = [
    { icon: "🔍", text: "Explora la estructura de mi proyecto" },
    { icon: "🏗️", text: "Crea un componente con TypeScript y tests" },
    { icon: "📖", text: "Lee mi package.json y explícame las dependencias" },
  ];

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth" role="log" aria-live="polite" aria-label="Mensajes del chat">
      {messages.length > 0 && (
        <div className={`border-b px-4 py-2 sticky top-0 z-10 backdrop-blur-md flex items-center justify-between transition-colors duration-500 ${
          contextCount === MAX_CONTEXT_MESSAGES 
            ? 'bg-red-900/30 border-red-500/30' 
            : contextCount >= MAX_CONTEXT_MESSAGES * 0.8 
              ? 'bg-amber-900/20 border-amber-500/20' 
              : 'bg-black/20 border-white/5'
        }`}>
          <div className="flex items-center gap-2">
            {contextCount >= MAX_CONTEXT_MESSAGES * 0.8 && (
              <span className={contextCount === MAX_CONTEXT_MESSAGES ? "text-red-400" : "text-amber-400"}>⚠️</span>
            )}
            <span className={`text-[11px] font-mono tracking-tighter uppercase ${
              contextCount === MAX_CONTEXT_MESSAGES 
                ? 'text-red-300 font-bold' 
                : contextCount >= MAX_CONTEXT_MESSAGES * 0.8 
                  ? 'text-amber-300' 
                  : 'text-slate-500'
            }`}>
              {contextCount}/{MAX_CONTEXT_MESSAGES} mensajes
            </span>
          </div>
          
          {contextCount >= MAX_CONTEXT_MESSAGES * 0.8 && onNewChat && (
             <button onClick={onNewChat} aria-label="Iniciar nuevo chat" className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
               contextCount === MAX_CONTEXT_MESSAGES 
                 ? 'bg-red-500/20 text-red-300 hover:bg-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                 : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/30'
             }`}>
               Nuevo Chat
             </button>
          )}
        </div>
      )}

      {messages.length === 0 && !isStreaming ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-6 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-obsidian-800 to-obsidian-900 flex items-center justify-center border border-white/5 shadow-[0_0_30px_rgba(168,85,247,0.15)] backdrop-blur-md mb-2">
            <img src={vibeLogoUrl} alt="Aura" className="w-10 h-10 animate-breathe opacity-80" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-slate-200">Hola, soy <span className="text-aura-cyan font-semibold">Aura</span> 👋</h3>
            <p className="text-sm text-slate-500 max-w-[260px] mx-auto leading-relaxed">
              Tu copiloto de código. Describe tu idea o empieza explorando tu proyecto.
            </p>
          </div>
          
          <div className="flex flex-col w-full gap-2 mt-4">
            {starterPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(prompt.text)}
                aria-label={`Sugerencia: ${prompt.text}`}
                className="flex items-center gap-3 w-full text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-vibe-purple/30 hover:shadow-[0_0_15px_rgba(176,38,255,0.1)] transition-all duration-300 group"
              >
                <span className="text-lg group-hover:scale-110 transition-transform">{prompt.icon}</span>
                <span className="text-sm text-slate-300 font-medium group-hover:text-aura-cyan transition-colors">{prompt.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isThinking={
                isStreaming &&
                msg.role === "assistant" &&
                idx === messages.length - 1 &&
                !msg.content
              }
              onCancel={onCancelMessage}
              onEdit={onEditMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
