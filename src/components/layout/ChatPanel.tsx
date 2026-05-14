import { useCallback } from "react";
import { useChatStore, getContextMessages } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import vibeLogoUrl from "@/assets/vibe-logo.svg";

import { detectCodeRequest, runPipeline } from "@/pipeline/engine";
import { isLimitReached } from "@/lib/tokens";
import type { Message, Attachment } from "@/lib/types";

// ─── Props ─────────────────────────────────────────────────────

interface ChatPanelProps {
  width?: number;
  onLogin?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

const PHASE_STATUS_TEXT: Record<string, string> = {
  entender: "Sincronizando el aura del proyecto...",
  construir: "Inyectando flow en los componentes...",
  verificar: "Auditando la estética del algoritmo...",
};

async function sendMessage(
  text: string,
  attachments: Attachment[] | undefined,
  activeProvider: string,
  activeModelId: string,
  addMessage: (msg: Message) => void,
  appendToLastMessage: (content: string) => void,
  replaceLastMessageContent: (content: string) => void,
  setStreaming: (v: boolean) => void,
  setPipelinePhase: (phase: "entender" | "construir" | "verificar" | null) => void,
  incrementPromptsUsed: () => void,
  isRetry: boolean = false
) {
  const usage = useAuthStore.getState().tokenUsage;
  if (!isRetry && isLimitReached(usage)) {
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

  if (!isRetry) {
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
      attachments: attachments,
    };
    addMessage(userMsg);
  }

  const assistantMsg: Message = {
    id: generateId(),
    role: "assistant",
    content: "",
    timestamp: Date.now(),
  };
  
  if (isRetry) {
    // Si es reintento, ya tenemos el mensaje del usuario, solo añadimos/reemplazamos el del asistente
    addMessage(assistantMsg);
  } else {
    addMessage(assistantMsg);
  }
  
  setStreaming(true);

  try {
    const state = useChatStore.getState();
    const allMessages = state.sessions[state.activeSessionId]?.messages || [];
    let context = getContextMessages(allMessages);
    const projectState = useProjectStore.getState();
    const hasProjectOpen = projectState.workspaces.length > 0;

    // Inyectar el contexto del archivo activo antes del último mensaje del usuario
    if (hasProjectOpen && projectState.activeTab && projectState.fileContents[projectState.activeTab]) {
      const activeFilePath = projectState.activeTab;
      const activeFileContent = projectState.fileContents[activeFilePath];
      
      const fileContextMsg: Message = {
        id: generateId(),
        role: "system",
        content: `[SISTEMA: Contexto del Editor]\nEl usuario está viendo o editando actualmente el archivo: ${activeFilePath}\n\nContenido actual del archivo:\n\`\`\`\n${activeFileContent}\n\`\`\`\nTen en cuenta este código si el usuario pide revisar, explicar o modificar "este código" o "este archivo".`,
        timestamp: Date.now() - 1,
      };

      // Si el último mensaje en context es el del asistente (vacío) y el penúltimo es el del usuario:
      // Insertamos el contexto justo antes del mensaje del usuario.
      const lastUserIndex = context.map(m => m.role).lastIndexOf("user");
      if (lastUserIndex !== -1) {
        context = [
          ...context.slice(0, lastUserIndex),
          fileContextMsg,
          ...context.slice(lastUserIndex)
        ];
      } else {
        context = [...context, fileContextMsg];
      }
    }

    if (detectCodeRequest(text, hasProjectOpen)) {
      let accumulatedContent = "";

      for await (const event of runPipeline(text, context, activeProvider, activeModelId)) {
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
              
              // Open the first generated file in the editor automatically
              const firstFile = event.files[0].path;
              useProjectStore.getState().openFile(firstFile);
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
      const { streamFromProvider } = await import("@/providers/router");
      let rawContent = "";
      const executedActions = new Set<string>();

      for await (const chunk of streamFromProvider(context, activeProvider, { model: activeModelId })) {
        if (chunk.type === "text") {
          rawContent += chunk.content;

          // Process UI Navigation Tags
          const regex = /<vibe-action\s+type="([^"]+)"\s+value="([^"]+)"\s*\/>/g;
          let match;
          while ((match = regex.exec(rawContent)) !== null) {
            const actionRaw = match[0];
            if (!executedActions.has(actionRaw)) {
              executedActions.add(actionRaw);
              const type = match[1];
              const value = match[2];

              if (type === "set-view") {
                useUIStore.getState().setActiveView(value as any);
              } else if (type === "open-file") {
                useProjectStore.getState().openFile(value);
              } else if (type === "toggle-explorer") {
                useUIStore.getState().setExplorerVisible(value === "true");
              } else if (type === "preview-component") {
                useUIStore.getState().setPreviewTarget(value);
                useUIStore.getState().setActiveView("split");
              }
            }
          }

          const cleanedContent = rawContent.replace(/<vibe-action[^>]+>\s*/g, "");
          replaceLastMessageContent(cleanedContent);
        } else if (chunk.type === "error") {
          if (chunk.content.startsWith("UPGRADE_REQUIRED:")) {
            const msg = chunk.content.replace("UPGRADE_REQUIRED:", "").trim();
            rawContent += `\n\n💎 **Vibe Pro Requerido**\n${msg}\n\n[Mejorar Plan](#)`;
          } else {
            rawContent += `\n\n⚠️ ${chunk.content}`;
          }
          const cleanedContent = rawContent.replace(/<vibe-action[^>]+>\s*/g, "");
          replaceLastMessageContent(cleanedContent);
        } else if (chunk.type === "mcp_tool_request") {
          if (chunk.tool) {
            useChatStore.getState().setExecutingMCP(true);
            const { handleMcpToolRequest } = await import("@/services/mcpClient");
            await handleMcpToolRequest(chunk.tool, chunk.args, "local");
            useChatStore.getState().setExecutingMCP(false);
          }
        }
      }
    }

    if (!isRetry) {
      incrementPromptsUsed();
    }
  } catch (_err) {
    appendToLastMessage(`\n\n⚠️ Error inesperado: ${_err}\n<!--RETRY_NETWORK-->`);
  } finally {
    setStreaming(false);
  }
}

export function ChatPanel({ width, onLogin }: ChatPanelProps) {
  const session = useChatStore((s) => s.sessions[s.activeSessionId]);
  const messages = session?.messages || [];
  
  const isStreaming = useChatStore((s) => s.isStreaming);
  const isExecutingMCP = useChatStore((s) => s.isExecutingMCP);
  const abortStreaming = useChatStore((s) => s.abortStreaming);
  const activeProvider = useChatStore((s) => s.activeProvider);
  const activeModelId = useChatStore((s) => s.activeModelId);
  const useSubagent = useChatStore((s) => s.useSubagent);
  const setUseSubagent = useChatStore((s) => s.setUseSubagent);

  const authMode = useAuthStore((s) => s.authMode);
  const plan = useAuthStore((s) => s.plan);
  
  const chatFullscreen = useUIStore((s) => s.chatFullscreen);
  const toggleChatFullscreen = useUIStore((s) => s.toggleChatFullscreen);
  const chatHistoryVisible = useUIStore((s) => s.chatHistoryVisible);
  const toggleChatHistory = useUIStore((s) => s.toggleChatHistory);

  const addMessage = useChatStore((s) => s.addMessage);
  const appendToLastMessage = useChatStore((s) => s.appendToLastMessage);
  const replaceLastMessageContent = useChatStore((s) => s.replaceLastMessageContent);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setPipelinePhase = useChatStore((s) => s.setPipelinePhase);
  const createNewSession = useChatStore((s) => s.createNewSession);
  const incrementPromptsUsed = useAuthStore((s) => s.incrementPromptsUsed);

  const handleSend = useCallback(
    (text: string, attachments?: Attachment[]) => {
      sendMessage(
        text,
        attachments,
        activeProvider,
        activeModelId,
        addMessage,
        appendToLastMessage,
        replaceLastMessageContent,
        setStreaming,
        setPipelinePhase,
        incrementPromptsUsed,
        false
      );
    },
    [activeProvider, activeModelId, addMessage, appendToLastMessage, replaceLastMessageContent, setStreaming, setPipelinePhase, incrementPromptsUsed]
  );

  const handleRetryLast = useCallback(() => {
    // Remove the last assistant error message
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    // Find the last user message to resend
    const userMessages = messages.filter(m => m.role === "user");
    if (userMessages.length === 0) return;
    const textToResend = userMessages[userMessages.length - 1].content;
    
    // Truncate to before the error message
    if (lastMsg.role === "assistant" && lastMsg.content.includes("<!--RETRY_NETWORK-->")) {
       useChatStore.getState().editMessage(lastMsg.id, ""); // This isn't perfect for truncation but works for UI
       // Actually a better approach is to delete the last message. We can use editMessage on the USER message to truncate.
       useChatStore.getState().editMessage(userMessages[userMessages.length - 1].id, textToResend);
    }
    
    sendMessage(
      textToResend,
      userMessages[userMessages.length - 1].attachments,
      activeProvider,
      activeModelId,
      addMessage,
      appendToLastMessage,
      replaceLastMessageContent,
      setStreaming,
      setPipelinePhase,
      incrementPromptsUsed,
      true // isRetry
    );
  }, [messages, activeProvider, activeModelId, addMessage, appendToLastMessage, replaceLastMessageContent, setStreaming, setPipelinePhase, incrementPromptsUsed]);

  // If the last message is an error with the retry tag, show the retry button below it
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const canRetry = !isStreaming && lastMessage?.role === "assistant" && lastMessage.content.includes("<!--RETRY_NETWORK-->");

  return (
    <aside
      className={`flex flex-col bg-obsidian-950/80 backdrop-blur-xl border-l border-white/10 overflow-hidden shrink-0 h-full shadow-[-4px_0_15px_rgba(0,0,0,0.5)]`}
      style={{ width }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0 bg-transparent">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-aura-cyan"></div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-white/70">
            Vibe AI
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleChatHistory}
            className={`p-1.5 rounded-md transition-all duration-200 ${chatHistoryVisible ? "text-aura-cyan bg-aura-cyan/10" : "text-slate-500 hover:text-white hover:bg-white/10"}`}
            title="Mostrar/Ocultar Historial"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h7"/>
              <path d="M14 15l3 3 5-5"/>
            </svg>
          </button>
          <button
            onClick={() => useUIStore.getState().toggleChatPosition()}
            className="text-slate-500 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-all duration-200"
            title="Cambiar de lado"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <button
          onClick={toggleChatFullscreen}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
          title={chatFullscreen ? "Contraer" : "Pantalla completa"}
          aria-label={chatFullscreen ? "Contraer panel de chat" : "Expandir panel de chat a pantalla completa"}
        >
          {chatFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          )}
        </button>
        </div>
      </div>

      {isExecutingMCP && (
        <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-4 py-2 flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vibe-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-vibe-indigo"></span>
          </div>
          <span className="text-xs text-indigo-200 font-mono">IA interactuando con la terminal local...</span>
        </div>
      )}

      {isStreaming && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center z-20">
          <button
            onClick={() => abortStreaming()}
            className="flex items-center gap-2 bg-obsidian-800 hover:bg-red-500/10 border border-white/10 hover:border-red-500/50 text-slate-300 hover:text-red-400 px-4 py-1.5 rounded-full text-xs font-medium shadow-md transition-all"
            aria-label="Detener generación de la respuesta"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
            Detener generación
          </button>
        </div>
      )}

      <MessageList messages={messages} isStreaming={isStreaming} onSuggestionClick={handleSend} onNewChat={createNewSession} />
      
      {canRetry && (
        <div className="flex justify-center -mt-2 mb-2 relative z-10">
          <button 
            onClick={handleRetryLast}
            className="flex items-center gap-2 px-4 py-1.5 bg-vibe-bg border border-glass hover:bg-vibe-surface text-sm text-slate-200 rounded-full shadow-lg transition-colors"
          >
            🔄 Reintentar Envío
          </button>
        </div>
      )}

      {authMode === "unauthenticated" ? (
        <div className="p-6 m-4 mt-auto bg-obsidian-800 border border-white/10 rounded-xl shadow-lg flex flex-col items-center text-center">
          <img src={vibeLogoUrl} alt="Vibe Studio" className="w-12 h-12 mb-4 opacity-80" />
          <p className="text-sm font-medium text-slate-300 mb-5">
            Despierta a Vibe AI para potenciar tu código
          </p>
          <button 
            onClick={onLogin} 
            className="w-full py-2.5 bg-white text-black text-sm font-semibold rounded-lg shadow hover:bg-slate-200 transition-colors"
          >
            Iniciar Sesión
          </button>
        </div>
      ) : (
        <div className="flex flex-col border-t border-white/5 mt-auto bg-black/20">
          {plan === "pro" && (
            <div className="px-4 py-2 flex justify-between items-center bg-obsidian-800 border-b border-white/5">
              <span className="text-[10px] font-bold text-vibe-cyan uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-[12px]">🚀</span> Vibe Pro Engine
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={useSubagent} 
                  onChange={(e) => setUseSubagent(e.target.checked)} 
                  disabled={isStreaming}
                />
                <div className="w-7 h-4 bg-slate-700/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[12px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-vibe-cyan/90 peer-disabled:opacity-50"></div>
              </label>
            </div>
          )}
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      )}
    </aside>
  );
}
