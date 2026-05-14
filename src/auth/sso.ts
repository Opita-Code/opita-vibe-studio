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

/**
 * Intenta restaurar una sesión leyendo la cookie opita_session
 * contra el backend de AWS.
 */
export async function restoreSession(): Promise<AuthResult | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      credentials: "include", // Envia cookies cross-origin si CORS lo permite
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.user) return null;

    const user: UserProfile = {
      id: `user-${data.user.email}`,
      email: data.user.email,
      name: data.user.email.split("@")[0] || "Usuario",
      plan: data.user.plan || "free",
      verified: true,
    };

    // La sesión real vive en la cookie HttpOnly. 
    // Para compatibilidad con el resto del app, proveemos un mock token.
    const session: Session = {
      token: "httponly_cookie_active",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    // Check and flag guest-to-cloud migration
    useAuthStore.getState().migrateFromGuest(user.email);

    return { user, session };
  } catch (err) {
    console.error("Failed to restore session via AWS", err);
    return null;
  }
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
