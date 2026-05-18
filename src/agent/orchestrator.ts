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
import type { Message } from "@/lib/types";
import { classifyIntent } from "./intent";
import { runChatAgent, type ChatAgentConfig } from "./chat-agent";
import { runExploreAgent, type ExploreAgentConfig } from "./explore-agent";
import { runBuildAgent, type BuildAgentConfig } from "./build-agent";
import { getProjectSummary } from "@/tools/executor";
import { selectModel } from "./model-router";

// ─── Config ────────────────────────────────────────────────────

/** How the agent delivers changes */
export type DeliveryStrategy = "direct" | "pr" | "feature-branch";

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
  /** Whether git is initialized in the project */
  hasGit?: boolean;
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
  const intent = classifyIntent(userText, config.hasProjectOpen);

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
      } satisfies ExploreAgentConfig);
      break;

    case "code": {
      // ─── Intelligent Decisions ──────────────────────────

      // TDD Decision: use TDD only when project has a test runner
      // AND the request implies creating/modifying testable code
      const useTDD = decideTDD(
        userText,
        config.testRunner ?? null
      );

      // Delivery Decision: based on git presence and change scope
      const delivery = decideDelivery(
        userText,
        config.hasGit ?? false
      );

      yield* runBuildAgent(conversationHistory, {
        providerId: routedProviderId,
        modelId: routedModelId,
        customApiKey: config.customApiKey,
        signal: config.signal,
        customInstructions: config.customInstructions,
        projectSummary,
        testRunner: config.testRunner,
        executionMode: config.executionMode,
        useTDD,
        deliveryStrategy: delivery,
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
