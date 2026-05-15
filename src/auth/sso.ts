import type { UserProfile, Session } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";

// ─── Types ──────────────────────────────────────────────────────

export interface AuthResult {
  user: UserProfile;
  session: Session;
}

const API_URL = import.meta.env.VITE_API_URL || "https://api.opitacode.com";

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
  const postAuthUrl = options?.postAuthUrl ?? `${window.location.origin}/app`;
  const service = options?.service ?? "vibe-studio";

  const response = await fetch(`${API_URL}/auth/request`, {
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

/**
 * Intenta restaurar una sesión leyendo la cookie de Cognito
 * o cayendo hacia el backend de AWS antiguo.
 */
export async function restoreSession(): Promise<AuthResult | null> {
  try {
    // 1. Intentar con Cognito Cookie primero
    const cognitoToken = getCookie("opita_id_token");
    if (cognitoToken) {
      const claims = decodeJWT(cognitoToken);
      if (claims && claims.sub) {
        const user: UserProfile = {
          id: `user-${claims.email}`,
          email: claims.email,
          name: claims.given_name || claims.name || claims.email.split("@")[0] || "Usuario",
          plan: claims['custom:plan'] || claims.plan || "free",
          verified: true,
        };
        const session: Session = {
          token: cognitoToken, // Pasamos el JWT real para que aiService.ts lo mande a la Lambda
          expiresAt: claims.exp ? claims.exp * 1000 : Date.now() + 3600000,
        };
        useAuthStore.getState().migrateFromGuest(user.email);
        return { user, session };
      }
    }

    // No Cognito cookie found — user is not authenticated.
    // Legacy /auth/me fallback removed (caused CORS errors and is no longer needed
    // since the Identity Hub sets cookies with domain=.opitacode.com).
    return null;
  } catch (err) {
    console.error("Failed to restore session via AWS", err);
    return null;
  }
}

function removeSSOCookie(name: string) {
  const domain = window.location.hostname.includes('opitacode.com') ? 'domain=.opitacode.com;' : '';
  document.cookie = `${name}=; ${domain} path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
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

  // Eliminar cookies compartidas de Cognito
  removeSSOCookie('opita_id_token');
  removeSSOCookie('opita_access_token');
  removeSSOCookie('opita_refresh_token');

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
