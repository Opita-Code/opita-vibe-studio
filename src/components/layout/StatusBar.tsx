import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";

/**
 * Barra de estado inferior.
 * Muestra: estado de conexión, modelo activo, tokens restantes, rama git.
 */
export function StatusBar() {
  const connectedProvider = useUIStore((s) => s.connectedProvider);
  const activeModel = useUIStore((s) => s.activeModel);
  const tokensRemaining = useUIStore((s) => s.tokensRemaining);
  const statusMessage = useUIStore((s) => s.statusMessage);

  const isGitRepo = useProjectStore((s) => s.isGitRepo);
  const gitBranch = useProjectStore((s) => s.gitBranch);

  return (
    <footer className="flex items-center justify-between h-6 px-3 bg-[var(--vibe-indigo)] text-[#ffffff] text-xs shrink-0 select-none">
      {/* Mensaje de estado + git branch */}
      <div className="flex items-center gap-3 truncate">
        <span className="truncate">{statusMessage}</span>

        {/* Rama git */}
        {isGitRepo && gitBranch && (
          <span className="flex items-center gap-1 shrink-0 text-[#e0e0e0]">
            <span className="text-[10px]">⑂</span>
            {gitBranch}
          </span>
        )}
      </div>

      {/* Indicadores de la derecha */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Proveedor conectado */}
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0]" />
          {connectedProvider}
        </span>

        {/* Modelo activo */}
        <span>{activeModel}</span>

        {/* Tokens restantes */}
        {tokensRemaining > 0 && (
          <span className="text-[#d4d4d4]">
            {tokensRemaining.toLocaleString()} tokens
          </span>
        )}
      </div>
    </footer>
  );
}
