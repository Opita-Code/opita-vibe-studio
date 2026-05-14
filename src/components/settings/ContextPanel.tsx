import { useAuthStore } from "@/stores/auth";

export function ContextPanel() {
  const plan = useAuthStore(s => s.plan);

  if (plan !== "pro") {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 bg-glass border border-glass rounded-xl shadow-lg mt-8">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl opacity-50">🔒</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2 tracking-wide">Contexto Inteligente (Pro)</h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Sube tus archivos gigantes a Vibe Storage y aprovecha Context7 para indexar documentación externa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-5 bg-gradient-to-br from-white/5 to-transparent rounded-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <span className="text-vibe-purple">☁️</span> Vibe Storage
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed max-w-[250px]">
          Sube archivos gigantes, PDFs, exportaciones de Figma y manuales. Construiremos contexto inteligente exclusivo para tu entorno de trabajo.
        </p>
        
        <div className="bg-black/30 rounded-lg p-3 border border-white/5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">Almacenamiento usado</span>
            <span className="text-vibe-cyan font-medium">0 MB / 5 GB</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-vibe-cyan to-vibe-purple w-0"></div>
          </div>
        </div>
      </div>

      <div className="p-5 bg-gradient-to-br from-white/5 to-transparent rounded-xl border border-white/10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <span className="text-emerald-400">⚡</span> Context7
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
              Motor RAG para documentación en vivo (React, Next.js, Tailwind, etc.).
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
        <div className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded inline-block">
          Estado: Conectado vía MCP
        </div>
      </div>
    </div>
  );
}
