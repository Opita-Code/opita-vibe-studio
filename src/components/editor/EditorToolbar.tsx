import { useUIStore } from "@/stores/ui";

export function EditorToolbar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <div className="flex items-center gap-1 px-2 h-full border-l border-white/5 bg-obsidian-950/50 shrink-0">
      <button 
        onClick={() => setActiveView("editor")}
        className={`p-1.5 rounded-md transition-colors ${activeView === "editor" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
        title="Solo Código"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </button>

      <button 
        onClick={() => setActiveView("split")}
        className={`p-1.5 rounded-md transition-colors ${activeView === "split" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
        title="Dividir (Código + Previsualización)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="3" x2="12" y2="21"></line>
        </svg>
      </button>

      <div className="w-px h-4 bg-white/10 mx-1"></div>

      <button 
        className="p-1.5 rounded-md text-slate-500 hover:text-green-400 hover:bg-green-400/10 transition-colors"
        title="Ejecutar Proyecto (Run)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    </div>
  );
}
