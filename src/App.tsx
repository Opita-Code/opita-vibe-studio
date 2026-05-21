import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBar } from "@/components/layout/StatusBar";
import { ActionBar } from "@/components/layout/ActionBar";
import { LoginScreen } from "@/components/auth/LoginScreen";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";

function GlobalKeybindings() {
  useKeybindings();
  return null;
}

// Lazy-load VibeLens preview for fullscreen mode — avoids loading Sandpack upfront
const FullscreenPreview = lazy(() =>
  import("@/components/preview/LivePreview").then((m) => ({ default: m.LivePreview }))
);

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
  const fullscreenPreviewVisible = useUIStore((s) => s.fullscreenPreviewVisible);
  const fullscreenSplitRatio = useUIStore((s) => s.fullscreenSplitRatio);
  const setFullscreenSplitRatio = useUIStore((s) => s.setFullscreenSplitRatio);

  // Preview version counter — for refresh
  const [previewVersion, setPreviewVersion] = useState(0);

  // Ref for computing resize deltas → ratio
  const containerRef = useRef<HTMLDivElement>(null);

  // Chat-first: always render the chat panel
  const chatPanel = (
    <motion.div
      layout
      className={`z-10 h-full ${chatFullscreen ? (fullscreenPreviewVisible ? "" : "flex-1 min-w-0") : "flex-shrink-0"}`}
      style={chatFullscreen ? (fullscreenPreviewVisible ? { width: `${fullscreenSplitRatio * 100}%` } : undefined) : { width: chatWidth }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <SidebarSlot />
    </motion.div>
  );

  // Shared animation variants for collapsible side panels
  const sidePanelVariants = {
    initial: { opacity: 0, width: 0, scale: 0.95 },
    animate: { opacity: 1, width: "auto", scale: 1 },
    exit: { opacity: 0, width: 0, scale: 0.95 },
  };
  const sidePanelTransition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden relative w-full h-full pb-16 md:pb-0">
      {/* 1. Activity bar (izquierda) — oculta en fullscreen */}
      <AnimatePresence>
        {!chatFullscreen && (
          <motion.div
            key="activity-bar"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={sidePanelTransition}
            className="shrink-0"
          >
            <ActivityBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Explorer/Search panels (izquierda) — independiente del chat */}
      <AnimatePresence>
        {!chatFullscreen && (
          <motion.div
            key="explorer-dock"
            variants={sidePanelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sidePanelTransition}
            className="shrink-0 overflow-hidden"
          >
            <ExplorerDock />
          </motion.div>
        )}
      </AnimatePresence>

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
          <AnimatePresence>
            {!chatFullscreen && (
              <motion.div
                key="resize-left"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ResizeHandle onResize={(delta) => setChatWidth(chatWidth + delta)} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* 5. Editor (centro) — oculto en fullscreen mode */}
      <AnimatePresence>
        {!chatFullscreen && (
          <motion.div
            key="editor-slot"
            className="flex-1 min-w-0 h-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <EditorSlot />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5b. VibeLens preview — en modo normal, entre editor y chat */}
      <AnimatePresence>
        {!chatFullscreen && fullscreenPreviewVisible && (
          <>
            <ResizeHandle onResize={(delta) => {
              const containerWidth = containerRef.current?.offsetWidth ?? window.innerWidth;
              if (containerWidth > 0) {
                setFullscreenSplitRatio(fullscreenSplitRatio + (chatPosition === "right" ? delta : -delta) / containerWidth);
              }
            }} />
            <motion.div
              key="normal-preview"
              className="flex flex-col h-full overflow-hidden border-l border-white/10"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 360 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }}
            >
              {/* Toolbar mínimo */}
              <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-obsidian-900/80 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-aura-cyan animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">
                    VibeLens
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewVersion((v) => v + 1)}
                    className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Recargar vista previa"
                    aria-label="Recargar vista previa"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => useUIStore.getState().toggleFullscreenPreview()}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                    title="Cerrar vista previa"
                    aria-label="Cerrar vista previa"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Preview iframe */}
              <div className="flex-1 overflow-hidden bg-obsidian-950">
                <Suspense fallback={
                  <div className="flex-1 flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                    <span className="animate-pulse">Cargando VibeLens...</span>
                  </div>
                }>
                  <FullscreenPreview version={previewVersion} />
                </Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 6. Chat a la derecha (si aplica) */}
      {chatPosition === "right" && (
        <>
          <AnimatePresence>
            {!chatFullscreen && (
              <motion.div
                key="resize-right"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ResizeHandle onResize={(delta) => setChatWidth(chatWidth - delta)} />
              </motion.div>
            )}
          </AnimatePresence>
          {chatPanel}
        </>
      )}

      {/* 7. Fullscreen preview — VibeLens al lado del chat en modo enfoque */}
      <AnimatePresence>
        {chatFullscreen && fullscreenPreviewVisible && (
          <>
            {/* Resize handle between chat and preview */}
            <ResizeHandle onResize={(delta) => {
              const containerWidth = containerRef.current?.offsetWidth ?? window.innerWidth;
              if (containerWidth > 0) {
                setFullscreenSplitRatio(fullscreenSplitRatio + delta / containerWidth);
              }
            }} />
            <motion.div
              key="fullscreen-preview"
              className="flex flex-col h-full overflow-hidden border-l border-white/10"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: `${(1 - fullscreenSplitRatio) * 100}%` }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] as const }}
            >
              {/* Toolbar mínimo */}
              <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-obsidian-900/80 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-aura-cyan animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">
                    VibeLens
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewVersion((v) => v + 1)}
                    className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Recargar vista previa"
                    aria-label="Recargar vista previa"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => useUIStore.getState().toggleFullscreenPreview()}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                    title="Cerrar vista previa"
                    aria-label="Cerrar vista previa"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Preview iframe */}
              <div className="flex-1 overflow-hidden bg-obsidian-950">
                <Suspense fallback={
                  <div className="flex-1 flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                    <span className="animate-pulse">Cargando VibeLens...</span>
                  </div>
                }>
                  <FullscreenPreview version={previewVersion} />
                </Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const authMode = useAuthStore((s) => s.authMode);
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
    return <MobileLayout />;
  }

  if (!sessionDetected) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-obsidian-900">
        <div className="w-8 h-8 rounded-full border-2 border-aura-cyan border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary name="App">
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
    </ErrorBoundary>
  );
}
