import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import vibeLogoUrl from "@/assets/vibe-logo.svg";

export function ActivityBar({ onLogin }: { onLogin?: () => void }) {
  const { 
    activeSidebar, 
    setActiveSidebar, 
    activityBarVisible, 
    setSettingsVisible,
    settingsVisible,
    setBugReportVisible
  } = useUIStore();
  const { authMode, user, logout } = useAuthStore();

  if (!activityBarVisible) return null;

  return (
    <div 
      className="hidden md:flex w-12 h-full bg-obsidian-950 border-r border-white/5 flex-col items-center py-3 flex-shrink-0 z-40 select-none"
      role="toolbar"
      aria-label="Barra de actividad principal"
    >
      {/* Top: Logo / Branding */}
      <div className="mb-6 mt-1 cursor-pointer group flex justify-center items-center" title="Vibe Studio">
        <img 
          src={vibeLogoUrl} 
          alt="Vibe Studio" 
          className="w-8 h-8 object-contain pointer-events-none drop-shadow-md group-hover:scale-110 transition-transform opacity-90 group-hover:opacity-100" 
        />
      </div>

      {/* Middle: Core Nav Icons */}
      <div className="flex flex-col gap-4 flex-1 w-full items-center mt-2" role="group" aria-label="Navegación principal">
        {/* Explorer */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === "explorer" ? null : "explorer")}
          className={`w-full flex justify-center py-2 relative group transition-colors ${
            activeSidebar === "explorer" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
          title="Explorador de Archivos (Ctrl+B)"
          aria-label="Explorador de Archivos"
          aria-pressed={activeSidebar === "explorer"}
        >
          {activeSidebar === "explorer" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-aura-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]" aria-hidden="true"></div>
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        {/* Search */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === "search" ? null : "search")}
          className={`w-full flex justify-center py-2 relative group transition-colors ${
            activeSidebar === "search" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
          title="Buscar en Archivos (Ctrl+Shift+F)"
          aria-label="Buscar en Archivos"
          aria-pressed={activeSidebar === "search"}
        >
          {activeSidebar === "search" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-aura-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]" aria-hidden="true"></div>
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* Vibe AI */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === "chat" ? null : "chat")}
          className={`w-full flex justify-center py-2 relative group transition-colors ${
            activeSidebar === "chat" ? "text-aura-purple" : "text-slate-500 hover:text-aura-purple/70"
          }`}
          title="Vibe AI Chat (Ctrl+L)"
          aria-label="Vibe AI Chat"
          aria-pressed={activeSidebar === "chat"}
        >
          {activeSidebar === "chat" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-aura-purple shadow-[0_0_8px_rgba(168,85,247,0.6)]" aria-hidden="true"></div>
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <path d="M8 10h.01"></path>
            <path d="M12 10h.01"></path>
            <path d="M16 10h.01"></path>
          </svg>
        </button>
      </div>

      {/* Bottom: Settings & User */}
      <div className="flex flex-col gap-4 w-full items-center" role="group" aria-label="Configuración y cuenta">
        {/* Bug Report */}
        <button
          onClick={() => setBugReportVisible(true)}
          className="w-full flex justify-center py-2 relative group transition-colors text-slate-500 hover:text-red-400"
          title="Reportar Bug o Feedback"
          aria-label="Reportar Bug o Feedback"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>

        {/* Settings */}
        <button
          onClick={() => setSettingsVisible(!settingsVisible)}
          className={`w-full flex justify-center py-2 relative group transition-colors ${
            settingsVisible ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
          title="Configuración (Ctrl+,)"
          aria-label="Configuración"
          aria-pressed={settingsVisible}
        >
          {settingsVisible && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-white/50" aria-hidden="true"></div>
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>

        {/* Landing / Precios (Solo Unauthenticated) */}
        {authMode === "unauthenticated" && (
          <a
            href="https://vibe.opitacode.com"
            target="_blank"
            rel="noreferrer"
            className="w-full flex justify-center py-2 relative group transition-colors text-slate-500 hover:text-aura-cyan"
            title="Conoce Vibe Studio y Planes"
            aria-label="Conoce Vibe Studio y Planes (abre en nueva pestaña)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </a>
        )}

        {/* User Account */}
        <div className="w-full flex justify-center py-2 relative mb-2">
          {authMode === "unauthenticated" ? (
            <button
              onClick={onLogin}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
              title="Iniciar sesión"
              aria-label="Iniciar sesión"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          ) : (
            <button
              onClick={logout}
              className="group w-8 h-8 rounded-full bg-aura-purple/20 border border-aura-purple/30 text-aura-purple hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 flex items-center justify-center transition-all"
              title={`${user?.email || "Usuario"} (Click para cerrar sesión)`}
              aria-label={`Cerrar sesión de ${user?.email || "Usuario"}`}
            >
              <span className="text-[12px] font-bold group-hover:hidden">
                {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
              </span>
              <svg className="w-4 h-4 hidden group-hover:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
