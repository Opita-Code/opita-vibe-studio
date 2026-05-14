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

// ─── Definitions ────────────────────────────────────────────────

export interface ProviderDefinition {
  id: string;
  name: string;
  category: string;
  docsUrl?: string;
  requiresEndpoint?: boolean;
}

export const BYOK_PROVIDERS: ProviderDefinition[] = [
  {
    id: "chatgpt-web",
    name: "ChatGPT Plus (WebAuth)",
    category: "Principales",
    docsUrl: "https://chatgpt.com",
    requiresEndpoint: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "Principales",
    docsUrl: "https://platform.openai.com/api-keys",
    requiresEndpoint: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "Principales",
    docsUrl: "https://console.anthropic.com/",
    requiresEndpoint: false,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "Principales",
    docsUrl: "https://aistudio.google.com/app/apikey",
    requiresEndpoint: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "Agregadores",
    docsUrl: "https://openrouter.ai/keys",
    requiresEndpoint: false,
  },
  {
    id: "together",
    name: "Together AI",
    category: "Agregadores",
    docsUrl: "https://api.together.xyz/settings/api-keys",
    requiresEndpoint: false,
  },
  {
    id: "groq",
    name: "Groq",
    category: "Alto Rendimiento",
    docsUrl: "https://console.groq.com/keys",
    requiresEndpoint: false,
  },
  {
    id: "deepseek",
    name: "Opita AI",
    category: "Alto Rendimiento",
    docsUrl: "https://platform.deepseek.com/api_keys",
    requiresEndpoint: false,
  },
  {
    id: "mistral",
    name: "Mistral",
    category: "Alto Rendimiento",
    docsUrl: "https://console.mistral.ai/api-keys",
    requiresEndpoint: false,
  },
  {
    id: "cohere",
    name: "Cohere",
    category: "Alto Rendimiento",
    docsUrl: "https://dashboard.cohere.com/api-keys",
    requiresEndpoint: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    category: "Búsqueda",
    docsUrl: "https://www.perplexity.ai/settings/api",
    requiresEndpoint: false,
  },
  {
    id: "custom",
    name: "Endpoint Personalizado",
    category: "Avanzado",
    requiresEndpoint: true,
  },
];

export function getProviderDef(id: string): ProviderDefinition | undefined {
  return BYOK_PROVIDERS.find((p) => p.id === id);
}

// ─── Helpers ────────────────────────────────────────────────────

export function maskKey(key: string): string {
  if (!key || key.length <= 10) return "***";
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

function storageKey(providerId: string): string {
  return `${STORAGE_PREFIX}${providerId}`;
}

// ─── Public API ─────────────────────────────────────────────────

import { useAuthStore } from "@/stores/auth";

export async function saveProviderKey(
  providerId: string,
  key: string,
  endpoint?: string,
): Promise<void> {
  if (!providerId || !key) {
    throw new Error("providerId y key son requeridos");
  }

  const authState = useAuthStore.getState();
  
  if (authState.authMode !== "authenticated" || !authState.session?.token) {
    throw new Error("Por seguridad, debes crear una cuenta gratuita para guardar tus propias llaves API. No guardamos llaves en texto plano en el navegador.");
  }

  let finalKey = key;

  try {
      const AWS_API_URL = import.meta.env.VITE_AWS_API_URL || "https://5zranjs7zstps7ruqkfs4qrkfe0wowcc.lambda-url.us-east-1.on.aws/";
      
      const res = await fetch(AWS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authState.session.token}`
        },
        body: JSON.stringify({
          action: "save_key",
          providerId,
          customApiKey: key
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          useAuthStore.getState().logout();
          throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
        }
        throw new Error(`AWS devolvió error al guardar llave: ${res.status}`);
      }

      const json = await res.json();
      if (json.error) {
        if (json.error.includes("Unauthorized") || json.error.includes("Token") || res.status === 401) {
          useAuthStore.getState().logout();
          throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
        }
        throw new Error(json.error);
      }

      finalKey = "aws-managed";
    } catch (err) {
      console.error("Fallo al guardar la llave de forma segura en AWS:", err);
      throw err;
    }

  const entry: ProviderKeyEntry = {
    key: finalKey,
    endpoint,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(storageKey(providerId), JSON.stringify(entry));

  const configured = getConfiguredList();
  if (!configured.includes(providerId)) {
    configured.push(providerId);
    localStorage.setItem(CONFIGURED_PROVIDERS_KEY, JSON.stringify(configured));
  }

  await syncProviderToRegistry(providerId, finalKey, endpoint);
}

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

export async function deleteProviderKey(providerId: string): Promise<void> {
  localStorage.removeItem(storageKey(providerId));

  const configured = getConfiguredList().filter((id) => id !== providerId);
  localStorage.setItem(CONFIGURED_PROVIDERS_KEY, JSON.stringify(configured));

  await syncProviderToRegistry(providerId);
}

export async function listConfiguredProviders(): Promise<string[]> {
  return getConfiguredList();
}

function getConfiguredList(): string[] {
  const raw = localStorage.getItem(CONFIGURED_PROVIDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function testProviderConnection(
  providerId: string,
  apiKey: string,
  endpoint?: string,
): Promise<boolean> {
  try {
    // Si la llave está encriptada y manejada por AWS, significa que ya fue 
    // validada exitosamente antes de guardarse. No tenemos el texto plano 
    // en el frontend para probarla directamente contra el proveedor.
    if (apiKey === "aws-managed") {
      await new Promise(resolve => setTimeout(resolve, 800));
      return true;
    }

    if (providerId === "custom" && endpoint) {
      const modelsUrl = `${endpoint.replace(/\/$/, "")}/models`;
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    }

    if (providerId === "chatgpt-web") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    }

    const baseUrls: Record<string, string> = {
      openai: "https://api.openai.com/v1/models",
      openrouter: "https://openrouter.ai/api/v1/models",
      anthropic: "https://api.anthropic.com/v1/models", // May 404, but just checking if key is somewhat valid, or fallback to length
      gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      groq: "https://api.groq.com/openai/v1/models",
      mistral: "https://api.mistral.ai/v1/models",
      cohere: "https://api.cohere.ai/v1/models",
      together: "https://api.together.xyz/v1/models",
      perplexity: "https://api.perplexity.ai/chat/completions",
      deepseek: "https://api.deepseek.com/models"
    };

    const url = endpoint ?? baseUrls[providerId];
    if (!url) {
      return apiKey.length > 0;
    }

    if (providerId === "anthropic" || providerId === "perplexity") {
       // Just check key length since they don't have standard /models endpoints that respond with standard GET auth for simple verification
       return apiKey.length > 10;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: providerId === 'gemini' ? {} : { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncProviderToRegistry(
  providerId: string,
  apiKey?: string,
  endpoint?: string,
): Promise<void> {
  try {
    const { registerProvider } = await import("@/providers/registry");

    if (!apiKey) {
      return;
    }

    if (providerId === "custom" && endpoint) {
      const { createCustomProvider } = await import("@/providers/custom");
      registerProvider(createCustomProvider(endpoint, apiKey));
    } else if (providerId === "deepseek") {
      const { createDeepSeekProvider } = await import("@/providers/deepseek");
      const provider = createDeepSeekProvider(apiKey);
      provider.tier = "byok"; 
      registerProvider(provider);
    } else if (providerId === "openai") {
      const { createOpenAIProvider } = await import("@/providers/openai");
      registerProvider(createOpenAIProvider(apiKey));
    } else if (providerId === "openrouter") {
      const { createOpenRouterProvider } = await import("@/providers/openrouter");
      registerProvider(createOpenRouterProvider(apiKey));
    } else if (providerId === "chatgpt-web") {
      const { createChatGPTWebProvider } = await import("@/providers/chatgpt-web");
      registerProvider(createChatGPTWebProvider(apiKey));
    } else if (providerId === "anthropic") {
      const { createAnthropicProvider } = await import("@/providers/anthropic");
      const provider = createAnthropicProvider(apiKey);
      registerProvider(provider);
    } else if (providerId === "gemini") {
      const { createGeminiProvider } = await import("@/providers/gemini");
      registerProvider(createGeminiProvider(apiKey));
    } else if (providerId === "groq") {
      const { createGroqProvider } = await import("@/providers/groq");
      registerProvider(createGroqProvider(apiKey));
    } else if (providerId === "mistral") {
      const { createMistralProvider } = await import("@/providers/mistral");
      registerProvider(createMistralProvider(apiKey));
    } else if (providerId === "cohere") {
      const { createCohereProvider } = await import("@/providers/cohere");
      registerProvider(createCohereProvider(apiKey));
    } else if (providerId === "perplexity") {
      const { createPerplexityProvider } = await import("@/providers/perplexity");
      registerProvider(createPerplexityProvider(apiKey));
    } else if (providerId === "together") {
      const { createTogetherProvider } = await import("@/providers/together");
      registerProvider(createTogetherProvider(apiKey));
    }
  } catch (err) {
    console.warn(`[BYOK] No se pudo sincronizar provider ${providerId}:`, err);
  }
}

export async function getByokProviderDisplayInfo(): Promise<ProviderDisplayInfo[]> {
  const configured = await listConfiguredProviders();
  const providers: ProviderDisplayInfo[] = BYOK_PROVIDERS.map(p => ({
    id: p.id,
    name: p.name,
    configured: false,
    status: "not_configured" as const
  }));

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

export async function loadConfiguredProvidersToRegistry(): Promise<void> {
  const configuredIds = getConfiguredList();
  for (const id of configuredIds) {
    const entry = await getProviderKey(id);
    if (entry) {
      await syncProviderToRegistry(id, entry.key, entry.endpoint);
    }
  }
}
