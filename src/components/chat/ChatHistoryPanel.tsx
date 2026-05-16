import { useChatStore } from "@/stores/chat";
import { useUIStore } from "@/stores/ui";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function ChatHistoryPanel() {
  const sessions = useChatStore(s => s.sessions);
  const createNewSession = useChatStore(s => s.createNewSession);
  const switchSession = useChatStore(s => s.switchSession);
  const deleteSession = useChatStore(s => s.deleteSession);
  
  const toggleChatHistory = useUIStore(s => s.toggleChatHistory);
  const sortedSessions = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col h-full bg-obsidian-950/80 backdrop-blur-xl border-r border-white/10 w-[80vw] md:w-[240px] overflow-hidden flex-shrink-0 shadow-[4px_0_15px_rgba(0,0,0,0.5)] z-40 relative" role="navigation" aria-label="Historial de chats">
      <div className="p-3 border-b border-white/10 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleChatHistory}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-md transition-colors"
            aria-label="Ocultar historial de chats"
            title="Ocultar Historial"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <h2 className="text-[11px] font-bold text-white/70 uppercase tracking-widest">Historial</h2>
        </div>
        <button 
          onClick={createNewSession}
          className="text-aura-cyan hover:bg-aura-cyan/10 p-1.5 rounded-md transition-colors"
          aria-label="Crear nuevo chat"
          title="Nuevo Chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
        {sortedSessions.map((session) => (
          <div 
            key={session.id}
            role="button"
            tabIndex={0}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer"
            onClick={() => switchSession(session.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchSession(session.id); } }}  
          >
            <div className="overflow-hidden pr-2 flex-1">
              <h3 className="text-sm text-slate-200 truncate">{session.title}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                {formatDistanceToNow(session.updatedAt, { addSuffix: true, locale: es })}
              </p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(session.id);
              }}
              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded shrink-0"
              aria-label={`Eliminar chat: ${session.title}`}
              title="Eliminar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
        ))}
        {sortedSessions.length === 0 && (
          <div className="text-center p-4 text-slate-500 text-xs">
            No hay sesiones guardadas.
          </div>
        )}
      </div>
    </div>
  );
}
