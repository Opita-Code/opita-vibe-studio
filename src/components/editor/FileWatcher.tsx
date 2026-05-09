import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import {
  startProjectWatcher,
  stopProjectWatcher,
} from "@/lib/file-watcher";

/**
 * Componente invisible que maneja el ciclo de vida del watcher de archivos.
 *
 * Se monta en App.tsx y:
 * - Inicia el watcher cuando se abre un proyecto
 * - Reinicia el watcher si cambia la ruta del proyecto
 * - Detiene el watcher cuando se cierra la app o no hay proyecto
 */
export function FileWatcher() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const prevPathRef = useRef<string | null>(rootPath);

  useEffect(() => {
    // Iniciar si hay proyecto abierto
    if (rootPath) {
      startProjectWatcher();
    } else {
      // Sin proyecto — detener watcher
      stopProjectWatcher();
    }

    return () => {
      // Cleanup al desmontar
      stopProjectWatcher();
    };
  }, [rootPath]);

  // Detectar cambio de ruta de proyecto
  useEffect(() => {
    if (prevPathRef.current !== rootPath) {
      prevPathRef.current = rootPath;
      if (rootPath) {
        startProjectWatcher();
      }
    }
  }, [rootPath]);

  return null; // Componente invisible
}
