import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

/**
 * Detects existing session on mount (Cognito cookie → legacy fallback).
 * If an intent=checkout URL param is present and user is authenticated,
 * auto-redirects to the external checkout flow.
 * Also loads BYOK keys into the provider registry.
 */
export function useSessionBoot() {
  const detectSession = useAuthStore((s) => s.detectSession);

  useEffect(() => {
    detectSession().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("intent") === "checkout") {
        const product = params.get("product") || "VIBE_PRO";
        const state = useAuthStore.getState();
        if (state.user) {
          const checkoutUrl = "https://cuenta.opitacode.com/checkout.html";
          const redirectUrl = window.location.origin + window.location.pathname + "?payment_success=true";
          window.location.href = `${checkoutUrl}?product=${product}&userId=${encodeURIComponent(state.user.email)}&redirect=${encodeURIComponent(redirectUrl)}`;
        }
      }
    });
    // Load saved BYOK keys into the in-memory provider registry
    import("@/lib/byok-store").then(m => m.loadConfiguredProvidersToRegistry());
  }, [detectSession]);
}
