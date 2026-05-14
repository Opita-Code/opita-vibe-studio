import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";

export function SubagentPanel() {
  const useSubagent = useChatStore((s) => s.useSubagent);
  const setUseSubagent = useChatStore((s) => s.setUseSubagent);
  const subagentInstructions = useChatStore((s) => s.subagentInstructions);
  const setSubagentInstructions = useChatStore((s) => s.setSubagentInstructions);
  const plan = useAuthStore((s) => s.plan);

  if (plan !== "pro") {
    return (
      <div className="p-4 bg-glass rounded-xl border border-glass flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-vibe-surface border border-vibe-cyan/20 flex items-center justify-center text-vibe-cyan text-xl">
          🚀
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Vibe Pro Engine</h3>
          <p className="text-xs text-slate-400 max-w-[250px]">
            El subagente autónomo está reservado para usuarios Pro. Haz upgrade para desbloquear el modo de ejecución desatendida en la nube.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-glass rounded-xl border border-glass">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-200">Motor Vibe Pro (AWS)</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={useSubagent}
              onChange={(e) => setUseSubagent(e.target.checked)}
            />
            <div className="w-9 h-5 bg-vibe-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-vibe-cyan"></div>
          </label>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Si activas el motor, Vibe Studio delegará las peticiones de código al subagente en la nube para procesamiento autónomo usando AWS. Si lo desactivas, usará el pipeline en local (3 fases).
        </p>

        <div className={`transition-all duration-300 ${useSubagent ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h4 className="text-xs font-semibold text-slate-300 mb-2">Instrucciones Personalizadas</h4>
          <textarea
            value={subagentInstructions}
            onChange={(e) => setSubagentInstructions(e.target.value)}
            placeholder="Ej: Usa siempre TailwindCSS. Los componentes deben ser funcionales..."
            className="w-full h-32 p-3 bg-vibe-bg border border-glass rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-vibe-cyan/50 resize-none transition-colors"
          />
          <p className="text-[10px] text-slate-500 mt-2">
            Estas instrucciones se inyectarán en el System Prompt del Subagente.
          </p>
        </div>
      </div>
    </div>
  );
}
