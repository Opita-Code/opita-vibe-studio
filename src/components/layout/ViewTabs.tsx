import { useState, useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import type { ActiveView } from "@/stores/ui";

// ─── Tab definition ────────────────────────────────────────────

interface TabItem {
  id: ActiveView;
  label: string;
  hint: string;
}

const TABS: TabItem[] = [
  { id: "editor", label: "Editor", hint: "Ctrl+2" },
  { id: "preview", label: "Vista Previa", hint: "Ctrl+1" },
];

// ─── Component ─────────────────────────────────────────────────

/**
 * Barra de pestañas para cambiar entre vista previa y editor.
 * Cada pestaña actualiza `activeView` en el store.
 */
export function ViewTabs() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isIndicatorVisible, setIsIndicatorVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const indicatorTimeoutRef = useRef<NodeJS.Timeout>();

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isHovered) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        setIsIndicatorVisible(true);
        if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
        indicatorTimeoutRef.current = setTimeout(() => {
          setIsIndicatorVisible(false);
        }, 5000); // 5.0s allows for ~5 bounces to ensure discoverability
      }, 2500);
    }
  }, [isHovered]);

  useEffect(() => {
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    };
  }, [resetTimeout]);

  const handleTabClick = useCallback(
    (id: TabItem["id"]) => {
      setActiveView(id);
      resetTimeout();
    },
    [setActiveView, resetTimeout],
  );

  const isActive = useCallback(
    (id: TabItem["id"]): boolean => {
      return activeView === id;
    },
    [activeView],
  );

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 z-[100] flex items-end justify-center pb-8 pointer-events-none">
      {/* Hit area that captures hover to reveal the buttons */}
      <div 
        className="absolute inset-0 pointer-events-auto"
        onMouseEnter={() => {
          setIsHovered(true);
          setIsVisible(true);
          setIsIndicatorVisible(false);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          resetTimeout();
        }}
        onMouseMove={() => {
          if (!isVisible) {
            setIsVisible(true);
            setIsIndicatorVisible(false);
          }
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
        }}
      />

      {/* Indicador de flecha hacia arriba cuando está oculto */}
      <div 
        className={`absolute bottom-3 flex items-center justify-center w-8 h-8 bg-obsidian-900/60 backdrop-blur-md border border-white/10 rounded-full text-slate-400 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg ${
          !isVisible && isIndicatorVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"
        }`}
      >
        <div className={!isVisible && isIndicatorVisible ? "animate-bounce" : ""}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </div>
      </div>

      <div role="tablist" aria-label="Cambiar entre Editor y Vista Previa" className={`relative flex items-center bg-obsidian-950/60 backdrop-blur-2xl rounded-full p-1.5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset] pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
      }`}>
        {TABS.map((tab) => {
          const active = isActive(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`group flex items-center justify-center px-6 py-2 text-xs font-semibold tracking-wide rounded-full transition-all duration-300 relative overflow-hidden ${
                active
                  ? "text-white bg-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.3)] ring-1 ring-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              role="tab"
              aria-selected={active}
              title={tab.hint || tab.label}
            >
              {active && (
                <div className="absolute inset-0 bg-gradient-to-r from-vibe-cyan/10 to-vibe-purple/10 opacity-50" aria-hidden="true" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.label}
                {tab.hint && (
                  <span className={`text-[10px] font-mono tracking-tighter px-1.5 py-0.5 rounded transition-colors ${
                    active ? "bg-black/30 text-slate-300" : "bg-black/20 text-slate-500 group-hover:text-slate-400"
                  }`}>
                    {tab.hint}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
