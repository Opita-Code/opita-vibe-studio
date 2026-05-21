import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useLearningStore } from "@/stores/learning";
import { storageBackend, syncEngine } from "@/lib/memory";

export function useContextSync() {
  const authMode = useAuthStore((s) => s.authMode);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let active = true;
    let intervalId: NodeJS.Timeout | null = null;

    // Helper to hydrate the store from local storage backend
    const hydrateFromStorage = async () => {
      try {
        const eventsRaw = await storageBackend.get<string>("sync:events");
        const eventsEntry = eventsRaw ? (typeof eventsRaw === "string" ? JSON.parse(eventsRaw) : eventsRaw) : null;
        const events = eventsEntry && Array.isArray(eventsEntry.value) ? eventsEntry.value : [];

        const shownTipsRaw = await storageBackend.get<string>("sync:shownTips");
        const shownTipsEntry = shownTipsRaw ? (typeof shownTipsRaw === "string" ? JSON.parse(shownTipsRaw) : shownTipsRaw) : null;
        const shownTips = shownTipsEntry && Array.isArray(shownTipsEntry.value) ? shownTipsEntry.value : [];

        if (active) {
          useLearningStore.getState().hydrateLearningStore(events, shownTips);
        }
      } catch (err) {
        console.error("Error hydrating learning state from local storage:", err);
      }
    };

    if (authMode === "authenticated" && user?.id) {
      const userId = user.id;

      // 1. Initial sync (pull + push merge) on session start
      syncEngine.sync(userId)
        .then(async () => {
          if (active) {
            await hydrateFromStorage();
          }
        })
        .catch((err) => {
          console.warn("Initial context sync failed, trying local fallback hydration:", err);
          hydrateFromStorage();
        });

      // 2. Periodic sync every 5 minutes
      intervalId = setInterval(() => {
        syncEngine.sync(userId)
          .then(async () => {
            if (active) {
              await hydrateFromStorage();
            }
          })
          .catch((err) => {
            console.warn("Periodic context sync failed:", err);
          });
      }, 5 * 60 * 1000);

    } else if (authMode === "unauthenticated") {
      // 3. Clear local storage on logout for privacy/security
      storageBackend.clear()
        .then(() => {
          if (active) {
            useLearningStore.getState().hydrateLearningStore([], []);
          }
        })
        .catch((err) => {
          console.error("Error clearing local storage on logout:", err);
        });
    } else {
      // Guest/Initializing: hydrate from whatever is local
      hydrateFromStorage();
    }

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [authMode, user?.id]);
}
