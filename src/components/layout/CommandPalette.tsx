import { useState, useEffect, useMemo, useRef } from "react";
import { useUIStore } from "@/stores/ui";
import { OMNI_ITEMS, filterOmniItems, OmniItem } from "@/lib/omnibar-providers";
import { motion, AnimatePresence } from "framer-motion";

// Icon mapping helper
function getIconForType(type: OmniItem["iconType"]) {
  switch (type) {
    case "command":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "file":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case "chat":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    case "settings":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "ai":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "bug":
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    default:
      return null;
  }
}

export function CommandPalette() {
  const { 
    omnibarOpen, 
    setOmnibarOpen, 
    omnibarQuery, 
    setOmnibarQuery,
    setBugReportVisible,
    setSettingsVisible
  } = useUIStore();
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (omnibarOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setOmnibarQuery(""); // Reset query on close
      setSelectedIndex(0);
    }
  }, [omnibarOpen, setOmnibarQuery]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Ctrl+P, Cmd+P, or Ctrl+K, Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setOmnibarOpen(!omnibarOpen);
      }
      
      if (e.key === "Escape" && omnibarOpen) {
        setOmnibarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [omnibarOpen, setOmnibarOpen]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    return filterOmniItems(omnibarQuery, OMNI_ITEMS);
  }, [omnibarQuery]);

  // Group items by category for rendering
  const groupedItems = useMemo(() => {
    const groups: Record<string, OmniItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Flattened items for keyboard navigation index
  const flattenedItems = useMemo(() => {
    const flat: OmniItem[] = [];
    Object.values(groupedItems).forEach(group => flat.push(...group));
    return flat;
  }, [groupedItems]);

  // Keyboard navigation within the modal
  useEffect(() => {
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (!omnibarOpen || flattenedItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % flattenedItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flattenedItems.length) % flattenedItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeAction(flattenedItems[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleModalKeyDown);
    return () => window.removeEventListener("keydown", handleModalKeyDown);
  }, [omnibarOpen, flattenedItems, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector('[data-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Execute Action
  const executeAction = async (item: OmniItem) => {
    setOmnibarOpen(false);
    
    switch (item.action) {
      case "REPORT_BUG":
        setBugReportVisible(true);
        break;
      case "OPEN_SETTINGS":
      case "OPEN_AI_SETTINGS":
        setSettingsVisible(true);
        break;
      case "NEW_FILE":
        window.dispatchEvent(new CustomEvent("vibe:create-file"));
        break;
      case "TOGGLE_MISSIONS": {
        const { setMissionPanelOpen, missionPanelOpen } = (await import("@/stores/gamification")).useGamificationStore.getState();
        setMissionPanelOpen(!missionPanelOpen);
        break;
      }
      case "TOGGLE_CHAT_FULLSCREEN": {
        const uiStore = (await import("@/stores/ui")).useUIStore.getState();
        uiStore.toggleChatFullscreen();
        break;
      }
      case "NEW_CHAT": {
        const chatStore = (await import("@/stores/chat")).useChatStore.getState();
        chatStore.createNewSession();
        break;
      }
      case "TOGGLE_EXPLORER": {
        const uiStore2 = (await import("@/stores/ui")).useUIStore.getState();
        uiStore2.setActiveSidebar(uiStore2.activeSidebar === "explorer" ? null : "explorer");
        break;
      }
      case "EXPORT_PROJECT": {
        // Export is handled via the export panel component
        const uiStore3 = (await import("@/stores/ui")).useUIStore.getState();
        uiStore3.setStatusMessage("Usa el panel de exportación para descargar tu proyecto.");
        break;
      }
      default:
        break;
    }
  };

  let globalIndex = 0; // To track index across categories

  return (
    <AnimatePresence>
      {omnibarOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-obsidian-950/40 backdrop-blur-sm" 
          onClick={() => setOmnibarOpen(false)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
            className="w-full max-w-2xl bg-[#0D0D12]/85 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Search Input Area */}
        <div className="flex items-center px-4 py-1 border-b border-white/5 bg-white/[0.02]">
          <svg className="w-6 h-6 text-aura-purple mr-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 py-4 outline-none text-xl font-light"
            placeholder="Busca comandos, archivos..."
            value={omnibarQuery}
            role="combobox"
            aria-label="Buscar comandos y archivos"
            aria-expanded={flattenedItems.length > 0}
            aria-controls="omnibar-results"
            aria-activedescendant={flattenedItems[selectedIndex] ? `omni-item-${flattenedItems[selectedIndex].id}` : undefined}
            autoComplete="off"
            onChange={(e) => {
              setOmnibarQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="flex gap-2">
            <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-slate-400 bg-white/5 border border-white/10 rounded">ESC</kbd>
          </div>
        </div>
        
        {/* Results Area */}
        <div ref={scrollRef} id="omnibar-results" role="listbox" aria-label="Resultados de búsqueda" className="max-h-[50vh] overflow-y-auto p-2 overscroll-contain">
          {flattenedItems.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500 flex flex-col items-center gap-3">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No encontramos nada para "{omnibarQuery}"</p>
              <button className="mt-2 text-sm text-aura-purple hover:text-aura-purple/80 hover:underline">
                Preguntarle a Vibe AI en su lugar →
              </button>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="mb-1">
                <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-[#0D0D12]/95 backdrop-blur-xl z-10 rounded-md">
                  {category}
                </div>
                {items.map((item) => {
                  const currentIndex = globalIndex++;
                  const isSelected = selectedIndex === currentIndex;
                  
                  return (
                    <button 
                      key={item.id}
                      id={`omni-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      onClick={() => executeAction(item)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left transition-all duration-75 mb-0.5 ${
                        isSelected ? "bg-white/10 shadow-sm" : "hover:bg-white/5"
                      }`}
                    >
                      <div className={`mr-3 p-1.5 rounded-lg ${isSelected ? "bg-white/10 text-white" : "bg-white/5 text-slate-400"}`}>
                        {getIconForType(item.iconType)}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <span className={`font-medium text-sm ${isSelected ? "text-white" : "text-slate-300"}`}>
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className={`text-[11px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-medium text-slate-400 mr-1">
                          Ejecutar ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/5 bg-[#0D0D12]/95 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">↑↓</kbd> Navegar</span>
            <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">↵</kbd> Seleccionar</span>
          </div>
          <div className="flex gap-2">
            <span>Tip: Usa <kbd className="bg-white/10 px-1 rounded text-aura-purple">@</kbd> para chats o <kbd className="bg-white/10 px-1 rounded text-aura-cyan">{'>'}</kbd> para comandos</span>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
