/**
 * Agent Orchestrator — Single entry point for all AI interactions.
 *
 * This is the ONLY module that the UI (ChatPanel) interacts with.
 * It routes messages to the appropriate sub-agent based on intent.
 *
 * Flow:
 *   User Message → classifyIntent() → ChatAgent or BuildAgent
 *                                       ↓
 *                               AsyncGenerator<AgentEvent>
 *                                       ↓
 *                                  ChatPanel (UI)
 */

import type { AgentEvent, ExecutionMode, IntentClass, AgentPhase } from "./types";
import type { Message, PersonaId } from "@/lib/types";
import { classifyIntent } from "./intent";
import { runChatAgent, type ChatAgentConfig } from "./chat-agent";
import { runExploreAgent, type ExploreAgentConfig } from "./explore-agent";
import { runBuildAgent, type BuildAgentConfig } from "./build-agent";
import { getProjectSummary } from "@/tools/executor";
import { selectModel } from "./model-router";
import { buildMemoryContextBlock } from "@/lib/dark-memory";
import { createHarnessEngine } from "./harnesses/factory";
import { createDefaultContext } from "./harnesses";
import type { HarnessContext } from "./harnesses/types";

// ─── Config ────────────────────────────────────────────────────

/** Harness engine singleton (VL-3) — instanciado una vez, reutilizado. */
let harnessEngine: ReturnType<typeof createHarnessEngine> | null = null;

function getHarnessEngine(): ReturnType<typeof createHarnessEngine> {
  if (!harnessEngine) {
    harnessEngine = createHarnessEngine();
  }
  return harnessEngine;
}

/**
 * Ejecuta la fase pre-execute del harness engine con el contexto
 * derivado de la request. Propaga decisiones (model, retrievedMemories,
 * skills, useTDD, delivery) al resto del orquestador.
 *
 * Degradación elegante: si algo falla (bridge ausente, harness bug),
 * devuelve el contexto sin cambios — el flujo actual se mantiene.
 */
export async function runHarnessPreExecute(
  userText: string,
  config: OrchestratorConfig,
): Promise<Partial<HarnessContext>> {
  try {
    const engine = getHarnessEngine();

    // Poblar el contexto con lo que sabemos de la request.
    const base = createDefaultContext(userText, config.plan);
    const ctx: HarnessContext = {
      ...base,
      project: {
        ...base.project,
        isOpen: config.hasProjectOpen,
        rootFiles: config.projectFiles ?? [],
        testRunner: config.testRunner ?? null,
        hasGit: config.hasGit ?? false,
        packageManager: config.packageManager ?? null,
        stack: [],
      },
      requestedModelId: config.modelId,
      customApiKey: config.customApiKey,
      signal: config.signal,
    };

    // Correr solo la fase pre-execute (dark-memory-context, engram,
    // skill-registry, model-routing, etc.).
    const result = await engine.runPhase("pre-execute", ctx);
    return result;
  } catch (err: unknown) {
    console.warn("[orchestrator] harness pre-execute falló (degradado):", err);
    return {};
  }
}

/** How the agent delivers changes */
export type DeliveryStrategy = "direct" | "pr" | "feature-branch";

/**
 * Mapea el modo UI explícito del usuario a un intent del agente.
 * 'auto'/undefined → null (clasificación automática por classifyIntent).
 * VL-4: hace que el selector Construir/Planear/Vibe afecte el routing real.
 */
export function mapActiveModeToIntent(
  activeMode?: "auto" | "construir" | "planear" | "vibe" | "chat",
): "code" | "explore" | "chat" | null {
  switch (activeMode) {
    case "construir": return "code";
    case "planear": return "explore";
    case "vibe":
    case "chat": return "chat";
    default: return null;
  }
}

export interface OrchestratorConfig {
  /** AI provider ID (e.g., "deepseek", "gemini") */
  providerId: string;
  /** Specific model ID */
  modelId?: string;
  /** Custom API key (BYOK) */
  customApiKey?: string;
  /** User plan tier for intelligent model routing */
  plan: "free" | "estudiante" | "pro";
  /** Whether user is quota-degraded (Pro forced to cheaper model) */
  degraded?: boolean;
  /** Execution mode: auto runs everything, interactive pauses for confirmation */
  executionMode: ExecutionMode;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Custom instructions from user settings */
  customInstructions?: string;
  /** Whether a project is open */
  hasProjectOpen: boolean;
  /** Detected test runner (from context-loader) */
  testRunner?: string | null;
  /** Root-level files in the project (for convention/lockfile detection) */
  projectFiles?: string[];
  /** Detected package manager (from context-loader) */
  packageManager?: "npm" | "pnpm" | "bun" | "yarn" | null;
  /** Whether git is initialized in the project */
  hasGit?: boolean;
  /** Modo UI explícito seleccionado por el usuario (VL-4).
   *  'auto' (default) → classifyIntent automático.
   *  'construir' → intent code, 'planear' → intent explore, 'vibe' → intent chat. */
  activeMode?: "auto" | "construir" | "planear" | "vibe" | "chat";
  /** Active persona ID for Aura's communication tone */
  persona?: PersonaId;
  /** Custom persona prompt (only used when persona === "custom") */
  customPersonaPrompt?: string;
}

// ─── Orchestrator ──────────────────────────────────────────────

/**
 * Main entry point for all AI interactions.
 *
 * Takes a user message and configuration, returns an async stream of AgentEvents.
 * The UI iterates this generator and updates state accordingly.
 *
 * @example
 * ```ts
 * for await (const event of handleMessage("crear un login", messages, config)) {
 *   switch (event.type) {
 *     case "text": appendToMessage(event.content); break;
 *     case "step": addStep(event.step); break;
 *     case "file_changed": trackFile(event.path); break;
 *     // ...
 *   }
 * }
 * ```
 */
export async function* handleMessage(
  userText: string,
  conversationHistory: Message[],
  config: OrchestratorConfig
): AsyncGenerator<AgentEvent> {
  // 1. Classify intent
  // VL-4: si el usuario seleccionó un modo UI explícito (no 'auto'),
  // respetarlo en vez de clasificar automáticamente. Esto hace que el
  // selector Construir/Planear/Vibe afecte el routing REAL del agente.
  const explicitIntent = mapActiveModeToIntent(config.activeMode);
  const intent = explicitIntent ?? classifyIntent(userText, config.hasProjectOpen);

  // 1b. Harness pre-execute (VL-3): el engine inyecta decisiones de
  // memoria/modelo/skills. Degradación elegante si falla.
  const harnessCtx = await runHarnessPreExecute(userText, config);

  // 2. Intelligent model selection based on plan tier
  // "build" = basic code generation (FREE allowed)
  // "subagent" = SDD orchestration phases (requires Estudiante+)
  const action = intent === "code" ? "build" : "chat";
  const routing = selectModel({
    plan: config.plan,
    action,
    subagentId: undefined, // build-agent doesn't use SDD phases
    modelId: config.modelId,
    customApiKey: config.customApiKey,
    degraded: config.degraded ?? false,
    hasGoogleAI: true,  // Backend availability — frontend assumes true
    hasDeepSeek: true,
  });

  // If blocked (e.g. free user trying subagent), emit error
  if (routing.blocked) {
    yield { type: "error", message: routing.blockReason || "Acción no permitida en tu plan actual." };
    return;
  }

  const routedProviderId = routing.providerId;
  const routedModelId = routing.modelId;

  // 3. Emit intent detection (for UI phase indicator)
  yield { type: "phase", phase: intentToPhase(intent) };

  // 4. Get project context if available
  const projectSummary = config.hasProjectOpen
    ? getProjectSummary() ?? undefined
    : undefined;

  // 4b. Dark-memory context: recuperar memories relevantes (RAG ligero)
  // para que Aura no contradiga decisiones previas. Degradación
  // elegante: si dark-memory no está disponible → "".
  let memoryContext: string | undefined;
  try {
    const block = await buildMemoryContextBlock(userText);
    if (block) memoryContext = block;
  } catch (err: unknown) {
    console.warn("[orchestrator] dark-memory context falló:", err);
  }

  // 4c. Harness retrievedMemories (VL-3): si el harness engine cargó
  // memories vía dark-memory-context/engram, inyectarlas también.
  const harnessMemories = harnessCtx.retrievedMemories ?? [];
  if (harnessMemories.length > 0) {
    const lines = harnessMemories.map(
      (m) => `- **[${m.kind}] ${m.title}** (${m.tags || "sin tags"}): ${m.content.slice(0, 200)}`,
    );
    const block = `## Memoria del harness\n\n${lines.join("\n")}\n`;
    memoryContext = memoryContext ? `${memoryContext}\n${block}` : block;
  }

  // 4d. Decisiones del harness para TDD/delivery (VL-3).
  const harnessUseTDD = harnessCtx.useTDD;
  const harnessDelivery = harnessCtx.deliveryStrategy;

  // 5. Route to appropriate agent
  switch (intent) {
    case "chat":
      yield* runChatAgent(conversationHistory, {
        intent: "chat",
        providerId: routedProviderId,
        modelId: routedModelId,
        customApiKey: config.customApiKey,
        signal: config.signal,
        customInstructions: config.customInstructions,
        projectSummary,
        persona: config.persona,
        customPersonaPrompt: config.customPersonaPrompt,
        memoryContext,
      } satisfies ChatAgentConfig);
      break;

    case "explore":
      yield* runExploreAgent(conversationHistory, {
        providerId: routedProviderId,
        modelId: routedModelId,
        customApiKey: config.customApiKey,
        signal: config.signal,
        customInstructions: config.customInstructions,
        projectSummary,
        persona: config.persona,
        customPersonaPrompt: config.customPersonaPrompt,
        memoryContext,
      } satisfies ExploreAgentConfig);
      break;

    case "code": {
      // ─── Intelligent Decisions ──────────────────────────

      // TDD Decision: use TDD only when project has a test runner
      // AND the request implies creating/modifying testable code.
      // El harness engine (strictTDD) puede haber decidido ya (VL-3).
      const useTDD = harnessUseTDD !== undefined
        ? harnessUseTDD
        : decideTDD(userText, config.testRunner ?? null);

      // Delivery Decision: based on git presence and change scope.
      // El harness engine (deliveryStrategy) puede haber decidido ya.
      // Solo mapear si el harness dio una estrategia soportada por el
      // build-agent (direct | feature-branch | pr).
      const harnessDeliveryMapped =
        harnessDelivery === "direct" || harnessDelivery === "feature-branch" || harnessDelivery === "pr"
          ? harnessDelivery
          : undefined;
      const delivery = harnessDeliveryMapped ?? decideDelivery(userText, config.hasGit ?? false);

      yield* runBuildAgent(conversationHistory, {
        providerId: routedProviderId,
        modelId: routedModelId,
        customApiKey: config.customApiKey,
        signal: config.signal,
        customInstructions: config.customInstructions,
        projectSummary,
        persona: config.persona,
        customPersonaPrompt: config.customPersonaPrompt,
        testRunner: config.testRunner,
        executionMode: config.executionMode,
        useTDD,
        deliveryStrategy: delivery,
        memoryContext,
      } satisfies BuildAgentConfig);
      break;
    }
  }
}

/**
 * Maps an intent to its initial phase for the UI.
 */
function intentToPhase(intent: IntentClass): AgentPhase {
  switch (intent) {
    case "chat":
      return "chatting";
    case "explore":
      return "thinking";
    case "code":
      return "planning";
  }
}

// ─── Decision Logic ────────────────────────────────────────────

/**
 * Decides whether to use TDD for this request.
 *
 * Uses TDD when:
 * - Project has a test runner detected
 * - The request involves creating new features or fixing bugs
 *
 * Does NOT use TDD when:
 * - No test runner available
 * - Request is about styling, docs, config, or refactoring
 * - Request explicitly says "sin tests" or "no tests"
 */
export function decideTDD(
  userText: string,
  testRunner: string | null
): boolean {
  // No test runner → no TDD, period
  if (!testRunner) return false;

  const lower = userText.toLowerCase();

  // User explicitly opts out
  if (
    lower.includes("sin test") ||
    lower.includes("no test") ||
    lower.includes("sin prueba") ||
    lower.includes("no prueba")
  ) {
    return false;
  }

  // Styling/docs/config — no TDD needed
  const noTDDPatterns = [
    "estilo", "css", "color", "fuente", "diseño visual",
    "readme", "documentación", "documentacion",
    "configuración", "configuracion", ".env",
    "renombrar", "mover archivo",
  ];
  if (noTDDPatterns.some((p) => lower.includes(p))) return false;

  // Feature creation, bug fixes, logic changes → TDD recommended
  const tddPatterns = [
    "crear", "nuevo", "nueva", "implementar", "agregar", "añadir",
    "bug", "fix", "arreglar", "corregir",
    "lógica", "logica", "función", "funcion", "servicio", "hook",
    "test", "prueba", "validar",
  ];
  if (tddPatterns.some((p) => lower.includes(p))) return true;

  // Default: no TDD (conservative — don't force it)
  return false;
}

/**
 * Decides the delivery strategy for changes.
 *
 * - `"direct"`: Apply changes directly to the working tree (no git)
 * - `"feature-branch"`: Create a feature branch for the changes
 * - `"pr"`: Create a PR-ready branch (for larger changes)
 */
export function decideDelivery(
  userText: string,
  hasGit: boolean
): DeliveryStrategy {
  // No git → always direct
  if (!hasGit) return "direct";

  const lower = userText.toLowerCase();

  // User explicitly requests PR/branch
  if (
    lower.includes("pull request") ||
    lower.includes("pr ") ||
    lower.includes("branch")
  ) {
    return "pr";
  }

  // Large-scope indicators → feature branch
  const largeScopePatterns = [
    "sistema", "módulo", "modulo", "migrar", "migración",
    "refactor completo", "reescribir", "arquitectura",
    "múltiples archivos", "multiples archivos",
  ];
  if (largeScopePatterns.some((p) => lower.includes(p))) return "feature-branch";

  // Default: direct apply
  return "direct";
}

// ─── Re-exports ────────────────────────────────────────────────

export { classifyIntent } from "./intent";
export type { AgentEvent, ExecutionMode } from "./types";
