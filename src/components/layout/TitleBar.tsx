import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/platform";

export function TitleBar() {
  if (!isTauri()) return null;

  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-glass border-b border-glass flex items-center justify-between px-0 shrink-0 relative z-[100] select-none"
    >
      {/* Título, Menu Bar y drag region */}
      <div 
        data-tauri-drag-region 
        className="flex items-center gap-4 px-4 h-full flex-1 cursor-default"
      >
        <span className="text-xs font-medium text-neutral-400 pointer-events-none shrink-0">Vibe Studio</span>
        
        {/* Menu Bar (Archivo, Editar, etc) */}
        <div className="hidden md:flex items-center gap-1 h-full pt-1">
          {["Archivo", "Editar", "Selección", "Ver", "Ir", "Ejecutar", "Terminal", "Ayuda"].map((menu) => (
            <button
              key={menu}
              className="text-xs text-neutral-400 hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-colors"
            >
              {menu}
            </button>
          ))}
        </div>
      </div>

      {/* Controles estilo Mac (pero a la derecha y funcionales) */}
      <div className="flex items-center gap-2 pr-3 h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors flex items-center justify-center group"
          title="Minimizar"
        >
          <svg className="w-2 h-2 text-yellow-900 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M5 12h14"></path>
          </svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors flex items-center justify-center group"
          title="Maximizar"
        >
          <svg className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors flex items-center justify-center group"
          title="Cerrar"
        >
          <svg className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
