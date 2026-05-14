import { useState, useEffect, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBar } from "@/components/layout/StatusBar";
import { ActionBar } from "@/components/layout/ActionBar";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { OnboardingFlow } from "@/components/auth/OnboardingFlow";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { BugReportModal } from "@/components/layout/BugReportModal";
import { FileWatcher } from "@/components/editor/FileWatcher";
import { useAuthStore } from "@/stores/auth";
import { useKeybindings } from "@/lib/useKeybindings";
import { LegacyLogicManager } from "./renderer/LegacyLogicManager";
import { SidebarSlot } from "./renderer/layouts/SidebarSlot";
import { EditorSlot } from "./renderer/layouts/EditorSlot";
import { StatusbarSlot } from "./renderer/layouts/StatusbarSlot";
import { useUIStore } from "@/stores/ui";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { ExplorerDock } from "@/components/layout/ExplorerDock";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { CommandPalette } from "@/components/layout/CommandPalette";

function GlobalKeybindings() {
  useKeybindings();
  return null;
}

/**
 * Dumb Workspace that relies on Core Slots instead of hardcoded panels.
 */
function Workspace() {
  const activeSidebar = useUIStore((s) => s.activeSidebar);
  const chatPosition = useUIStore((s) => s.chatPosition);
  const chatWidth = useUIStore((s) => s.chatWidth);
  const setChatWidth = useUIStore((s) => s.setChatWidth);
  const chatHistoryVisible = useUIStore((s) => s.chatHistoryVisible);

  return (
    <div className="flex flex-1 overflow-hidden relative w-full h-full pb-16 md:pb-0">
      {/* 1. Barra de actividad (Izquierda) */}
      <ActivityBar onLogin={() => setLoginModalOpen(true)} />

      {/* 2. Primary Sidebar (Izquierda) */}
      <ExplorerDock />
      <AnimatePresence>
        {activeSidebar === "chat" && chatHistoryVisible && (
          <motion.div
            initial={{ opacity: 0, width: 0, marginLeft: -10 }}
            animate={{ opacity: 1, width: "auto", marginLeft: 0 }}
            exit={{ opacity: 0, width: 0, marginLeft: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-shrink-0 z-40 overflow-hidden"
          >
            <ChatHistoryPanel />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Si el chat está a la izquierda, renderizamos SidebarSlot aquí */}
      {activeSidebar === "chat" && chatPosition === "left" && (
        <>
          <div className="flex-shrink-0 z-10" style={{ width: chatWidth }}>
            <SidebarSlot />
          </div>
          <ResizeHandle onResize={(delta) => setChatWidth(chatWidth + delta)} />
        </>
      )}

      {/* 3. Área del Editor (Centro) */}
      <EditorSlot />

      {/* Si el chat está a la derecha, renderizamos SidebarSlot aquí */}
      {activeSidebar === "chat" && chatPosition === "right" && (
        <>
          <ResizeHandle onResize={(delta) => setChatWidth(chatWidth - delta)} />
          <div className="flex-shrink-0 z-10" style={{ width: chatWidth }}>
            <SidebarSlot />
          </div>
        </>
      )}
    </div>
  );
}

// Global modal state (hacky for now due to lifting it outside App scope to pass to ActivityBar)
let setLoginModalOpen: (open: boolean) => void = () => {};

export default function App() {
  const authMode = useAuthStore((s) => s.authMode);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const sessionDetected = useAuthStore((s) => s.sessionDetected);
  const detectSession = useAuthStore((s) => s.detectSession);
  const [loginModalOpenState, setLoginModalOpenState] = useState(false);
  setLoginModalOpen = setLoginModalOpenState;

  useEffect(() => {
    detectSession();
    
    // Auto-open login modal if requested via URL intent
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "true" && authMode === "unauthenticated") {
      setLoginModalOpenState(true);
    }
  }, [detectSession, authMode]);

  if (!sessionDetected) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-obsidian-900">
        <div className="w-8 h-8 rounded-full border-2 border-aura-cyan border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!hasCompletedOnboarding && authMode === "unauthenticated") {
    return (
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 relative">
          <OnboardingFlow 
            onEnterGuest={() => useAuthStore.getState().completeOnboarding()}
            onLogin={() => setLoginModalOpen(true)} 
          />
        </div>
        {loginModalOpenState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <LoginScreen 
              onClose={() => setLoginModalOpen(false)} 
              onAuthenticated={() => {
                useAuthStore.getState().completeOnboarding();
                setLoginModalOpen(false);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center bg-obsidian-900">
        <div className="w-8 h-8 rounded-full border-2 border-aura-cyan border-t-transparent animate-spin"></div>
      </div>
    }>
      <GlobalKeybindings />
      <LegacyLogicManager />
      <CommandPalette />
      
      <div className="flex h-full w-full flex-col text-slate-200 bg-obsidian-900">
        <FileWatcher />
        <ActionBar />

        <div className="flex flex-1 overflow-hidden relative w-full h-full">
          <Workspace />
        </div>

        {loginModalOpenState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <LoginScreen 
              onClose={() => setLoginModalOpen(false)} 
              onAuthenticated={() => {
                useAuthStore.getState().completeOnboarding();
                setLoginModalOpen(false);
              }}
            />
          </div>
        )}

        <SettingsPanel />
        <BugReportModal />
        <MobileNavBar />
        
        {/* We keep the legacy StatusBar and inject the new slot next to it for now */}
        <div className="flex flex-col">
          <StatusbarSlot />
          <StatusBar />
        </div>
      </div>
    </Suspense>
  );
}
