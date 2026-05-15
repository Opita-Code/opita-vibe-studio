import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useProjectStore } from "@/stores/project";

/**
 * Prudent auto-sync: syncs the project to cloud every 5 minutes
 * and when the user navigates away (visibility change to "hidden").
 * Only syncs if authenticated + has unsynced changes + not already syncing.
 */
export function useAutoSync() {
  useEffect(() => {
    const syncFn = () => {
      const state = useProjectStore.getState();
      const authMode = useAuthStore.getState().authMode;
      if (authMode === "authenticated" && state.hasUnsyncedChanges && !state.isSyncing) {
        state.syncProject();
      }
    };
    
    const intervalId = setInterval(syncFn, 5 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") syncFn();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
