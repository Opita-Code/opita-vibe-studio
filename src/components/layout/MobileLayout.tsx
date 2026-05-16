import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { SidebarSlot } from "@/renderer/layouts/SidebarSlot";
import { EditorSlot } from "@/renderer/layouts/EditorSlot";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { BugReportModal } from "@/components/layout/BugReportModal";
import { WompiModal } from "@/components/usage/WompiModal";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { MissionPanel } from "@/components/gamification/MissionPanel";
import { LevelUpCeremony } from "@/components/gamification/LevelUpCeremony";
import { XPParticleSystem } from "@/components/gamification/XPParticleSystem";
import { useGamificationStore } from "@/stores/gamification";
import { FileWatcher } from "@/components/editor/FileWatcher";
import { AppLifecycle } from "@/renderer/AppLifecycle";
import { MobileHubView } from "./MobileHubView";
import { Sparkles, Code2, Eye, Target, Settings, Menu } from "lucide-react";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";

// ─── Types ──────────────────────────────────────────────────────
type MobileTab = "chat" | "code" | "preview" | "hub" | "settings";

interface TabDef {
  id: MobileTab;
  label: string;
  icon: React.ReactNode;
  requiresAuth?: boolean;
}

// ─── Tab Definitions ────────────────────────────────────────────
const TABS: TabDef[] = [
  { id: "chat",     label: "IA",      icon: <Sparkles className="w-5 h-5" /> },
  { id: "code",     label: "Code",    icon: <Code2 className="w-5 h-5" /> },
  { id: "preview",  label: "Vista",   icon: <Eye className="w-5 h-5" /> },
  { id: "hub",      label: "Hub",     icon: <Target className="w-5 h-5" />, requiresAuth: true },
  { id: "settings", label: "Más",     icon: <Settings className="w-5 h-5" /> },
];

// ─── Bottom Nav Component ───────────────────────────────────────
function MobileBottomNav({ 
  activeTab, 
  onTabChange,
  isGuest
}: { 
  activeTab: MobileTab; 
  onTabChange: (tab: MobileTab) => void;
  isGuest: boolean;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[80] bg-obsidian-950/80 backdrop-blur-3xl border-t border-white/[0.05] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around h-[68px] px-2 relative">
        {TABS.map((tab) => {
          if (tab.requiresAuth && isGuest) return null;
          
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center flex-1 h-full select-none"
              aria-label={`Ir a ${tab.label}`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-x-2 inset-y-2 bg-white/[0.04] rounded-2xl border border-white/[0.05]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              
              <div className="relative flex flex-col items-center justify-center z-10 transition-transform active:scale-95 duration-200">
                <motion.div 
                  className={`mb-1 transition-colors duration-300 ${isActive ? "text-aura-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-slate-500"}`}
                  animate={isActive ? { y: -2, scale: 1.05 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {tab.icon}
                </motion.div>
                
                <AnimatePresence>
                  {isActive && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="text-[10px] font-semibold tracking-wide text-aura-cyan absolute -bottom-3.5"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Mobile Header ──────────────────────────────────────────────
function MobileHeader({ activeTab }: { activeTab: MobileTab }) {
  const toggleChatHistory = useUIStore((s) => s.toggleChatHistory);
  const TITLES: Record<MobileTab, string> = {
    chat: "Vibe AI",
    code: "Editor",
    preview: "Vista previa",
    hub: "Hub",
    settings: "Configuración",
  };

  return (
    <div 
      className="h-[52px] bg-obsidian-950/80 backdrop-blur-3xl border-b border-white/[0.05] flex items-center justify-between px-3 shrink-0 select-none z-50 shadow-sm"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={toggleChatHistory}
          className="p-2 text-slate-400 hover:text-white transition-colors focus:outline-none"
          aria-label="Menú de historial"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-aura-cyan to-aura-purple flex items-center justify-center shadow-lg shadow-aura-purple/20">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-slate-200 to-slate-400">
          {TITLES[activeTab]}
        </span>
      </div>
    </div>
  );
}

// ─── Mobile Chat View ───────────────────────────────────────────
function MobileChatView() {
  return (
    <div className="flex flex-col h-full bg-obsidian-900/90">
      <SidebarSlot />
    </div>
  );
}

// ─── Mobile Code View (Phase 3 placeholder) ─────────────────────
function MobileCodeView() {
  return (
    <div className="flex flex-col h-full bg-obsidian-900/90">
      <EditorSlot />
    </div>
  );
}

// ─── Mobile Preview View ────────────────────────────────────────
function MobilePreviewView() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  // Force preview mode when this tab is active
  if (activeView !== "preview") {
    setActiveView("preview");
  }

  return (
    <div className="flex flex-col h-full bg-obsidian-900/90">
      <EditorSlot />
    </div>
  );
}

// ─── Main Mobile Layout ─────────────────────────────────────────
export function MobileLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");
  const authMode = useAuthStore((s) => s.authMode);
  const isGuest = authMode !== "authenticated";
  const pendingMilestone = useGamificationStore((s) => s.pendingMilestone);
  const dismissMilestone = useGamificationStore((s) => s.dismissMilestone);
  const setSettingsVisible = useUIStore((s) => s.setSettingsVisible);
  const chatHistoryVisible = useUIStore((s) => s.chatHistoryVisible);
  const toggleChatHistory = useUIStore((s) => s.toggleChatHistory);

  const handleTabChange = (tab: MobileTab) => {
    if (tab === "settings") {
      setSettingsVisible(true);
      return; // Don't switch tab, just open settings dialog
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col h-full w-full text-slate-200 bg-obsidian-900 overflow-hidden">
      <FileWatcher />
      <AppLifecycle />
      <CommandPalette />
      
      {/* Header */}
      <MobileHeader activeTab={activeTab} />

      {/* Active View — full height minus header and bottom nav */}
      <div className="flex-1 overflow-hidden" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        {activeTab === "chat" && <MobileChatView />}
        {activeTab === "code" && <MobileCodeView />}
        {activeTab === "preview" && <MobilePreviewView />}
        {activeTab === "hub" && <MobileHubView />}
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isGuest={isGuest}
      />

      {/* Swipe Drawer for Chat History */}
      <AnimatePresence>
        {chatHistoryVisible && (
          <div className="fixed inset-0 z-[100] flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleChatHistory}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative h-full z-10"
            >
              <ChatHistoryPanel />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals & Overlays — same as desktop */}
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
    </div>
  );
}
