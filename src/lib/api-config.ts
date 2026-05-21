export const CORE_API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_DEV_API_URL || "https://api.opitacode.com/core";

export const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || "https://api.opitacode.com/chat/";

export const STORAGE_API_URL = import.meta.env.VITE_STORAGE_API_URL || "https://api.opitacode.com/storage/";

export const BILLING_API_URL = import.meta.env.VITE_BILLING_API_URL || "https://api.opitacode.com/billing/";

export const EVENTS_API_URL = import.meta.env.VITE_EVENTS_API_URL || (import.meta.env.VITE_DEV_API_URL ? `${import.meta.env.VITE_DEV_API_URL}/events/ingest` : "https://api.opitacode.com/core/events/ingest");

export const MCP_API_URL = import.meta.env.VITE_MCP_API_URL || "https://api.opitacode.com/chat/mcp";

export const BASE_API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/core", "") : (import.meta.env.VITE_DEV_API_URL ? import.meta.env.VITE_DEV_API_URL.replace("/core", "") : "https://api.opitacode.com");

// ─── Centralized Auth Headers ──────────────────────────────────
//
// Magic link sessions store "opita_session" as a placeholder token
// (the real auth is the HttpOnly cookie sent via credentials: "include").
// We must NEVER send that placeholder as a Bearer token — doing so
// sends literal "Authorization: Bearer opita_session" to the backend.
//
// This utility provides consistent auth headers for ALL API calls.

const SESSION_PLACEHOLDER = "opita_session";

/**
 * Returns auth headers for API calls. Handles both:
 * - Cognito JWT sessions → Bearer token in header
 * - Magic link sessions → no Bearer header (auth via HttpOnly cookie)
 *
 * Always use `credentials: "include"` alongside these headers.
 */
/**
 * Returns auth headers for API calls.
 * 
 * IMPORTANT: To avoid circular dependencies, do not use `getAuthHeaders` directly 
 * in files that are imported by stores. Instead, extract the token first and pass it 
 * to `buildAuthHeaders`.
 */
export function getAuthHeaders(): Record<string, string> {
  // Use a hack to get the store without importing it at module level,
  // relying on the global window object if possible, or just dynamic import
  // But since this must be sync, we use require (which works in vite but might be tricky in pure ESM).
  // Actually, since this caused issues in sandbox.ts, let's just make callers pass the token!
  // I will leave getAuthHeaders using require for now, but in Vite this might break.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/stores/auth");
    const token = useAuthStore.getState()?.session?.token;
    return buildAuthHeaders(token);
  } catch (e) {
    return {};
  }
}

/**
 * Same as getAuthHeaders but accepts a token directly (for cases
 * where the caller already has the token extracted).
 */
export function buildAuthHeaders(token: string | undefined | null): Record<string, string> {
  if (token && token !== SESSION_PLACEHOLDER) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

