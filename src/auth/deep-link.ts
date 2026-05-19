import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useAuthStore } from "@/stores/auth";

const API_URL =
  import.meta.env.VITE_API_URL || "https://api.opitacode.com/core";

/**
 * Inicializa el listener de deep links para autenticación en Tauri.
 *
 * Intercepta URLs con esquema `vibe-studio://auth?session_token=<jwt>`,
 * valida el token contra `/auth/me` y autentica al usuario en el store.
 *
 * SOLO debe llamarse cuando `window.__TAURI_INTERNALS__` está presente.
 */
export async function initDeepLinkListener(): Promise<void> {
  await onOpenUrl(async (urls) => {
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        const token = parsed.searchParams.get("session_token");
        if (!token) continue;

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.warn("[deep-link] /auth/me returned non-ok status:", res.status);
          continue;
        }

        const { user } = await res.json();

        useAuthStore.getState().login(
          {
            id: `user-${user.email}`,
            email: user.email,
            name: user.email.split("@")[0] || "Usuario",
            plan: user.plan || "free",
            verified: true,
          },
          {
            token,
            expiresAt: Date.now() + 7 * 24 * 3600_000,
          }
        );

        console.info("[deep-link] Autenticado via magic link:", user.email);
      } catch (err) {
        console.warn("[deep-link] Error al procesar deep link:", err);
      }
    }
  });
}
