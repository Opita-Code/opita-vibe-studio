import { useEffect } from "react";
import { useProjectStore } from "@/stores/project";

/**
 * After Zustand persist hydration, reloads workspaces that were saved
 * but have empty file trees (because the FS state isn't persisted).
 * If a workspace can't be reloaded (folder deleted), it's removed
 * and a status message is shown.
 */
export function useWorkspaceReopen() {
  useEffect(() => {
    let unsub: (() => void) | undefined;

    const tryAutoReopen = () => {
      const state = useProjectStore.getState();
      const workspacesToLoad = state.workspaces.filter(w => w.files.length === 0);
      if (workspacesToLoad.length === 0) return;

      workspacesToLoad.forEach(w => {
        state.reloadWorkspace(w.id).then(() => {
          const ws = useProjectStore.getState().workspaces.find(ws => ws.id === w.id);
          if (!ws || ws.files.length === 0) {
            state.removeWorkspace(w.id);
            useProjectStore.setState({ statusMessage: `Reconexión fallida para ${w.name}. Abre la carpeta nuevamente.` });
            return;
          }
          const { openTabs } = useProjectStore.getState();
          openTabs.forEach(tab => {
            state.openFile(tab).catch(() => state.closeTab(tab));
          });
        }).catch(() => {
          state.removeWorkspace(w.id);
          useProjectStore.setState({ statusMessage: `No se pudo abrir ${w.name}. La carpeta ya no existe.` });
        });
      });
    };

    if (useProjectStore.persist.hasHydrated()) {
      tryAutoReopen();
    } else {
      unsub = useProjectStore.persist.onFinishHydration(() => tryAutoReopen());
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);
}
