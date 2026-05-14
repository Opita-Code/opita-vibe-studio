import { useUIStore } from "@/stores/ui";

export function MobileNavBar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const explorerVisible = useUIStore((s) => s.explorerVisible);
  const setExplorerVisible = useUIStore((s) => s.setExplorerVisible);
  const terminalVisible = useUIStore((s) => s.terminalVisible);
  const setTerminalVisible = useUIStore((s) => s.setTerminalVisible);

  // Helper to open chat on mobile. The chat is currently handled locally in App.tsx `mobileChatOpen`,
  // but we can expose a way to trigger it or move that state to UIStore.
  // Actually, UIStore might be better, or we pass an `onOpenChat` prop.
  // Wait, let's just use an event or move the state. Let's trigger a custom event for now if we don't want to touch App state.
  const handleOpenChat = () => {
    setExplorerVisible(false);
    window.dispatchEvent(new CustomEvent("vibe:open-mobile-chat"));
  };

  const switchToView = (view: "editor" | "preview") => {
    setActiveView(view);
    setTerminalVisible(false);
    setExplorerVisible(false);
    window.dispatchEvent(new CustomEvent("vibe:close-mobile-chat"));
  };

  const toggleExplorer = () => {
    setExplorerVisible(!explorerVisible);
    window.dispatchEvent(new CustomEvent("vibe:close-mobile-chat"));
  };

  const toggleTerminal = () => {
    setTerminalVisible(!terminalVisible);
    setExplorerVisible(false);
    window.dispatchEvent(new CustomEvent("vibe:close-mobile-chat"));
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-obsidian-900/80 backdrop-blur-3xl border-t border-white/5 z-[80] flex items-center justify-around px-2 pb-safe">
      <button
        onClick={() => switchToView("editor")}
        className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 ${
          activeView === "editor" && !explorerVisible && !terminalVisible ? "text-aura-cyan bg-aura-cyan/10" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <span className="text-[10px] font-medium tracking-wide">Editor</span>
      </button>

      <button
        onClick={() => switchToView("preview")}
        className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 ${
          activeView === "preview" && !explorerVisible && !terminalVisible ? "text-aura-cyan bg-aura-cyan/10" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[10px] font-medium tracking-wide">Preview</span>
      </button>

      <button
        onClick={toggleExplorer}
        className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 ${
          explorerVisible ? "text-aura-cyan bg-aura-cyan/10" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
        </svg>
        <span className="text-[10px] font-medium tracking-wide">Archivos</span>
      </button>

      <button
        onClick={toggleTerminal}
        className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 ${
          terminalVisible ? "text-aura-cyan bg-aura-cyan/10" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M4 17h16a2 2 0 002-2V9a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
        <span className="text-[10px] font-medium tracking-wide">Terminal</span>
      </button>

      <button
        onClick={handleOpenChat}
        className="flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 text-aura-purple hover:text-white hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
      >
        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
        <span className="text-[10px] font-medium tracking-wide">IA</span>
      </button>
    </div>
  );
}
