import { useEffect, useRef } from "react";
import { MAX_CONTEXT_MESSAGES, getContextCount } from "@/stores/chat";
import type { Message } from "@/lib/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StreamingIndicator } from "@/components/chat/StreamingIndicator";

// ─── Props ─────────────────────────────────────────────────────

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Lista desplazable de mensajes con auto-scroll al último contenido.
 * Muestra un indicador de contexto ("X/20 mensajes") en el encabezado.
 */
export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextCount = getContextCount(messages);

  // Auto-scroll cuando llegan nuevos mensajes o chunks de streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      {messages.length > 0 && (
        <div className="border-b border-[#333] px-4 py-1.5">
          <span className="text-xs text-[#616161]">
            {contextCount}/{MAX_CONTEXT_MESSAGES} mensajes
          </span>
        </div>
      )}

      {messages.length === 0 && !isStreaming ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
          <span className="text-3xl">💬</span>
          <p className="text-sm text-[#969696]">No hay mensajes todavía</p>
          <p className="text-xs text-[#616161] max-w-xs">
            Escribe en español lo que quieres crear y la IA te va a ayudar. Puedes pedir
            páginas web, componentes, o hacer preguntas sobre código.
          </p>
        </div>
      ) : (
        <div className="p-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isStreaming && <StreamingIndicator />}
        </div>
      )}
    </div>
  );
}
