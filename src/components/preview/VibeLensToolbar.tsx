import { useUIStore } from "@/stores/ui";

// ─── Props ──────────────────────────────────────────────────────

interface VibeLensToolbarProps {
  /** Called when the user requests a preview refresh */
  onRefresh: () => void;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Minimal toolbar rendered above each VibeLens preview panel.
 * Extracted from App.tsx (was duplicated in normal and fullscreen modes).
 */
export function VibeLensToolbar({ onRefresh }: VibeLensToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-obsidian-900/80 border-b border-white/5">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-aura-cyan animate-pulse" />
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">
          VibeLens
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
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
  );
}
