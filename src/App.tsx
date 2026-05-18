import { useState, useEffect, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBar } from "@/components/layout/StatusBar";
import { ActionBar } from "@/components/layout/ActionBar";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { OnboardingFlow } from "@/components/auth/OnboardingFlow";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { BugReportModal } from "@/components/layout/BugReportModal";
import { FileWatcher } from "@/components/editor/FileWatcher";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { WompiModal } from "@/components/usage/WompiModal";
import { useAuthStore } from "@/stores/auth";
import { useKeybindings } from "@/lib/useKeybindings";
import { AppLifecycle } from "./renderer/AppLifecycle";
import { SidebarSlot } from "./renderer/layouts/SidebarSlot";
import { EditorSlot } from "./renderer/layouts/EditorSlot";
import { StatusbarSlot } from "./renderer/layouts/StatusbarSlot";
import { useUIStore } from "@/stores/ui";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { ExplorerDock } from "@/components/layout/ExplorerDock";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { MissionPanel } from "@/components/gamification/MissionPanel";
import { LevelUpCeremony } from "@/components/gamification/LevelUpCeremony";
import { useGamificationStore } from "@/stores/gamification";
import { XPParticleSystem } from "@/components/gamification/XPParticleSystem";
import { analytics } from "@/lib/analytics";
import { useConsentStore } from "@/stores/consent";

function GlobalKeybindings() {
  useKeybindings();
  return null;
}

/**
 * Chat-first Workspace layout.
 *
 * Rules:
 * 1. Chat is ALWAYS visible — never hidden by sidebar toggles.
 * 2. `activeSidebar` controls explorer/search in the left panel — independent of chat.
 * 3. `chatFullscreen` hides the editor entirely → multi-chat focus mode.
 */
function Workspace() {
  const chatPosition = useUIStore((s) => s.chatPosition);
  const chatWidth = useUIStore((s) => s.chatWidth);
  const setChatWidth = useUIStore((s) => s.setChatWidth);
  const chatHistoryVisible = useUIStore((s) => s.chatHistoryVisible);
  const chatFullscreen = useUIStore((s) => s.chatFullscreen);

  // Chat-first: always render the chat panel
  const chatPanel = (
    <div
      className={`z-10 h-full ${chatFullscreen ? "flex-1 min-w-0" : "flex-shrink-0"}`}
      style={chatFullscreen ? undefined : { width: chatWidth }}
    >
      <SidebarSlot />
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden relative w-full h-full pb-16 md:pb-0">
      {/* 1. Activity bar (izquierda) — oculta en fullscreen */}
      {!chatFullscreen && <ActivityBar />}

      {/* 2. Explorer/Search panels (izquierda) — independiente del chat */}
      {!chatFullscreen && <ExplorerDock />}

      {/* 3. Chat History panel — visible con chat activo */}
      <AnimatePresence>
        {chatHistoryVisible && (
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

      {/* 4. Chat a la izquierda (si aplica) */}
      {chatPosition === "left" && (
        <>
          {chatPanel}
          {!chatFullscreen && (
            <ResizeHandle onResize={(delta) => setChatWidth(chatWidth + delta)} />
          )}
        </>
      )}

      {/* 5. Editor (centro) — oculto en fullscreen mode */}
      {!chatFullscreen && <EditorSlot />}

      {/* 6. Chat a la derecha (si aplica) */}
      {chatPosition === "right" && (
        <>
          {!chatFullscreen && (
            <ResizeHandle onResize={(delta) => setChatWidth(chatWidth - delta)} />
          )}
          {chatPanel}
        </>
      )}
    </div>
  );
}

export default function App() {
  const authMode = useAuthStore((s) => s.authMode);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const sessionDetected = useAuthStore((s) => s.sessionDetected);
  const detectSession = useAuthStore((s) => s.detectSession);
  const loginModalOpen = useAuthStore((s) => s.loginModalOpen);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);

  const pendingMilestone = useGamificationStore((s) => s.pendingMilestone);
  const dismissMilestone = useGamificationStore((s) => s.dismissMilestone);
  const initTracker = useGamificationStore((s) => s.initTracker);
  const destroyTracker = useGamificationStore((s) => s.destroyTracker);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    detectSession();
  }, [detectSession]);

  // Initialize mission tracker for auto-validated missions
  useEffect(() => {
    if (authMode === "authenticated") {
      initTracker();
      return () => destroyTracker();
    }
  }, [authMode, initTracker, destroyTracker]);

  // Initialize analytics tracker
  useEffect(() => {
    const richConsent = useConsentStore.getState().richConsent;
    analytics.init({ richConsent });
    analytics.track("session_start", {
      auth_mode: authMode,
      plan: useAuthStore.getState().user?.plan || "free",
    });

    // Sync consent changes to analytics
    const unsub = useConsentStore.subscribe((state) => {
      analytics.setRichConsent(state.richConsent);
    });

    return () => {
      unsub();
      analytics.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only check URL intents AFTER session detection has completed
    if (!sessionDetected) return;

    // Auto-open login modal if requested via URL intent
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "true" && authMode === "unauthenticated") {
      // Clear the login param
      params.delete("login");
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      
      // Redirect to Identity Hub
      window.location.href = `https://cuenta.opitacode.com/login?return_to=${encodeURIComponent(window.location.href)}`;
    }
  }, [sessionDetected, authMode, setLoginModalOpen]);

  if (isMobile) {
    // Authenticated mobile: full mobile layout
    if (authMode === "authenticated" || hasCompletedOnboarding) {
      return <MobileLayout />;
    }
    // Unauthenticated mobile: show onboarding (falls through to onboarding below)
  }

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
            onLogin={() => {
              window.location.href = `https://cuenta.opitacode.com/login?return_to=${encodeURIComponent(window.location.href)}`;
            }} 
          />
        </div>
        {loginModalOpen && (
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
      <AppLifecycle />
      <CommandPalette />
      
      <div className="flex h-full w-full flex-col text-slate-200 bg-obsidian-900">
        <FileWatcher />
        <ActionBar />

        <div className="flex flex-1 overflow-hidden relative w-full h-full">
          <Workspace />
        </div>

        {loginModalOpen && (
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
        <WompiModal />
        <MissionPanel />
        <XPParticleSystem />
        {pendingMilestone && (
          <LevelUpCeremony
            level={pendingMilestone.level}
            badge={pendingMilestone.badge}
            label={pendingMilestone.label}
            quotaBoost={pendingMilestone.quotaBoost}
            onDismiss={dismissMilestone}
          />
        )}
        {/* MobileNavBar is now inside MobileLayout for mobile viewports */}
        
        {/* We keep the legacy StatusBar and inject the new slot next to it for now */}
        <div className="flex flex-col">
          <StatusbarSlot />
          <StatusBar />
        </div>
      </div>
    </Suspense>
  );
}
