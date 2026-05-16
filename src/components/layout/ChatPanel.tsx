import { useCallback, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { PhaseConfirmationBar } from "@/components/chat/ModeButtons";
import { AuraNudgeBar } from "@/components/chat/AuraNudgeBar";
import { AgentActivityBar } from "@/components/chat/AgentActivityBar";

import { useAgentHandler } from "@/agent";
import vibeLogoUrl from "@/assets/vibe-logo.svg";

import type { Attachment } from "@/lib/types";

// ─── Props ─────────────────────────────────────────────────────

interface ChatPanelProps {
  width?: number;
}

export function ChatPanel({ width }: ChatPanelProps) {
  const session = useChatStore((s) => s.sessions[s.activeSessionId]);
  const messages = session?.messages || [];
  const [inputText, setInputText] = useState("");

  const isStreaming = useChatStore((s) => s.isStreaming);
  const pipelinePhase = useChatStore((s) => s.pipelinePhase);
  const createNewSession = useChatStore((s) => s.createNewSession);
  const useSubagent = useChatStore((s) => s.useSubagent);
  const setUseSubagent = useChatStore((s) => s.setUseSubagent);

  const authMode = useAuthStore((s) => s.authMode);
  const plan = useAuthStore((s) => s.plan);

  const chatFullscreen = useUIStore((s) => s.chatFullscreen);
  const toggleChatFullscreen = useUIStore((s) => s.toggleChatFullscreen);
  const chatHistoryVisible = useUIStore((s) => s.chatHistoryVisible);
  const toggleChatHistory = useUIStore((s) => s.toggleChatHistory);

  // ─── Agent Hook (replaces the 345-line sendMessage function) ───
  const { send, abort } = useAgentHandler();

  const handleSend = useCallback(
    (text: string, attachments?: Attachment[]) => {
      send(text, attachments);
    },
    [send]
  );

  const handleRetryLast = useCallback(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    // Find the last user message to resend
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return;
    const lastUserMsg = userMessages[userMessages.length - 1];

    // Clean up the error message
    if (
      lastMsg.role === "assistant" &&
      lastMsg.content.includes("<!--RETRY_NETWORK-->")
    ) {
      useChatStore.getState().editMessage(lastMsg.id, "");
      useChatStore.getState().editMessage(lastUserMsg.id, lastUserMsg.content);
    }

    send(lastUserMsg.content, lastUserMsg.attachments, true);
  }, [messages, send]);

  // If the last message is an error with the retry tag, show the retry button
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const canRetry =
    !isStreaming &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.includes("<!--RETRY_NETWORK-->");

  return (
    <aside
      className={`flex flex-col bg-obsidian-950/80 backdrop-blur-xl border-l border-white/10 overflow-hidden shrink-0 h-full w-full shadow-[-4px_0_15px_rgba(0,0,0,0.5)]`}
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

      {/* Agent Activity Bar — Real-time transparency panel */}
      <AgentActivityBar />

      {isStreaming && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center z-20">
          <button
            onClick={() => abort()}
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

      <MessageList messages={messages} isStreaming={isStreaming} hasPipelinePhase={pipelinePhase !== null} onSuggestionClick={handleSend} onNewChat={createNewSession} />
      


      <PhaseConfirmationBar />

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
          <p id="chat-cta-description" className="text-sm font-medium text-slate-300 mb-5">
            Despierta a Vibe AI para potenciar tu código
          </p>
          <button 
            onClick={() => window.location.href = `https://cuenta.opitacode.com/login?return_to=${encodeURIComponent(window.location.href)}`} 
            className="w-full py-2.5 bg-white text-black text-sm font-semibold rounded-lg shadow hover:bg-slate-200 transition-colors"
            aria-describedby="chat-cta-description"
          >
            Iniciar Sesión
          </button>
        </div>
      ) : (
        <div className="flex flex-col border-t border-white/5 mt-auto bg-black/20">
          {(plan === "pro" || plan === "estudiante") && (
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
                  aria-label="Activar Vibe Pro Engine"
                />
                <div className="w-7 h-4 bg-slate-700/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[12px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-vibe-cyan/90 peer-disabled:opacity-50"></div>
              </label>
            </div>
          )}
          <AuraNudgeBar inputText={inputText} />
          <ChatInput onSend={handleSend} disabled={isStreaming} onTextChange={setInputText} />
        </div>
      )}
    </aside>
  );
}
