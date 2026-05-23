import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { AuraNudgeBar } from "@/components/chat/AuraNudgeBar";
import { useAgentSync } from "@/hooks/useAgentSync";

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

  const authMode = useAuthStore((s) => s.authMode);

  // ─── AI Context ─────────────────────────────────────────
  const shareActiveFileContext = useChatStore((s) => s.shareActiveFileContext);
  const setShareActiveFileContext = useChatStore((s) => s.setShareActiveFileContext);
  const activeTab = useProjectStore((s) => s.activeTab);
  const activeFilename = activeTab ? activeTab.split(/[\/\\]/).pop() ?? null : null;
  const [contextPopoverOpen, setContextPopoverOpen] = useState(false);
  const contextPopoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (contextPopoverRef.current && !contextPopoverRef.current.contains(e.target as Node)) {
        setContextPopoverOpen(false);
      }
    }
    if (contextPopoverOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [contextPopoverOpen]);

  const chatFullscreen = useUIStore((s) => s.chatFullscreen);
  const toggleChatFullscreen = useUIStore((s) => s.toggleChatFullscreen);
  const chatHistoryVisible = useUIStore((s) => s.chatHistoryVisible);
  const toggleChatHistory = useUIStore((s) => s.toggleChatHistory);
  const fullscreenPreviewVisible = useUIStore((s) => s.fullscreenPreviewVisible);
  const toggleFullscreenPreview = useUIStore((s) => s.toggleFullscreenPreview);

  // ─── Agent Hook ─────────────────────────────────────────
  const { send, cancel, editPending, setRestoreInputCallback } = useAgentHandler();

  // Inyectar el callback de restore al hook para que editPending pueda
  // devolver el texto al input sin prop-drilling
  useEffect(() => {
    setRestoreInputCallback((text, _attachments) => {
      setInputText(text);
    });
  }, [setRestoreInputCallback]);

  // ─── Agent Sync ─ bridges agentStore → message bubbles ───
  const activeAssistantId = useMemo(() => {
    if (!isStreaming) return null;
    // Find the last assistant message — that's the one being actively streamed
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [isStreaming, messages]);

  useAgentSync(activeAssistantId);

  const handleSend = useCallback(
    (text: string, attachments?: Attachment[]) => {
      send(text, attachments);
    },
    [send]
  );

  const handleRetryLast = useCallback(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return;
    const lastUserMsg = userMessages[userMessages.length - 1];
    if (
      lastMsg.role === "assistant" &&
      lastMsg.content.includes("<!--RETRY_NETWORK-->")
    ) {
      useChatStore.getState().editMessage(lastMsg.id, "");
      useChatStore.getState().editMessage(lastUserMsg.id, lastUserMsg.content);
    }
    send(lastUserMsg.content, lastUserMsg.attachments, true);
  }, [messages, send]);

  const handleCancel = useCallback(
    (messageId?: string) => {
      if (messageId) {
        editPending(messageId);
      } else {
        cancel();
      }
    },
    [cancel, editPending]
  );

  const handleEdit = useCallback(
    (messageId: string) => {
      editPending(messageId);
    },
    [editPending]
  );

  // If the last message is an error with the retry tag, show the retry button
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const canRetry =
    !isStreaming &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.includes("<!--RETRY_NETWORK-->");

  return (
    <aside
      className={`flex flex-col bg-obsidian-950/80 backdrop-blur-xl overflow-hidden h-full w-full ${
        chatFullscreen
          ? "border-0"
          : "md:border-l border-white/10 md:shadow-[-4px_0_15px_rgba(0,0,0,0.5)] md:shrink-0"
      }`}
      style={width ? { width } : undefined}
    >
      <div className={`flex items-center justify-between border-b border-white/10 px-4 shrink-0 bg-transparent ${
        chatFullscreen ? "py-2" : "py-3"
      }`}>
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
          {!chatFullscreen && (
            <button
              onClick={() => useUIStore.getState().toggleChatPosition()}
              className="hidden md:block text-slate-500 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-all duration-200"
              title="Cambiar de lado"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
          )}
            <button
             onClick={toggleFullscreenPreview}
             className={`hidden md:block p-1.5 rounded-md transition-all duration-200 ${
              fullscreenPreviewVisible
                ? "text-aura-cyan bg-aura-cyan/10"
                : "text-slate-500 hover:text-white hover:bg-white/10"
            }`}
            title={fullscreenPreviewVisible ? "Ocultar vista previa" : "Mostrar vista previa"}
            aria-label="Toggle VibeLens preview"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </button>
          <button
          onClick={toggleChatFullscreen}
          className="hidden md:block text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
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


      {/* ─── Context Bar ─────────────────────────────────── */}
      {shareActiveFileContext && activeFilename && (
        <div className="relative shrink-0" ref={contextPopoverRef}>
          <button
            onClick={() => setContextPopoverOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-4 py-1.5 border-b border-white/5 bg-aura-cyan/[0.03] hover:bg-aura-cyan/[0.06] transition-colors duration-150 group"
            aria-label="Ver archivos en contexto de la IA"
            aria-expanded={contextPopoverOpen}
          >
            {/* File icon */}
            <svg className="w-3 h-3 text-aura-cyan/60 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest shrink-0">ctx</span>
            <span className="text-[11px] text-aura-cyan/70 font-mono truncate group-hover:text-aura-cyan transition-colors">
              {activeFilename}
            </span>
            <svg className={`w-3 h-3 text-white/20 ml-auto shrink-0 transition-transform duration-150 ${contextPopoverOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Popover */}
          {contextPopoverOpen && (
            <div className="absolute top-full left-0 right-0 z-50 bg-obsidian-900 border border-white/10 rounded-b-xl shadow-2xl p-3 flex flex-col gap-2 animate-fade-in-up origin-top">
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Archivo en contexto</p>
              <div className="flex items-start gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-aura-cyan/50 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-medium text-white/80 truncate">{activeFilename}</span>
                  <span className="text-[10px] font-mono text-white/25 break-all leading-relaxed">{activeTab}</span>
                </div>
              </div>
              <button
                onClick={() => { setShareActiveFileContext(false); setContextPopoverOpen(false); }}
                className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-red-400 transition-colors py-1 px-1 rounded"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Quitar archivo del contexto
              </button>
            </div>
          )}
        </div>
      )}

      {isStreaming && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center z-20">
          <button
            onClick={() => cancel()}
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

        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          hasPipelinePhase={pipelinePhase !== null}
          centered={chatFullscreen}
          onSuggestionClick={handleSend}
          onNewChat={createNewSession}
          onCancelMessage={handleCancel}
          onEditMessage={handleEdit}
        />
      



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
          <AuraNudgeBar inputText={inputText} />
          <ChatInput onSend={handleSend} disabled={isStreaming} onTextChange={setInputText} />
        </div>
      )}
    </aside>
  );
}
