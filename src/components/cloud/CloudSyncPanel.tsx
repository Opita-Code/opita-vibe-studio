/**
 * CloudSyncPanel — Backup & Restore UI for Vibe Studio.
 *
 * Provides manual backup/restore controls, auto-backup toggle,
 * and sync status visibility. Requires authentication.
 */

import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { Cloud, CloudOff, Download, Upload, RefreshCw, Shield } from "lucide-react";

interface CloudSyncPanelProps {
  onClose?: () => void;
}

export function CloudSyncPanel({ onClose }: CloudSyncPanelProps) {
  const authMode = useAuthStore((s) => s.authMode);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  
  const isSyncing = useProjectStore((s) => s.isSyncing);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const hasUnsyncedChanges = useProjectStore((s) => s.hasUnsyncedChanges);
  const autoBackupEnabled = useProjectStore((s) => s.autoBackupEnabled);
  const syncError = useProjectStore((s) => s.syncError);
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId);
  const syncProject = useProjectStore((s) => s.syncProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const setAutoBackup = useProjectStore((s) => s.setAutoBackup);

  const isAuthenticated = authMode === "authenticated";
  const hasProject = !!activeWorkspaceId;

  const formatLastSync = (date: Date | null): string => {
    if (!date) return "Nunca";
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return "Hace un momento";
    if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`;
    return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-obsidian-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-aura-cyan" />
          <span className="text-sm font-semibold text-slate-200">Respaldo en la Nube</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white rounded transition-colors"
            aria-label="Cerrar panel de sincronización"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Auth Guard */}
        {!isAuthenticated ? (
          <div className="flex flex-col items-center text-center py-4 space-y-3">
            <CloudOff className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-slate-400">
              Inicia sesión para respaldar tu proyecto en la nube.
            </p>
            <button
              onClick={() => { setLoginModalOpen(true); onClose?.(); }}
              className="px-4 py-2 text-xs font-semibold text-white bg-aura-purple/20 border border-aura-purple/30 rounded-lg hover:bg-aura-purple/30 transition-all"
            >
              Iniciar Sesión
            </button>
          </div>
        ) : !hasProject ? (
          <div className="flex flex-col items-center text-center py-4 space-y-2">
            <p className="text-sm text-slate-500">No hay un proyecto abierto.</p>
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  isSyncing ? "bg-amber-400 animate-pulse" :
                  hasUnsyncedChanges ? "bg-orange-400" :
                  "bg-emerald-400"
                }`} />
                <span className="text-xs text-slate-400">
                  {isSyncing ? "Sincronizando..." :
                   hasUnsyncedChanges ? "Cambios sin respaldar" :
                   "Todo respaldado"}
                </span>
              </div>
              <span className="text-[10px] text-slate-600 font-mono">
                {formatLastSync(lastSyncedAt)}
              </span>
            </div>

            {/* Error */}
            {syncError && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-[11px] text-red-400">{syncError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => syncProject()}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-200 bg-white/5 border border-white/10 rounded-xl hover:bg-aura-cyan/10 hover:border-aura-cyan/30 hover:text-aura-cyan disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Respaldar
              </button>

              <button
                onClick={() => restoreProject()}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-200 bg-white/5 border border-white/10 rounded-xl hover:bg-aura-purple/10 hover:border-aura-purple/30 hover:text-aura-purple disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Restaurar
              </button>
            </div>

            {/* Auto-backup toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">Auto-respaldo al guardar</span>
              </div>
              <button
                onClick={() => setAutoBackup(!autoBackupEnabled)}
                aria-label={autoBackupEnabled ? "Desactivar auto-respaldo" : "Activar auto-respaldo"}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  autoBackupEnabled ? "bg-aura-cyan/30" : "bg-white/10"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform shadow-sm ${
                  autoBackupEnabled ? "translate-x-4 bg-aura-cyan" : "translate-x-0 bg-slate-500"
                }`} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
