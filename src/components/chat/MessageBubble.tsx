import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/types";
import { ApplyCodeBlock } from "@/components/chat/ApplyCodeBlock";

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

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs italic text-[#616161]">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? "rounded-br-sm bg-[var(--vibe-indigo)] text-white"
            : "rounded-bl-sm bg-[#2d2d2d] text-[#d4d4d4]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-invert max-w-none prose-sm prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className ?? "");
                  const code = String(children).replace(/\n$/, "");

                  if (!match) {
                    return (
                      <code
                        className="rounded bg-[#3c3c3c] px-1 text-[#ce9178]"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <ApplyCodeBlock code={code} language={match[1]} />
                  );
                },
              }}
            >
              {message.content || ""}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
