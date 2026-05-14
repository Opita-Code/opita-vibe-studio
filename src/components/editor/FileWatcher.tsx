import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import { startProjectWatcher, stopProjectWatcher } from "@/lib/file-watcher";

/**
 * Componente invisible que maneja el ciclo de vida del watcher de archivos.
 *
 * Se monta en App.tsx y:
 * - Inicia el watcher cuando se abre un proyecto
 * - Reinicia el watcher si cambia la ruta del proyecto
 * - Detiene el watcher cuando se cierra la app o no hay proyecto
 */
export function FileWatcher() {
  const workspaces = useProjectStore((s) => s.workspaces);
  const watchHash = workspaces.map(w => w.path).join("|");
  const prevHashRef = useRef<string | null>(watchHash);

  useEffect(() => {
    // Iniciar si hay proyectos abiertos
    if (workspaces.length > 0) {
      startProjectWatcher();
    } else {
      // Sin proyectos — detener watcher
      stopProjectWatcher();
    }

    return () => {
      // Cleanup al desmontar
      stopProjectWatcher();
    };
  }, [watchHash]); // Depends on the hash of paths

  // Detectar cambio de rutas de proyectos (add/remove workspace)
  useEffect(() => {
    if (prevHashRef.current !== watchHash) {
      prevHashRef.current = watchHash;
      if (workspaces.length > 0) {
        startProjectWatcher();
      }
    }
  }, [watchHash, workspaces.length]);

  return null; // Componente invisible
}
