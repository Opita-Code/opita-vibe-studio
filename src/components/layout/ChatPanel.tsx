import { useCallback } from "react";
import { useChatStore, getContextMessages } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";

import { streamAwsSse } from "@/services/aiService";
import { detectCodeRequest, runPipeline } from "@/pipeline/engine";
import { isLimitReached } from "@/lib/tokens";
import type { Message } from "@/lib/types";

// ─── Props ─────────────────────────────────────────────────────

interface ChatPanelProps {
  width: number;
  onLogin?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

/** Texto de estado para cada fase del pipeline. */
const PHASE_STATUS_TEXT: Record<string, string> = {
  entender: "Analizando tu idea...",
  construir: "Escribiendo código...",
  verificar: "Verificando...",
};

/**
 * Envía un mensaje a través del pipeline OpenSpec (si es una solicitud
 * de código) o directamente al proveedor AI (si es una pregunta simple).
 *
 * Incluye:
 * - Verificación de límite de prompts antes de enviar
 * - Incremento del contador de prompts después de enviar
 */
async function sendMessage(
  text: string,
  activeProvider: string,
  addMessage: (msg: Message) => void,
  appendToLastMessage: (content: string) => void,
  replaceLastMessageContent: (content: string) => void,
  setStreaming: (v: boolean) => void,
  setPipelinePhase: (phase: "entender" | "construir" | "verificar" | null) => void,
  incrementPromptsUsed: () => void,
) {
  // ── Verificar límite de prompts ─────────────────────────
  const usage = useAuthStore.getState().tokenUsage;
  if (isLimitReached(usage)) {
    const limitMsg: Message = {
      id: generateId(),
      role: "assistant",
      content:
        "⚠️ Llegaste al límite de **" +
        usage.promptsLimit +
        " prompts** este mes.\n\n" +
        "Puedes:\n" +
        "1. **Actualizar plan** → más prompts mensuales\n" +
        "2. **Configurar BYOK** → tus prompts no cuentan en el límite\n\n" +
        "Los prompts se renuevan automáticamente.",
      timestamp: Date.now(),
    };
    addMessage(limitMsg);
    return;
  }

  // Mensaje del usuario
  const userMsg: Message = {
    id: generateId(),
    role: "user",
    content: text,
    timestamp: Date.now(),
  };
  addMessage(userMsg);

  // Mensaje del asistente (vacío, se llena durante el pipeline/streaming)
  const assistantMsg: Message = {
    id: generateId(),
    role: "assistant",
    content: "",
    timestamp: Date.now(),
  };
  addMessage(assistantMsg);
  setStreaming(true);

  try {
    const allMessages = useChatStore.getState().messages;
    const context = getContextMessages(allMessages);
    const hasProjectOpen = useProjectStore.getState().rootPath !== null;

    // Detectar si es una solicitud de código o una pregunta simple
    if (detectCodeRequest(text, hasProjectOpen)) {
      // ── Pipeline OpenSpec (invisible) ───────────────────
      let accumulatedContent = "";

      for await (const event of runPipeline(text, context, activeProvider)) {
        switch (event.type) {
          case "phase_change": {
            setPipelinePhase(event.phase);
            const statusText = PHASE_STATUS_TEXT[event.phase] ?? "Procesando...";
            replaceLastMessageContent(statusText);
            break;
          }

          case "file_created": {
            const fileName = event.path.split(/[/\\]/).pop() ?? event.path;
            const fileNote = `\n\n✅ Archivo creado: \`${fileName}\``;
            accumulatedContent += fileNote;
            replaceLastMessageContent(accumulatedContent);
            break;
          }

          case "retry": {
            const retryNote = `\n\n🔄 Reintento ${event.attempt}: ${event.reason}`;
            accumulatedContent += retryNote;
            replaceLastMessageContent(accumulatedContent);
            break;
          }

          case "result": {
            accumulatedContent = event.content;
            if (event.files.length > 0) {
              const fileList = event.files.map((f) => `- \`${f.path}\``).join("\n");
              accumulatedContent += `\n\n---\n**Archivos generados:**\n${fileList}`;
            }
            replaceLastMessageContent(accumulatedContent);
            break;
          }

          case "error": {
            accumulatedContent += `\n\n⚠️ ${event.message}`;
            replaceLastMessageContent(accumulatedContent);
            break;
          }
        }
      }

      setPipelinePhase(null);
    } else {
      // ── Chat directo (Vía AWS Serverless Backend) ─────────
      const dummyToken = "dev-token-a-reemplazar";
      for await (const chunk of streamAwsSse(context, dummyToken)) {
        if (chunk.type === "text") {
          appendToLastMessage(chunk.content);
        } else if (chunk.type === "error") {
          appendToLastMessage(`\n\n⚠️ ${chunk.content}`);
        } else if (chunk.type === "mcp_tool_request") {
          console.log("[Fase 3] MCP Tool Request interceptado:", chunk.tool, chunk.args);
        }
      }
    }

    // Incrementar contador de prompts después de enviar exitosamente
    incrementPromptsUsed();
  } catch (_err) {
    appendToLastMessage(`\n\n⚠️ Error inesperado: ${_err}`);
  } finally {
    setStreaming(false);
  }
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Panel de chat lateral derecho.
 *
 * Integra la lista de mensajes, el área de entrada, la barra de
 * tokens, y decide si usa el pipeline OpenSpec (para solicitudes
 * de código) o chat directo (para preguntas simples).
 *
 * Verifica el límite de prompts antes de cada mensaje y bloquea
 * el envío si se alcanzó el límite del plan.
 */
export function ChatPanel({ width, onLogin }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeProvider = useChatStore((s) => s.activeProvider);
  const authMode = useAuthStore((s) => s.authMode);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToLastMessage = useChatStore((s) => s.appendToLastMessage);
  const replaceLastMessageContent = useChatStore((s) => s.replaceLastMessageContent);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setPipelinePhase = useChatStore((s) => s.setPipelinePhase);
  const incrementPromptsUsed = useAuthStore((s) => s.incrementPromptsUsed);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(
        text,
        activeProvider,
        addMessage,
        appendToLastMessage,
        replaceLastMessageContent,
        setStreaming,
        setPipelinePhase,
        incrementPromptsUsed,
      );
    },
    [
      activeProvider,
      addMessage,
      appendToLastMessage,
      replaceLastMessageContent,
      setStreaming,
      setPipelinePhase,
      incrementPromptsUsed,
    ],
  );

  return (
    <aside
      className="flex flex-col bg-slate-900/40 backdrop-blur-md border-x border-white/5 overflow-hidden shrink-0 h-full"
      style={{ width }}
    >
      {/* Encabezado */}
      <div className="flex items-center border-b border-white/5 px-4 py-3 shrink-0 bg-slate-900/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span className="text-vibe-purple">✨</span> Asistente IA
        </span>
      </div>

      {/* Banner de modo invitado */}


      {/* Lista de mensajes con scroll */}
      <MessageList messages={messages} isStreaming={isStreaming} />

      {/* Input de chat o Prompt de Login */}
      {authMode === "unauthenticated" ? (
        <div className="p-6 m-4 mt-auto bg-slate-800/40 border border-white/5 rounded-xl shadow-2xl backdrop-blur flex flex-col items-center text-center">
          <span className="text-4xl mb-4 animate-pulse">✨</span>
          <p className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400 mb-5">
            Despierta a la IA para potenciar tu código
          </p>
          <button 
            onClick={onLogin} 
            className="w-full py-2.5 bg-gradient-to-r from-vibe-purple to-vibe-cyan text-white text-sm font-medium rounded-lg shadow-lg shadow-purple-500/20 hover:scale-105 transition-transform"
          >
            Iniciar Sesión
          </button>
        </div>
      ) : (
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      )}
    </aside>
  );
}
