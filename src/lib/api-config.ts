export const CORE_API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_DEV_API_URL || "https://api.opitacode.com/core";

export const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || "https://api.opitacode.com/chat/";

export const STORAGE_API_URL = import.meta.env.VITE_STORAGE_API_URL || "https://api.opitacode.com/storage/";

export const BILLING_API_URL = import.meta.env.VITE_BILLING_API_URL || "https://api.opitacode.com/billing/";

export const EVENTS_API_URL = import.meta.env.VITE_EVENTS_API_URL || (import.meta.env.VITE_DEV_API_URL ? `${import.meta.env.VITE_DEV_API_URL}/events/ingest` : "https://api.opitacode.com/core/events/ingest");

export const MCP_API_URL = import.meta.env.VITE_MCP_API_URL || "https://api.opitacode.com/chat/mcp";

export const BASE_API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/core", "") : (import.meta.env.VITE_DEV_API_URL ? import.meta.env.VITE_DEV_API_URL.replace("/core", "") : "https://api.opitacode.com");

// ─── Auth headers ────────────────────────────────────────────────
//
// La construcción de headers de autenticación vive en src/lib/auth-fetch.ts
// (buildAuthHeaders / fetchWithAuth / isSessionPlaceholder). Este archivo
// solo centraliza URLs; no importa stores/auth para evitar dependencias
// circulares.
//
// Migración: sync.ts ya importa buildAuthHeaders desde "@/lib/auth-fetch".
// getAuthHeaders (el antiguo helper con require() circular) fue eliminado —
// no tenía callers tras la centralización.

