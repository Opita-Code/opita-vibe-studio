import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";

/**
 * Barra de estado inferior.
 *
 * Izquierda: estado de conexión (proveedor + modelo), mensaje de estado, rama git.
 * Derecha: autenticación (invitado o email + plan), tokens restantes.
 *
 * Muestra claramente "Sin conexión" cuando no hay proveedor/configuración activa.
 */
export function StatusBar() {
  const connectedProvider = useUIStore((s) => s.connectedProvider);
  const activeModel = useUIStore((s) => s.activeModel);
  const tokensRemaining = useUIStore((s) => s.tokensRemaining);
  const statusMessage = useUIStore((s) => s.statusMessage);

  const workspaces = useProjectStore((s) => s.workspaces);
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId);
  
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const isGitRepo = activeWs?.isGitRepo || false;
  const gitBranch = activeWs?.gitBranch || null;

  const authMode = useAuthStore((s) => s.authMode);
  const user = useAuthStore((s) => s.user);


  const isConnected = connectedProvider !== "";

  return (
    <footer className="flex items-center justify-between h-6 px-3 bg-glass border-t border-glass text-slate-300 text-[11px] shrink-0 select-none">
      {/* ── Izquierda: conexión + estado + git ──────────────── */}
      <div className="flex items-center gap-3 truncate min-w-0">
        {/* Indicador de conexión */}
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-vibe-cyan shadow-[0_0_5px_rgba(0,240,255,0.8)]" : "bg-slate-600"
            }`}
          />
          {isConnected ? (
            <span className="truncate">
              {connectedProvider}
              {activeModel && (
                <span className="text-slate-400 hidden sm:inline"> — {activeModel}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-500 italic">Sin conexión</span>
          )}
        </span>

        {/* Separador sutil */}
        <span className="text-slate-600 shrink-0 hidden sm:inline">|</span>

        {/* Mensaje de estado */}
        <span className="truncate hidden sm:inline">{statusMessage}</span>

        {/* Rama git */}
        {isGitRepo && gitBranch && (
          <span className="flex items-center gap-1 shrink-0 text-slate-400">
            <span className="text-[10px]">⑂</span>
            <span className="hidden sm:inline">{gitBranch}</span>
          </span>
        )}
      </div>

      {/* ── Derecha: auth + tokens ──────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {authMode === "unauthenticated" ? (
          <span className="flex items-center gap-2" data-testid="auth-status">
            <span className="text-slate-500 italic">Sin sesión iniciada</span>
          </span>
        ) : (
          <span className="flex items-center gap-2" data-testid="auth-status">
            <span>{user?.email}</span>
            <span className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">
              {user?.plan ?? "free"}
            </span>
          </span>
        )}

        {tokensRemaining > 0 && (
          <span className="text-slate-400">
            {tokensRemaining.toLocaleString()} tokens
          </span>
        )}
      </div>
    </footer>
  );
}
