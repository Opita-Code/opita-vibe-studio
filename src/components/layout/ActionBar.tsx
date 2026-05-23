import { useState, useRef, useEffect } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { isSandboxWorkspace } from "@/lib/sandbox";
import { CloudSyncPanel } from "@/components/cloud/CloudSyncPanel";
import { ExportProjectButton } from "@/components/layout/ExportProjectButton";

/**
 * ActionBar — unified top bar.
 *
 * Merges the old ActionBar (branding + OmniBar + cloud) with StatusBar
 * (connection status, git branch, auth, tokens) into a single compact row.
 *
 * Layout: [connection · git] [OmniBar] [status · export · cloud · auth]
 */
export function ActionBar() {
  const { actionBarVisible, setOmnibarOpen, statusMessage } = useUIStore();
  const { isSyncing, hasUnsyncedChanges } = useProjectStore();
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ─── StatusBar state (merged) ─────────────────────────────
  const connectedProvider = useChatStore((s) => s.activeProvider);
  const activeModel = useChatStore((s) => s.activeModelId);
  const tokensRemaining = useUIStore((s) => s.tokensRemaining);

  const workspaces = useProjectStore((s) => s.workspaces);
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId);
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const isGitRepo = activeWs?.isGitRepo || false;
  const gitBranch = activeWs?.gitBranch || null;
  const isSandbox = isSandboxWorkspace(activeWorkspaceId);

  const authMode = useAuthStore((s) => s.authMode);
  const user = useAuthStore((s) => s.user);

  const isConnected = connectedProvider !== "";

  // Close panel on outside click
  useEffect(() => {
    if (!syncPanelOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSyncPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [syncPanelOpen]);

  if (!actionBarVisible) return null;

  return (
    <div className="h-8 bg-obsidian-950 border-b border-white/5 flex items-center justify-between px-3 shrink-0 select-none z-50">
      {/* ── Left: branding + connection + git ── */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
          Vibe Studio
        </span>

        <span className="text-white/10 shrink-0 hidden sm:inline">·</span>

        {/* Connection dot + provider */}
        <span className="flex items-center gap-1.5 shrink-0 hidden sm:flex">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-aura-cyan shadow-[0_0_5px_rgba(0,240,255,0.8)]" : "bg-slate-600"
            }`}
          />
          {isConnected ? (
            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
              {connectedProvider}
              {activeModel && (
                <span className="text-slate-500 hidden md:inline"> · {activeModel}</span>
              )}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 italic">Sin conexión</span>
          )}
        </span>

        {/* Git branch */}
        {isGitRepo && gitBranch && !isSandbox && (
          <>
            <span className="text-white/10 shrink-0 hidden md:inline">·</span>
            <span className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400 hidden md:flex">
              <span className="text-[9px]">⑂</span>
              {gitBranch}
            </span>
          </>
        )}

        {/* Sandbox indicator */}
        {isSandbox && (
          <>
            <span className="text-white/10 shrink-0 hidden sm:inline">·</span>
            <span className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500/90 border border-yellow-500/20 text-[9px] uppercase font-bold tracking-wider hidden sm:flex">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              </svg>
              Sandbox
            </span>
          </>
        )}
      </div>

      {/* ── Center: OmniBar trigger ── */}
      <div className="flex items-center justify-center flex-1 mx-4">
        <button 
          onClick={() => setOmnibarOpen(true)}
          className="flex items-center gap-2 px-32 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors text-xs" 
          title="Abrir OmniBar (Ctrl+P / Cmd+K)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Buscar comandos, archivos, chats...
        </button>
      </div>

      {/* ── Right: status + export + cloud + auth ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Status message */}
        {statusMessage && (
          <span className="text-[10px] text-slate-500 animate-pulse hidden sm:inline">
            {statusMessage}
          </span>
        )}

        {/* Tokens remaining */}
        {tokensRemaining > 0 && (
          <span className="text-[10px] text-slate-500 hidden md:inline">
            {tokensRemaining.toLocaleString()} tkn
          </span>
        )}

        {/* Export project */}
        <ExportProjectButton />

        {/* Cloud Sync Button */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setSyncPanelOpen(!syncPanelOpen)}
            className={`relative p-1.5 rounded-md transition-colors ${
              syncPanelOpen ? "bg-white/10 text-aura-cyan" : "text-slate-500 hover:text-slate-300 hover:bg-white/10"
            }`}
            title="Respaldo en la nube"
            aria-label="Abrir panel de respaldo en la nube"
          >
            {isSyncing ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
            )}
            {/* Unsynced changes dot */}
            {hasUnsyncedChanges && !isSyncing && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400 border border-obsidian-950" />
            )}
          </button>

          {syncPanelOpen && <CloudSyncPanel onClose={() => setSyncPanelOpen(false)} />}
        </div>

        {/* Auth badge */}
        <span className="text-white/10 shrink-0 hidden sm:inline">·</span>
        {authMode === "unauthenticated" ? (
          <span className="flex items-center gap-1 shrink-0" data-testid="auth-status">
            <span className="text-[10px] text-slate-500 italic hidden sm:inline">Invitado</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 shrink-0" data-testid="auth-status">
            <span className="text-[10px] text-slate-300 truncate max-w-[100px] hidden sm:inline">{user?.email}</span>
            <span className="text-[9px] text-aura-cyan/70 uppercase font-bold tracking-wider">
              {user?.plan ?? "free"}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
