import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useProjectStore } from "@/stores/project";

/**
 * TEMPORARY: This component holds the business logic extracted from the legacy App.tsx.
 * In Phase 5, these will be ported to their respective Core Extensions (Billing, Sync, Auth).
 */
export function LegacyLogicManager() {
  const detectSession = useAuthStore((s) => s.detectSession);

  // ── Restaurar sesión al iniciar (no bloqueante) ──────────
  useEffect(() => {
    detectSession().then(() => {
      // Intent-based auth: auto-redirect to checkout if URL params exist and user is logged in
      const params = new URLSearchParams(window.location.search);
      if (params.get("intent") === "checkout") {
        const product = params.get("product") || "VIBE_PRO";
        const state = useAuthStore.getState();
        if (state.user) {
          const checkoutUrl = "https://cuentas.opitacode.com/checkout.html";
          const redirectUrl = window.location.origin + window.location.pathname + "?payment_success=true";
          window.location.href = `${checkoutUrl}?product=${product}&userId=${encodeURIComponent(state.user.email)}&redirect=${encodeURIComponent(redirectUrl)}`;
        }
      }
    });
    // Cargar las llaves BYOK guardadas a la memoria RAM (Registry)
    import("@/lib/byok-store").then(m => m.loadConfiguredProvidersToRegistry());
  }, [detectSession]);

  // ── Detectar redirección de pago Wompi ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") === "true") {
      window.history.replaceState({}, document.title, window.location.pathname);
      detectSession().then(() => {
        useProjectStore.setState({
          statusMessage: "¡Pago exitoso! Bienvenido a Vibe Pro."
        });
      });
    }
  }, [detectSession]);

  // ── Auto-reopen last project after zustand persist hydration ──
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

  // ── Auto-Sync Prudente ───────────────────────────────────────
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

  return null;
}
