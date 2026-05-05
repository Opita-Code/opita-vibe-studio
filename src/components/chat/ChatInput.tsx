import { useCallback, useRef, useState } from "react";

// ─── Constants ─────────────────────────────────────────────────

const CHAR_LIMIT = 8000;

// ─── Props ─────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Área de entrada de texto multilínea con botón de envío.
 * - Enter: enviar mensaje.
 * - Shift+Enter: nueva línea.
 * - Límite de 8000 caracteres con contador visible.
 * - Deshabilitado mientras se está transmitiendo una respuesta.
 * - Texto vacío o solo espacios: no-op silencioso.
 */
export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const charsRemaining = CHAR_LIMIT - text.length;
  const isOverLimit = text.length >= CHAR_LIMIT;

  return (
    <div className="border-t border-[#333] p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= CHAR_LIMIT) {
              setText(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Escribí en español lo que querés crear..."
          disabled={disabled}
          rows={3}
          className="flex-1 resize-none rounded bg-[#3c3c3c] px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#616161] outline-none focus:ring-1 focus:ring-[#1e4d8c] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          aria-label="Enviar mensaje"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#1e4d8c] text-white transition-colors hover:bg-[#2a5fa8] disabled:opacity-40"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1.5 1.5L14.5 8L1.5 14.5L3.5 8L1.5 1.5Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-1 flex justify-end">
        <span className={`text-xs ${isOverLimit ? "text-red-400" : "text-[#616161]"}`}>
          {isOverLimit ? "Límite alcanzado" : `${charsRemaining} caracteres disponibles`}
        </span>
      </div>
    </div>
  );
}
