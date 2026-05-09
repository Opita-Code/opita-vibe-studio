import { watch } from "@tauri-apps/plugin-fs";
import { useProjectStore } from "@/stores/project";
import { loadProject } from "@/lib/fs";

// ─── State ──────────────────────────────────────────────────────

let stop: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let writingCount = 0;

const DEBOUNCE_MS = 300;

// ─── Suppression ────────────────────────────────────────────────

/**
 * Llama ANTES de que la app escriba un archivo, para evitar que
 * el watcher reaccione a cambios auto-iniciados.
 */
export function markWriting(): void {
  writingCount++;
}

/**
 * Llama DESPUÉS de que la app escribió un archivo.
 */
export function markWritten(): void {
  writingCount = Math.max(0, writingCount - 1);
}

/**
 * Verifica si el evento actual debe ser ignorado por ser
 * resultado de una operación de escritura de la propia app.
 */
function isSuppressed(): boolean {
  if (writingCount > 0) {
    writingCount = 0;
    return true;
  }
  return false;
}

// ─── Debounce ───────────────────────────────────────────────────

function debounce(fn: () => void, ms: number): () => void {
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      fn();
    }, ms);
  };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Detiene el watcher activo si existe.
 */
export function stopProjectWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (stop) {
    stop();
    stop = null;
  }
}

/**
 * Inicia el watcher de archivos para el proyecto actual.
 *
 * Lee `rootPath` del store. Monitorea cambios externos y:
 * - Recarga el árbol de archivos
 * - Actualiza tabs abiertos (re-lectura de contenido)
 *
 * Ignora cambios causados por escrituras propias de la app
 * usando el contador `writingCount`.
 */
export async function startProjectWatcher(): Promise<void> {
  const { rootPath } = useProjectStore.getState();
  if (!rootPath) return;

  // Detener watcher anterior si existe
  stopProjectWatcher();

  // Callback con debounce para cambios externos
  const handleChange = debounce(async () => {
    if (isSuppressed()) return;

    const state = useProjectStore.getState();
    if (!state.rootPath) return;

    // Recargar árbol de archivos
    try {
      const files = await loadProject(state.rootPath);
      useProjectStore.setState({ files });
    } catch (err) {
      console.warn("[Watcher] Error al recargar árbol de archivos:", err);
    }
  }, DEBOUNCE_MS);

  // Iniciar watcher de Tauri
  try {
    stop = await watch([rootPath], handleChange, { recursive: true });
  } catch (err) {
    console.warn("[Watcher] Error al iniciar watcher:", err);
    stop = null;
  }
}
