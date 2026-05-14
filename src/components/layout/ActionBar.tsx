import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";

export function ActionBar() {
  const { actionBarVisible, setOmnibarOpen } = useUIStore();
  const { isSyncing, statusMessage } = useProjectStore();

  if (!actionBarVisible) return null;

  return (
    <div className="h-8 bg-obsidian-950 border-b border-white/5 flex items-center justify-between px-3 shrink-0 select-none z-50">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Vibe Studio
        </span>
      </div>

      <div className="flex items-center justify-center flex-1">
        {/* Search / OmniBar trigger */}
        <button 
          onClick={() => setOmnibarOpen(true)}
          className="flex items-center gap-2 px-32 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors text-xs" 
          title="Abrir OmniBar (Ctrl+P / Cmd+K)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Buscar comandos, archivos, chats...
        </button>
      </div>

      <div className="flex items-center gap-3">
        {statusMessage && (
          <span className="text-[10px] text-slate-500 animate-pulse">
            {statusMessage}
          </span>
        )}
        {isSyncing && (
          <div className="flex items-center gap-1.5 text-aura-cyan">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
