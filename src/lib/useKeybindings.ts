import { useEffect } from "react";
import { useLocation } from "wouter";
import { useChatStore } from "@/stores/chat";
import { useUIStore } from "@/stores/ui";

export function useKeybindings() {
  const [, setLocation] = useLocation();
  const createNewSession = useChatStore(s => s.createNewSession);
  const toggleTerminal = useUIStore(s => s.toggleTerminal);
  const toggleActionBar = useUIStore(s => s.toggleActionBar);
  const setActiveView = useUIStore(s => s.setActiveView);
  const explorerVisible = useUIStore(s => s.explorerVisible);
  const setExplorerVisible = useUIStore(s => s.setExplorerVisible);
  const settingsVisible = useUIStore(s => s.settingsVisible);
  const setSettingsVisible = useUIStore(s => s.setSettingsVisible);
  const activeSidebar = useUIStore(s => s.activeSidebar);
  const setActiveSidebar = useUIStore(s => s.setActiveSidebar);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (!e.ctrlKey || e.metaKey) {
        return;
      }

      switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            createNewSession();
            setLocation("/chat");
            break;
          case 'j':
            e.preventDefault();
            toggleTerminal();
            break;
          case 'h': // Ctrl+H toggle header/action bar
            e.preventDefault();
            toggleActionBar();
            break;
          case 'l': // Ctrl+L toggle Vibe AI Chat
            e.preventDefault();
            setActiveSidebar(activeSidebar === "chat" ? null : "chat");
            break;
          case '1':
            e.preventDefault();
            setActiveView("preview");
            break;
          case '2':
            e.preventDefault();
            setActiveView("editor");
            break;
          case 'b':
            e.preventDefault();
            setExplorerVisible(!explorerVisible);
            break;
          case ',':
            e.preventDefault();
            setSettingsVisible(!settingsVisible);
            break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNewSession, setLocation, toggleTerminal, toggleActionBar, setActiveView, explorerVisible, setExplorerVisible, settingsVisible, setSettingsVisible, activeSidebar, setActiveSidebar]);
}

