import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/types";
import { ApplyCodeBlock } from "@/components/chat/ApplyCodeBlock";
import { Copy, Check } from "lucide-react";

// ─── Props ─────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Burbuja de mensaje individual.
 * - Usuario: alineada a la derecha, fondo azul.
 * - Asistente: alineada a la izquierda, fondo gris, renderiza Markdown.
 * - Sistema: centrada, texto itálico.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
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

  return (
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
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
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
                {message.content || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {!isUser && (
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
  );
}
