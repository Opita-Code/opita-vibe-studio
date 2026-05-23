import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useChatStore } from "@/stores/chat";
import { useAgentHandler } from "@/agent/useAgentHandler";
import { HelpCircle, Sparkles, ShieldAlert, CheckSquare } from "lucide-react";

export function EditorToolbar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const activeSidebar = useUIStore((s) => s.activeSidebar);
  const setActiveSidebar = useUIStore((s) => s.setActiveSidebar);
  const activeTab = useProjectStore((s) => s.activeTab);
  const { send } = useAgentHandler();

  const handleQuickAction = (actionPrompt: string) => {
    if (!activeTab) return;

    // 1. Asegurar que el panel de chat en el sidebar esté abierto
    if (activeSidebar !== "chat") {
      setActiveSidebar("chat");
    }

    // 2. Activar compartir contexto del archivo activo
    useChatStore.getState().setShareActiveFileContext(true);

    // 3. Enviar prompt
    send(actionPrompt);
  };

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

      {/* AI Quick Actions */}
      <button
        onClick={() => handleQuickAction("Explica detalladamente la estructura y lógica de este código.")}
        disabled={!activeTab}
        className={`p-1.5 rounded-md transition-colors ${
          !activeTab 
            ? "opacity-35 cursor-not-allowed text-slate-500" 
            : "text-slate-500 hover:text-aura-purple hover:bg-aura-purple/10 cursor-pointer"
        }`}
        title="Explicar Código con IA"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleQuickAction("Optimiza este código analizando complejidad y rendimiento.")}
        disabled={!activeTab}
        className={`p-1.5 rounded-md transition-colors ${
          !activeTab 
            ? "opacity-35 cursor-not-allowed text-slate-500" 
            : "text-slate-500 hover:text-aura-purple hover:bg-aura-purple/10 cursor-pointer"
        }`}
        title="Optimizar Rendimiento"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleQuickAction("Encuentra y corrige bugs o malas prácticas en este código.")}
        disabled={!activeTab}
        className={`p-1.5 rounded-md transition-colors ${
          !activeTab 
            ? "opacity-35 cursor-not-allowed text-slate-500" 
            : "text-slate-500 hover:text-aura-purple hover:bg-aura-purple/10 cursor-pointer"
        }`}
        title="Buscar y Corregir Errores"
      >
        <ShieldAlert className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleQuickAction("Escribe pruebas unitarias completas para este código usando vitest.")}
        disabled={!activeTab}
        className={`p-1.5 rounded-md transition-colors ${
          !activeTab 
            ? "opacity-35 cursor-not-allowed text-slate-500" 
            : "text-slate-500 hover:text-aura-purple hover:bg-aura-purple/10 cursor-pointer"
        }`}
        title="Generar Pruebas Unitarias"
      >
        <CheckSquare className="w-4 h-4" />
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
