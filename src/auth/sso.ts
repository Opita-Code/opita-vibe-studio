import type { UserProfile, Session } from "@/lib/types";
import { validateStudentEmail } from "./verification";
import { useAuthStore } from "@/stores/auth";

// ─── Types ──────────────────────────────────────────────────────

export interface AuthResult {
  user: UserProfile;
  session: Session;
}

// ─── Mock Data ──────────────────────────────────────────────────

/**
 * Para el MVP, no hay servidor Opita Code real.
 * Este mock simula el flujo de autenticación:
 * 1. Usuario ingresa email
 * 2. Se verifica si es .edu → plan Estudiante o Gratis
 * 3. Se genera un token JWT de mentira
 * 4. Se guarda en localStorage
 *
 * Cuando Opita Code SSO esté listo, este módulo se reemplaza
 * con un flujo OAuth 2.0 real que abrirá el navegador del sistema.
 */

const SESSION_STORAGE_KEY = "vibe-session";

// ─── Session Persistence ────────────────────────────────────────

/**
 * Guarda la sesión en localStorage (MVP fallback).
 * En producción: SQLite encriptado via Tauri store plugin.
 */
function persistSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    console.warn("[Auth] No se pudo persistir la sesión");
  }
}

/**
 * Carga la sesión desde localStorage.
 */
function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/**
 * Elimina la sesión del almacenamiento local.
 */
function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// ─── Token Validation ───────────────────────────────────────────

/**
 * Verifica si un token sigue siendo válido (no expiró).
 */
function isTokenValid(session: Session): boolean {
  return Date.now() < session.expiresAt;
}

// ─── Mock User Generation ───────────────────────────────────────

/**
 * Genera un usuario mock basado en el email ingresado.
 */
function createMockUser(email: string): UserProfile {
  const { isStudent } = validateStudentEmail(email);
  return {
    id: `user-${Date.now()}`,
    email,
    name: email.split("@")[0] || "Usuario",
    plan: isStudent ? "estudiante" : "free",
    verified: isStudent,
  };
}

/**
 * Genera un token de sesión mock.
 */
function createMockSession(): Session {
  return {
    token: `mock-jwt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
    refreshToken: `mock-refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Inicia el flujo de autenticación con Opita Code SSO.
 *
 * Para el MVP: recibe un email y autentica mockeando.
 * En producción: abre el navegador del sistema para el SSO real.
 *
 * @param email Email del usuario para mock auth
 * @returns AuthResult con usuario y sesión
 */
export async function initiateSSO(email?: string): Promise<AuthResult | null> {
  // Para MVP sin email: mostrar pantalla de login con campo de email
  if (!email) {
    return null;
  }

  // Validar formato de email
  if (!email.includes("@")) {
    throw new Error("Email inválido");
  }

  // Simular latencia de red
  await new Promise((resolve) => setTimeout(resolve, 800));

  const user = createMockUser(email);
  const session = createMockSession();

  // Persistir sesión
  persistSession(session);

  return { user, session };
}

/**
 * Intenta restaurar una sesión guardada.
 * Se llama al iniciar la app.
 */
export async function restoreSession(): Promise<AuthResult | null> {
  const session = loadSession();
  if (!session) return null;

  // Si el token expiró, intentar refrescar (mock: generar nuevo)
  if (!isTokenValid(session)) {
    // En producción: POST /auth/refresh con refreshToken
    if (session.refreshToken) {
      const newSession = createMockSession();
      persistSession(newSession);

      // Mantener el mismo usuario (cargado del store o mock)
      const store = useAuthStore.getState();
      const user = store.user ?? {
        id: `user-restored-${Date.now()}`,
        email: "usuario@opita.co",
        name: "Usuario",
        plan: "free" as const,
        verified: false,
      };

      return { user, session: newSession };
    }

    // No hay refresh token — limpiar sesión
    clearSession();
    return null;
  }

  // Token válido — restaurar sesión con usuario mock
  const user: UserProfile = {
    id: "user-restored",
    email: "usuario@opita.co",
    name: "Usuario",
    plan: "free",
    verified: false,
  };

  return { user, session };
}

/**
 * Cierra la sesión del usuario.
 * Elimina tokens del almacenamiento y resetea el store.
 */
export async function logout(): Promise<void> {
  clearSession();
  useAuthStore.getState().logout();
}
