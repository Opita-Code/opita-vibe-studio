import { useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { getFileSystemBackend } from "@/lib/fs-backend";
import vibeLogoUrl from "@/assets/vibe-logo.svg";

export function WelcomeScreen() {
  const openProject = useProjectStore((s) => s.openProject);
  const { authMode } = useAuthStore();

  const handleOpenFolder = useCallback(async () => {
    try {
      const backend = getFileSystemBackend();
      if (!backend.isAvailable()) return;
      const path = await backend.selectDirectory();
      if (path) {
        await openProject(path);
        useUIStore.getState().setActiveSidebar("explorer");
        useUIStore.getState().setActiveView("editor");
      }
    } catch {
      // User cancelled or error
    }
  }, [openProject]);

  const handleAskAI = () => {
    useUIStore.getState().setActiveSidebar("chat");
    const input = document.querySelector('textarea[placeholder*="mensaje"]');
    if (input instanceof HTMLTextAreaElement) {
      input.focus();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-4 relative overflow-hidden bg-obsidian-950">
      <div className="flex flex-col items-center gap-6 opacity-40 hover:opacity-100 transition-opacity duration-500 select-none">
        <img src={vibeLogoUrl} alt="Vibe Studio" className="w-16 h-16 opacity-50 grayscale" />
        
        <div className="flex items-center gap-4 text-xs font-mono text-slate-500 uppercase tracking-widest">
          <button onClick={handleOpenFolder} className="hover:text-white transition-colors">Abrir Carpeta</button>
          <span className="opacity-30">•</span>
          <button onClick={handleAskAI} className="hover:text-aura-cyan transition-colors">Preguntar a IA</button>
          
          {authMode === "unauthenticated" && (
            <>
              <span className="opacity-30">•</span>
              <a 
                href="https://vibe.opitacode.com" 
                target="_blank" 
                rel="noreferrer" 
                className="hover:text-aura-purple transition-colors flex items-center gap-1"
              >
                Conoce Vibe Studio
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
