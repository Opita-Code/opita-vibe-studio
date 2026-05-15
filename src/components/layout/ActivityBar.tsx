import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useGamificationStore } from "@/stores/gamification";
import vibeLogoUrl from "@/assets/vibe-logo.svg";
import { useState, useRef, useEffect } from "react";
import { XPBar } from "@/components/gamification/XPBar";

export function ActivityBar() {
  const { 
    activeSidebar, 
    setActiveSidebar, 
    activityBarVisible, 
    setSettingsVisible,
    settingsVisible,
    setBugReportVisible,
    chatFullscreen,
    toggleChatFullscreen,
  } = useUIStore();
  const { authMode, user, logout } = useAuthStore();
  const { missionPanelOpen, setMissionPanelOpen, missions, fetchProfile, profile } = useGamificationStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialize gamification on auth
  useEffect(() => {
    if (authMode === "authenticated") {
      fetchProfile();
    }
  }, [authMode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  if (!activityBarVisible) return null;

  return (
    <div 
      className="hidden md:flex w-12 h-full bg-obsidian-950 border-r border-white/5 flex-col items-center py-3 flex-shrink-0 z-50 select-none"
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

        {/* Vibe AI — Toggle Multi-Chat Focus */}
        <button
          onClick={toggleChatFullscreen}
          className={`w-full flex justify-center py-2 relative group transition-colors ${
            chatFullscreen ? "text-aura-purple" : "text-slate-500 hover:text-aura-purple/70"
          }`}
          title={chatFullscreen ? "Salir de modo enfoque (Ctrl+L)" : "Modo Enfoque Multi-Chat (Ctrl+L)"}
          aria-label={chatFullscreen ? "Salir de modo enfoque" : "Modo Enfoque Multi-Chat"}
          aria-pressed={chatFullscreen}
        >
          {chatFullscreen && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-aura-purple shadow-[0_0_8px_rgba(168,85,247,0.6)]" aria-hidden="true"></div>
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <path d="M8 10h.01"></path>
            <path d="M12 10h.01"></path>
            <path d="M16 10h.01"></path>
          </svg>
        </button>

        {/* Missions */}
        {authMode === "authenticated" && (
          <button
            onClick={() => setMissionPanelOpen(!missionPanelOpen)}
            className={`w-full flex justify-center py-2 relative group transition-colors ${
              missionPanelOpen ? "text-amber-400" : "text-slate-500 hover:text-amber-400/70"
            }`}
            title="Misiones Diarias"
            aria-label="Misiones Diarias"
            aria-pressed={missionPanelOpen}
          >
            {missionPanelOpen && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" aria-hidden="true"></div>
            )}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {/* Notification dot for incomplete missions */}
            {missions.filter(m => !m.completed).length > 0 && (
              <div className="absolute top-1.5 right-2.5 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.8)]" aria-hidden="true" />
            )}
          </button>
        )}
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

        {/* Landing / Precios */}
        <a
          href="/"
          className="w-full flex justify-center py-2 relative group transition-colors text-slate-500 hover:text-aura-cyan"
          title="Ir a la Landing — Planes y Precios"
          aria-label="Ir a la Landing"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </a>

        {/* XP Bar — only for authenticated users */}
        {authMode === "authenticated" && (
          <div className="w-full flex justify-center py-1">
            <XPBar />
          </div>
        )}

        {/* User Account */}
        <div className="w-full flex justify-center py-2 relative mb-2" ref={menuRef}>
          {authMode === "unauthenticated" ? (
            <button
              onClick={() => window.location.href = `https://cuenta.opitacode.com/login?return_to=${encodeURIComponent(window.location.href)}`}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all duration-200 border border-white/5 hover:border-white/10"
              title="Iniciar sesión"
              aria-label="Iniciar sesión"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  showProfileMenu 
                    ? "bg-aura-purple/40 border-aura-purple text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]" 
                    : "bg-aura-purple/20 border-aura-purple/30 text-aura-purple hover:bg-aura-purple/30 hover:text-white"
                }`}
                title="Perfil y Cuenta"
                aria-label="Perfil y Cuenta"
              >
                <span className="text-[12px] font-bold">
                  {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
                </span>
              </button>

              {/* Profile Popover Menu */}
              {showProfileMenu && (
                <div className="absolute left-14 bottom-0 w-64 bg-obsidian-900 border border-white/10 rounded-xl shadow-2xl p-4 z-50 flex flex-col gap-3 animate-fade-in-up origin-bottom-left">
                  {/* User Info Header */}
                  <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
                    <span className="text-sm font-medium text-white/90 truncate" title={user?.email}>{user?.email}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Plan:</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium tracking-wide ${
                        user?.plan === 'pro' || user?.plan === 'estudiante' 
                          ? 'bg-gradient-to-r from-aura-cyan to-aura-purple text-white' 
                          : 'bg-white/10 text-white/70'
                      }`}>
                        {user?.plan === 'pro' ? 'Vibe Pro' : user?.plan === 'estudiante' ? 'Estudiante' : 'Básico'}
                      </span>
                    </div>
                  </div>

                  {/* Gamification Stats */}
                  {profile && (
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-aura-cyan font-bold tabular-nums">Lv.{profile.level}</span>
                        <span className="text-white/30">•</span>
                        <span className="text-white/50 tabular-nums">{profile.totalXp.toLocaleString()} XP</span>
                      </div>
                      {profile.streakDays > 0 && (
                        <span className="text-amber-400/80 font-medium">🔥 {profile.streakDays}d</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <a
                      href="https://cuenta.opitacode.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-white hover:bg-white/5 px-2 py-2 rounded-lg transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      Gestionar cuenta
                    </a>
                    
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="flex items-center gap-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 px-2 py-2 rounded-lg transition-colors text-left"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
