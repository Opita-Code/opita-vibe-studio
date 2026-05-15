import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useProjectStore } from "@/stores/project";

/**
 * Detects Wompi payment_success query param after redirect.
 * Cleans the URL, re-detects the session (plan may have changed),
 * and shows a success message in the status bar.
 */
export function usePaymentRedirect() {
  const detectSession = useAuthStore((s) => s.detectSession);

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
}
