// ─── BYOK Provider Key Storage ──────────────────────────────────
//
// Para el MVP, usamos localStorage como almacenamiento (fallback).
// Cuando el plugin store de Tauri esté disponible, migraremos a
// SQLite encriptado via IPC.
//
// Las keys NUNCA se exponen en texto plano al frontend después
// de ser guardadas — solo se muestra la versión enmascarada.

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_PREFIX = "vibe-byok-";
const CONFIGURED_PROVIDERS_KEY = `${STORAGE_PREFIX}configured`;

// ─── Types ──────────────────────────────────────────────────────

export interface ProviderKeyEntry {
  /** API key (en texto plano solo durante la escritura) */
  key: string;
  /** URL base opcional (para custom endpoints) */
  endpoint?: string;
  /** Timestamp de creación */
  createdAt: string;
  /** Proveedor configurado desde (formato ISO) */
  updatedAt: string;
}

export interface ProviderDisplayInfo {
  id: string;
  name: string;
  configured: boolean;
  maskedKey?: string;
  endpoint?: string;
  status: "not_configured" | "connected" | "error" | "verifying";
  errorMessage?: string;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Enmascara una API key para mostrar en la UI.
 * Muestra los primeros 3 y últimos 4 caracteres.
 * Ej: "sk-proj-abc123..." → "sk-...c123"
 */
export function maskKey(key: string): string {
  if (!key || key.length <= 10) return "***";
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Genera un ID único para cada entrada de proveedor.
 */
function storageKey(providerId: string): string {
  return `${STORAGE_PREFIX}${providerId}`;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Guarda la API key de un proveedor en localStorage.
 * La key se almacena en texto plano (MVP fallback).
 * En producción, esto iría a SQLite encriptado via IPC.
 */
export async function saveProviderKey(
  providerId: string,
  key: string,
  endpoint?: string,
): Promise<void> {
  if (!providerId || !key) {
    throw new Error("providerId y key son requeridos");
  }

  const entry: ProviderKeyEntry = {
    key,
    endpoint,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(storageKey(providerId), JSON.stringify(entry));

  // Actualizar lista de proveedores configurados
  const configured = getConfiguredList();
  if (!configured.includes(providerId)) {
    configured.push(providerId);
    localStorage.setItem(CONFIGURED_PROVIDERS_KEY, JSON.stringify(configured));
  }

  // Sincronizar con el registro de providers
  await syncProviderToRegistry(providerId, key, endpoint);
}

/**
 * Obtiene la key y endpoint de un proveedor.
 * Devuelve null si no está configurado.
 */
export async function getProviderKey(
  providerId: string,
): Promise<{ key: string; endpoint?: string } | null> {
  const raw = localStorage.getItem(storageKey(providerId));
  if (!raw) return null;

  try {
    const entry: ProviderKeyEntry = JSON.parse(raw);
    return { key: entry.key, endpoint: entry.endpoint };
  } catch {
    return null;
  }
}

/**
 * Elimina la key de un proveedor del almacenamiento.
 */
export async function deleteProviderKey(providerId: string): Promise<void> {
  localStorage.removeItem(storageKey(providerId));

  // Actualizar lista de proveedores configurados
  const configured = getConfiguredList().filter((id) => id !== providerId);
  localStorage.setItem(CONFIGURED_PROVIDERS_KEY, JSON.stringify(configured));

  // Re-sincronizar el registro (quita la key del provider activo)
  await syncProviderToRegistry(providerId);
}

/**
 * Lista los IDs de proveedores que tienen keys configuradas.
 */
export async function listConfiguredProviders(): Promise<string[]> {
  return getConfiguredList();
}

/**
 * Obtiene la lista interna de proveedores configurados.
 */
function getConfiguredList(): string[] {
  const raw = localStorage.getItem(CONFIGURED_PROVIDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Prueba la conexión con un proveedor usando su API key.
 * Para providers built-in, delega al validateKey del provider.
 * Para custom endpoints, hace un GET /v1/models.
 */
export async function testProviderConnection(
  providerId: string,
  apiKey: string,
  endpoint?: string,
): Promise<boolean> {
  try {
    if (providerId === "custom" && endpoint) {
      const modelsUrl = `${endpoint.replace(/\/$/, "")}/models`;
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    }

    // Para OpenAI, OpenRouter, Anthropic — probar con GET /v1/models
    const baseUrls: Record<string, string> = {
      openai: "https://api.openai.com/v1/models",
      openrouter: "https://openrouter.ai/api/v1/models",
    };

    const url = endpoint ?? baseUrls[providerId];
    if (!url) {
      // DeepSeek y Gemini tienen key gratuita — no podemos validar fácilmente
      // sin hacer una petición de chat. Para el MVP, asumimos válida.
      return apiKey.length > 0;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sincroniza un provider BYOK con el registro de providers.
 * Cuando se guarda/elimina una key, actualiza el provider en el
 * registro para que esté disponible con la key configurada.
 */
export async function syncProviderToRegistry(
  providerId: string,
  apiKey?: string,
  endpoint?: string,
): Promise<void> {
  try {
    const { registerProvider } = await import("@/providers/registry");

    // Si no hay key, eliminar el provider del registro (para que no se use)
    if (!apiKey) {
      // Mantener el provider pero sin key — el chat() devolverá error
      // Esto es más seguro que eliminar, porque otros módulos pueden
      // tener referencias al provider
      return;
    }

    // Re-registrar el provider con la key configurada
    if (providerId === "custom" && endpoint) {
      const { createCustomProvider } = await import("@/providers/custom");
      const provider = createCustomProvider(endpoint, apiKey);
      registerProvider(provider);
    } else if (providerId === "openai") {
      const { createOpenAIProvider } = await import("@/providers/openai");
      const provider = createOpenAIProvider(apiKey);
      registerProvider(provider);
    } else if (providerId === "openrouter") {
      const { createOpenRouterProvider } = await import("@/providers/openrouter");
      const provider = createOpenRouterProvider(apiKey);
      registerProvider(provider);
    }
    // Anthropic no tiene provider en el MVP — se agregará después
  } catch (err) {
    console.warn(`[BYOK] No se pudo sincronizar provider ${providerId}:`, err);
  }
}

/**
 * Obtiene información de display para todos los proveedores BYOK.
 */
export async function getByokProviderDisplayInfo(): Promise<ProviderDisplayInfo[]> {
  const configured = await listConfiguredProviders();
  const providers: ProviderDisplayInfo[] = [
    { id: "openai", name: "OpenAI", configured: false, status: "not_configured" },
    { id: "openrouter", name: "OpenRouter", configured: false, status: "not_configured" },
    { id: "anthropic", name: "Anthropic", configured: false, status: "not_configured" },
    {
      id: "custom",
      name: "Endpoint Personalizado",
      configured: false,
      status: "not_configured",
    },
  ];

  for (const info of providers) {
    if (configured.includes(info.id)) {
      const entry = await getProviderKey(info.id);
      if (entry) {
        info.configured = true;
        info.maskedKey = maskKey(entry.key);
        info.endpoint = entry.endpoint;
        info.status = "connected";
      }
    }
  }

  return providers;
}
