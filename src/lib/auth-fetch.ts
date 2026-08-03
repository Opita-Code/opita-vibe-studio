// ─── Auth headers centralizados (OCAIS) ─────────────────────────
//
// Las sesiones OCAIS viven en la cookie HttpOnly __opita_session (RS256 JWT,
// 7d). El JWT NO es legible desde JS: el auth store guarda el placeholder
// "__opita_session" y el backend se autentica vía cookie (credentials: include).
//
// NUNCA enviar este placeholder como Bearer token — mandaría el literal
// "Authorization: Bearer __opita_session" al backend.
//
// NOTA: este módulo NO importa stores/auth de forma estática para evitar el
// ciclo api-config → stores/auth → api-config. El acceso al store es dinámico
// (import() en runtime) en getSessionToken/fetchWithAuth.

export const SESSION_PLACEHOLDER = "__opita_session";

/** Placeholder legacy de magic links (compat: aún puede vivir en stores viejos). */
const LEGACY_SESSION_PLACEHOLDER = "opita_session";

/**
 * True si el token es un placeholder (sesión vía cookie HttpOnly) y por tanto
 * NO debe enviarse como Bearer header.
 */
export function isSessionPlaceholder(token: string | undefined | null): boolean {
  return !token || token === SESSION_PLACEHOLDER || token === LEGACY_SESSION_PLACEHOLDER;
}

/**
 * Token de sesión actual desde el auth store (o null).
 * Import dinámico: evita ciclos con stores/auth (que importa api-config).
 */
export async function getSessionToken(): Promise<string | null> {
  const { useAuthStore } = await import("@/stores/auth");
  return useAuthStore.getState().session?.token ?? null;
}

/**
 * Construye los headers de autenticación para una llamada API:
 * - Sesión con JWT real legible → Authorization: Bearer <jwt>
 * - Sesión vía cookie HttpOnly (placeholder) → sin Bearer (el backend
 *   autentica con la cookie, credentials: "include")
 */
export function buildAuthHeaders(token: string | undefined | null): Record<string, string> {
  if (!isSessionPlaceholder(token)) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * fetch con autenticación centralizada:
 * - credentials: "include" SIEMPRE (cookies OCAIS HttpOnly cross-origin)
 * - Bearer header solo si hay un JWT real legible (no placeholder)
 * - Mantiene los headers del caller (Content-Type, etc.)
 *
 * Uso:
 *   const res = await fetchWithAuth(`${API_URL}/projects`, { method: "GET" });
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers ?? {});
  if (!isSessionPlaceholder(token)) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
