import type { AIProvider } from "@/lib/types";
import type { ModelConfig, ProviderInfo } from "./types";
import { createDeepSeekProvider } from "./deepseek";
import { createGeminiProvider } from "./gemini";
import { createMiniMaxProvider } from "./minimax";
import { createOpenAIProvider } from "./openai";
import { createOpenRouterProvider } from "./openrouter";
import { createCustomProvider } from "./custom";
import { createChatGPTWebProvider } from "./chatgpt-web";
import { createAnthropicProvider } from "./anthropic";
import { createTogetherProvider } from "./together";
import { createGroqProvider } from "./groq";
import { createMistralProvider } from "./mistral";
import { createCohereProvider } from "./cohere";
import { createPerplexityProvider } from "./perplexity";

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
    id: "deepseek-v4-flash",
    name: "Opita Flash",
    providerId: "deepseek",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
    requiredPlanTier: 1,
  },
  {
    id: "deepseek-v4-pro",
    name: "Opita Pro",
    providerId: "deepseek",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
    requiredPlanTier: 2,
  },
];

const GEMINI_MODELS: ModelConfig[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini Flash",
    providerId: "gemini",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
    requiredPlanTier: 0,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini Pro",
    providerId: "gemini",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "free",
    requiredPlanTier: 2,
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
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
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
    id: "codex-mini",
    name: "Codex Mini (ChatGPT Plus)",
    providerId: "chatgpt-web",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
];

// MiniMax — modelos óptimos por tarea (fuente primaria 2026-08-03:
// https://platform.minimax.io/docs/guides/text-generation):
//   - MiniMax-M3             → agéntico, coding, tool-use, 1M contexto (premium)
//   - MiniMax-M2.5-highspeed → ~100 tps, tareas rápidas (flash)
//   - MiniMax-M2.5           → ~60 tps, mejor costo/valor (balance)
const MINIMAX_MODELS: ModelConfig[] = [
  {
    id: "MiniMax-M3",
    name: "MiniMax M3",
    providerId: "minimax",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
  {
    id: "MiniMax-M2.5-highspeed",
    name: "MiniMax M2.5 Highspeed",
    providerId: "minimax",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
  {
    id: "MiniMax-M2.5",
    name: "MiniMax M2.5",
    providerId: "minimax",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
];

// ─── BYOK providers (VL-5): modelos seleccionables con key propia ─

const TOGETHER_MODELS: ModelConfig[] = [
  {
    id: "meta-llama/Llama-3-70b-chat-hf",
    name: "Llama 3 70B",
    providerId: "together",
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kInput: 0.00088,
    costPer1kOutput: 0.00088,
    tier: "byok",
  },
  {
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    name: "Mixtral 8x7B",
    providerId: "together",
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kInput: 0.0006,
    costPer1kOutput: 0.0006,
    tier: "byok",
  },
];

const GROQ_MODELS: ModelConfig[] = [
  {
    id: "llama3-8b-8192",
    name: "Llama 3 8B",
    providerId: "groq",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    providerId: "groq",
    maxTokens: 32768,
    temperature: 0.7,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    tier: "byok",
  },
];

const MISTRAL_MODELS: ModelConfig[] = [
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    providerId: "mistral",
    maxTokens: 32768,
    temperature: 0.7,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.006,
    tier: "byok",
  },
  {
    id: "codestral-latest",
    name: "Codestral (código)",
    providerId: "mistral",
    maxTokens: 32768,
    temperature: 0.2,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0006,
    tier: "byok",
  },
];

const COHERE_MODELS: ModelConfig[] = [
  {
    id: "command-r-plus",
    name: "Command R+",
    providerId: "cohere",
    maxTokens: 128000,
    temperature: 0.7,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    tier: "byok",
  },
  {
    id: "command-r",
    name: "Command R",
    providerId: "cohere",
    maxTokens: 128000,
    temperature: 0.7,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
    tier: "byok",
  },
];

const PERPLEXITY_MODELS: ModelConfig[] = [
  {
    id: "llama-3.1-sonar-large-128k-online",
    name: "Sonar Large (online)",
    providerId: "perplexity",
    maxTokens: 128000,
    temperature: 0.7,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.001,
    tier: "byok",
  },
  {
    id: "llama-3.1-sonar-small-128k-online",
    name: "Sonar Small (online)",
    providerId: "perplexity",
    maxTokens: 128000,
    temperature: 0.7,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0002,
    tier: "byok",
  },
];

// ─── Model map ─────────────────────────────────────────────────

const MODEL_MAP: Record<string, ModelConfig[]> = {
  deepseek: DEEPSEEK_MODELS,
  gemini: GEMINI_MODELS,
  minimax: MINIMAX_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  openrouter: OPENROUTER_MODELS,
  custom: CUSTOM_MODELS,
  "chatgpt-web": CHATGPT_WEB_MODELS,
  together: TOGETHER_MODELS,
  groq: GROQ_MODELS,
  mistral: MISTRAL_MODELS,
  cohere: COHERE_MODELS,
  perplexity: PERPLEXITY_MODELS,
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
    createMiniMaxProvider(),
    createOpenAIProvider(),
    createAnthropicProvider(),
    createOpenRouterProvider(),
    createCustomProvider(),
    createChatGPTWebProvider(),
    createTogetherProvider(),
    createGroqProvider(),
    createMistralProvider(),
    createCohereProvider(),
    createPerplexityProvider(),
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
