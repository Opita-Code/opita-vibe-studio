import { useUIStore } from "@/stores/ui";

export function BugReportModal() {
  const { bugReportVisible, setBugReportVisible } = useUIStore();

  if (!bugReportVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-sm transition-opacity"
        onClick={() => setBugReportVisible(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Reportar un Problema
          </h2>
          <button 
            onClick={() => setBugReportVisible(false)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 text-sm text-slate-300">
          <p>
            Vibe Studio está en fase de acceso anticipado. Tu feedback es vital para nosotros.
            ¿Encontraste un bug, algo no funciona bien o tienes una sugerencia?
          </p>
          
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <h3 className="font-medium text-white mb-2">Para una resolución rápida, incluye:</h3>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>Qué estabas intentando hacer.</li>
              <li>Qué sucedió en su lugar.</li>
              <li>Pasos para reproducirlo.</li>
            </ul>
          </div>

          <textarea 
            className="w-full h-32 bg-obsidian-950 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-aura-purple focus:ring-1 focus:ring-aura-purple transition-all resize-none mt-2"
            placeholder="Describe el problema aquí..."
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
          <button 
            onClick={() => setBugReportVisible(false)}
            className="px-4 py-2 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              // Placeholder for actual sending logic
              alert("Reporte enviado. ¡Gracias por tu feedback!");
              setBugReportVisible(false);
            }}
            className="px-4 py-2 bg-aura-purple hover:bg-aura-purple/90 text-white rounded-lg font-medium transition-colors shadow-lg shadow-aura-purple/20"
          >
            Enviar Reporte
          </button>
        </div>
      </div>
    </div>
  );
}
