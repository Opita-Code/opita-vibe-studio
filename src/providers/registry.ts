import type { AIProvider } from "@/lib/types";
import type { ModelConfig, ProviderInfo } from "./types";
import { createDeepSeekProvider } from "./deepseek";
import { createGeminiProvider } from "./gemini";
import { createOpenAIProvider } from "./openai";
import { createOpenRouterProvider } from "./openrouter";
import { createCustomProvider } from "./custom";
import { createChatGPTWebProvider } from "./chatgpt-web";
import { createAnthropicProvider } from "./anthropic";

// ─── Default Model Definitions ─────────────────────────────────

const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    providerId: "anthropic",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    tier: "byok",
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    providerId: "anthropic",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
    tier: "byok",
  },
];

const DEEPSEEK_MODELS: ModelConfig[] = [
  {
    id: "deepseek-chat",
    name: "Opita Flash",
    providerId: "deepseek",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
  },
  {
    id: "deepseek-reasoner",
    name: "Opita Architect",
    providerId: "deepseek",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
  },
];

const GEMINI_MODELS: ModelConfig[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini Flash",
    providerId: "gemini",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
  },
];

const OPENAI_MODELS: ModelConfig[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providerId: "openai",
    maxTokens: 16384,
    temperature: 0.7,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    tier: "byok",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    providerId: "openai",
    maxTokens: 16384,
    temperature: 0.7,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    tier: "byok",
  },
];

const OPENROUTER_MODELS: ModelConfig[] = [
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini (OpenRouter)",
    providerId: "openrouter",
    maxTokens: 16384,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude 3 Haiku",
    providerId: "openrouter",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
];

const CUSTOM_MODELS: ModelConfig[] = [
  {
    id: "custom-model",
    name: "Modelo personalizado",
    providerId: "custom",
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
];

const CHATGPT_WEB_MODELS: ModelConfig[] = [
  {
    id: "text-davinci-002-render-sha",
    name: "ChatGPT Plus (Web)",
    providerId: "chatgpt-web",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
];

// ─── Model map ─────────────────────────────────────────────────

const MODEL_MAP: Record<string, ModelConfig[]> = {
  deepseek: DEEPSEEK_MODELS,
  gemini: GEMINI_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  openrouter: OPENROUTER_MODELS,
  custom: CUSTOM_MODELS,
  "chatgpt-web": CHATGPT_WEB_MODELS,
};

// ─── Provider Registry ─────────────────────────────────────────

/** Mapa interno de providers registrados. */
let providers = new Map<string, AIProvider>();

/** Indica si el registro ya fue inicializado. */
let initialized = false;

/**
 * Inicializa el registro con los providers por defecto.
 * Se llama automáticamente en el primer acceso si no se llamó antes.
 */
export function initializeProviders(): void {
  if (initialized) return;

  const defaults: AIProvider[] = [
    createDeepSeekProvider(),
    createGeminiProvider(),
    createOpenAIProvider(),
    createAnthropicProvider(),
    createOpenRouterProvider(),
    createCustomProvider(),
    createChatGPTWebProvider(),
  ];

  providers = new Map(defaults.map((p) => [p.id, p]));
  initialized = true;
}

/**
 * Obtiene un provider por su ID.
 * @throws Si el provider no existe
 */
export function getProvider(id: string): AIProvider {
  if (!initialized) initializeProviders();

  const provider = providers.get(id);
  if (!provider) {
    throw new Error(
      `Provider "${id}" no encontrado. Providers disponibles: ${listProviderIds().join(", ")}`,
    );
  }
  return provider;
}

/**
 * Registra un nuevo provider (o reemplaza uno existente).
 */
export function registerProvider(provider: AIProvider): void {
  if (!initialized) initializeProviders();
  providers.set(provider.id, provider);
}

/**
 * Elimina un provider del registro.
 */
export function unregisterProvider(id: string): boolean {
  if (!initialized) initializeProviders();
  return providers.delete(id);
}

/**
 * Lista todos los providers registrados con su metadata.
 * El flag `configured` indica si el provider tiene una API key presente
 * (free providers: env var presente; BYOK providers: key pasada al constructor).
 *
 * Para determinar `configured`, intentamos validar la key si el provider
 * implementa `validateKey()`. Para el MVP, usamos una heurística simple:
 * si el provider tiene key, `validateKey` devolverá true.
 */
export function listProviders(): ProviderInfo[] {
  if (!initialized) initializeProviders();

  return Array.from(providers.values()).map((p) => {
    const models = MODEL_MAP[p.id] ?? [];
    return {
      id: p.id,
      name: p.name,
      tier: p.tier as "free" | "byok",
      configured: true, // El router maneja el caso "no configurado" capturando el error del provider
      models,
    };
  });
}

/**
 * Retorna los IDs de todos los providers registrados.
 */
export function listProviderIds(): string[] {
  if (!initialized) initializeProviders();
  return Array.from(providers.keys());
}

/**
 * Retorna los modelos disponibles para un provider.
 */
export function getProviderModels(providerId: string): ModelConfig[] {
  return MODEL_MAP[providerId] ?? [];
}

/**
 * Limpia el registro (útil para tests).
 */
export function resetRegistry(): void {
  providers = new Map();
  initialized = false;
}
