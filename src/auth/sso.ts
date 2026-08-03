import type { UserProfile, Session } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";

// ─── Types ──────────────────────────────────────────────────────

export interface AuthResult {
  user: UserProfile;
  session: Session;
}

import { CORE_API_URL } from "@/lib/api-config";

const API_URL = CORE_API_URL;

// ─── Public API ─────────────────────────────────────────────────

export interface SSOOptions {
  /** Destination after the user clicks the magic link. Defaults to /app. */
  postAuthUrl?: string;
  /** Which service is requesting auth — controls email template and redirect fallback. */
  service?: "vibe-studio" | "opita-code";
}

/**
 * Inicia el flujo de autenticación mediante Magic Link en AWS.
 *
 * @param email   - Email del usuario
 * @param options - postAuthUrl: ruta de destino post-auth (default: /app)
 *                  service: identificador del servicio para el template de email
 */
export async function initiateSSO(email?: string, options?: SSOOptions): Promise<void> {
  if (!email || !email.includes("@")) {
    throw new Error("Email inválido");
  }

  // Use the explicit post-auth destination, NOT window.location.href.
  // window.location.href here would be the login page URL, causing a redirect loop.
  // When running inside Tauri, use the vibe-studio:// deep link scheme so the OS
  // routes the magic link back into the desktop app instead of the web browser.
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const postAuthUrl = isTauri
    ? "vibe-studio://auth"
    : (options?.postAuthUrl ?? `${window.location.origin}/app`);
  const service = options?.service ?? "vibe-studio";

  // OCAIS: /auth/request legacy fue decommissioned (410 Gone). El endpoint vivo
  // es /core/auth/request-ocais (magic link con token de un solo uso, 15 min TTL).
  const response = await fetch(`${API_URL}/auth/request-ocais`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      service,
      redirectTo: postAuthUrl,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo solicitar el enlace mágico");
  }
}

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return match[2];
  return null;
}

function removeSSOCookie(name: string) {
  const domain = window.location.hostname.includes('opitacode.com') ? 'domain=.opitacode.com;' : '';
  // Eliminar con y sin Secure: el flag Secure forma parte de la identidad de la
  // cookie, así que una cookie no-secure (dev local) NO se borra con un set Secure.
  document.cookie = `${name}=; ${domain} path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
  document.cookie = `${name}=; ${domain} path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    switch (payload.length % 4) {
      case 0: break;
      case 2: payload += '=='; break;
      case 3: payload += '='; break;
      default: return null;
    }
    const decoded = decodeURIComponent(atob(payload).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Placeholder para sesiones OCAIS: el JWT real (__opita_session) es HttpOnly
// y no es legible desde JS. Se usa credentials: "include" para que el backend
// lo lea. NUNCA se envía este placeholder como Bearer token (ver api-config.ts).
const SESSION_PLACEHOLDER = "__opita_session";

/**
 * Intenta restaurar una sesión usando el sistema OCAIS:
 *   1. GET /auth/me con credentials:include → el backend OCAIS lee la cookie
 *      HttpOnly __opita_session (RS256 JWT, 7d) y devuelve el perfil.
 *   2. Si 401 → intenta rotar la sesión vía POST /core/auth/refresh
 *      (usa la cookie opita_refresh_token, 30d) y reintenta /auth/me.
 *   3. Fallback legacy: cookie Cognito opita_id_token (compat 30 días).
 */
export async function restoreSession(): Promise<AuthResult | null> {
  try {
    // 1. Sesión OCAIS vía cookie (__opita_session HttpOnly)
    const ocaisUser = await fetchMe();
    if (ocaisUser) return ocaisUser;

    // 2. Intento de refresh: el JWT de 7d puede haber expirado pero el refresh
    //    token (30d) sigue vivo. Rotamos y reintentamos.
    const refreshed = await refreshSession();
    if (refreshed) return refreshed;

    // 3. Fallback legacy: Cognito (deprecado Phase 1D, compat transitoria)
    const legacy = await restoreLegacyCognito();
    if (legacy) return legacy;

    return null;
  } catch (err) {
    console.error("Failed to restore session via OCAIS", err);
    return null;
  }
}

/**
 * GET /auth/me con credentials:include. El backend OCAIS lee la cookie
 * HttpOnly __opita_session y devuelve el perfil del usuario.
 */
async function fetchMe(): Promise<AuthResult | null> {
  try {
    const meResponse = await fetch(`${API_URL}/auth/me`, {
      credentials: "include",
    });
    if (meResponse.ok) {
      const data = await meResponse.json();
      if (data.user?.email) {
        const user: UserProfile = {
          id: data.user.id ? `user-${data.user.id}` : `user-${data.user.email}`,
          email: data.user.email,
          name: data.user.name || data.user.email.split("@")[0] || "Usuario",
          plan: data.user.plan || "free",
          verified: data.user.verified !== false,
        };
        const session: Session = {
          token: SESSION_PLACEHOLDER, // HttpOnly — el JWT real vive en la cookie
          expiresAt: data.user.expiresAt || Date.now() + 7 * 24 * 3600000,
        };
        useAuthStore.getState().migrateFromGuest(user.email);
        return { user, session };
      }
    }
  } catch {
    // /auth/me failed — no authenticated session
  }
  return null;
}

/**
 * Rota la sesión vía POST /core/auth/refresh. El backend OCAIS lee la cookie
 * opita_refresh_token (30d), valida la fila en sessionStore, elimina la fila
 * antigua y minta un nuevo __opita_session (7d) + nuevo refresh token,
 * devolviéndolos como Set-Cookie. Tras el refresh, re-valida con /auth/me.
 *
 * @returns AuthResult si el refresh fue exitoso, null en caso contrario
 *          (refresh token expirado/inválido → se fuerza re-login).
 */
export async function refreshSession(): Promise<AuthResult | null> {
  try {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!refreshResponse.ok) {
      // 401: refresh token expirado/inválido — no hay sesión recuperable
      removeSSOCookie("opita_refresh_token");
      removeSSOCookie(SESSION_PLACEHOLDER);
      return null;
    }
    // Cookies rotadas en la respuesta — re-validar el perfil con el nuevo JWT
    return await fetchMe();
  } catch {
    return null;
  }
}

/**
 * Fallback legacy: sesión Cognito vía cookie opita_id_token (deprecada).
 * Se mantiene 30 días para compatibilidad con sesiones emitidas antes de
 * la migración a OCAIS.
 */
async function restoreLegacyCognito(): Promise<AuthResult | null> {
  const cognitoToken = getCookie("opita_id_token");
  if (!cognitoToken) return null;
  const claims = decodeJWT(cognitoToken);
  if (!claims || !claims.sub) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    removeSSOCookie("opita_id_token");
    return null; // Token expired — force re-login
  }
  const user: UserProfile = {
    id: `user-${claims.email}`,
    email: claims.email,
    name: claims.given_name || claims.name || claims.email.split("@")[0] || "Usuario",
    plan: claims["custom:plan"] || claims.plan || "free",
    verified: true,
  };
  const session: Session = {
    token: cognitoToken, // JWT legible — puede ir como Bearer (Cognito no es HttpOnly)
    expiresAt: claims.exp ? claims.exp * 1000 : Date.now() + 3600000,
  };
  useAuthStore.getState().migrateFromGuest(user.email);
  return { user, session };
}



/**
 * Cierra la sesión del usuario.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Local logout must always succeed
  }

  // Eliminar cookies OCAIS (sistema de sesión actual)
  removeSSOCookie('__opita_session');
  removeSSOCookie('opita_refresh_token');

  // Eliminar cookies compartidas de Cognito (legacy)
  removeSSOCookie('opita_id_token');
  removeSSOCookie('opita_access_token');
  removeSSOCookie('opita_refresh_token');

  // Eliminar cookie de sesión de Magic Link / Password backend (legacy)
  removeSSOCookie('opita_session');

  // Limpiar datos de sesión de localStorage (NO datos de trabajo como BYOK, sync, onboarding)
  const sessionKeys = ['auth-token', 'vibe-guest-email'];
  sessionKeys.forEach((key) => {
    try { localStorage.removeItem(key); } catch { /* SSR / restricted */ }
  });

  useAuthStore.getState().logout();
}

/**
 * Registra un nuevo usuario con email y contraseña.
 * Auto-autentica al usuario tras el registro exitoso.
 */
export async function registerWithPassword(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al registrar");
  }

  // Session cookie is set — restore to sync auth store
  const session = await restoreSession();
  if (!session) throw new Error("No se pudo iniciar sesión tras el registro");
  return session;
}

/**
 * Inicia sesión con email y contraseña.
 */
export async function loginWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al iniciar sesión");
  }

  // Session cookie is set — restore to sync auth store
  const session = await restoreSession();
  if (!session) throw new Error("No se pudo restaurar la sesión");
  return session;
}
