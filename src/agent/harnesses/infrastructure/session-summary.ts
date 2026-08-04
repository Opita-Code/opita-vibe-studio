/**
 * Session Summary / Compaction Recovery Harness.
 *
 * Persiste el estado operacional de la sesión en dark-memory
 * (agent_memory, kind=context, tag=session-summary). La recuperación
 * post-compaction se hace consultando dark-memory en lugar de
 * parsear markdown con regex.
 *
 * En Vibe Studio, "compaction" = el historial del chat se trunca.
 * Este harness asegura que el estado crítico sobreviva en dark-memory.
 *
 * Sin bridge, degrada al summary markdown (compatibilidad).
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";
import type { DarkMemoryBridge } from "@opita/dark-memory-bridge";

let bridge: DarkMemoryBridge | null = null;

/** Inyecta el bridge (se llama una vez al arrancar el app). */
export function setSessionBridge(b: DarkMemoryBridge | null): void {
  bridge = b;
}

/** Clave de memoria para el summary de sesión. */
export const SESSION_SUMMARY_TITLE = "session-summary";

export const sessionSummaryHarness: Harness = {
  id: "session-summary",
  name: "Session Summary Manager",
  phase: "post-execute",
  priority: 95, // Very late — after everything else

  shouldActivate(_ctx: Readonly<HarnessContext>): boolean {
    return true;
  },

  async execute(ctx: Readonly<HarnessContext>): Promise<HarnessResult> {
    if (!bridge) {
      return {
        block: false,
        contextUpdates: {},
        summary: "Session state tracked for potential recovery (sin bridge)",
      };
    }

    const summary = generateSessionSummary(ctx);
    const phase = ctx.currentPhase ?? "session";

    try {
      await bridge.save({
        kind: "context",
        title: `${SESSION_SUMMARY_TITLE}/${phase}`,
        content: summary,
        tags: `session-summary,${phase}`,
        memory_type: "episodic",
      });
      return {
        block: false,
        contextUpdates: {},
        summary: `Session state persisted in dark-memory (fase ${phase})`,
      };
    } catch (err: unknown) {
      console.warn("[session-summary] persist falló:", err);
      return {
        block: false,
        contextUpdates: {},
        summary: "Session state not persisted (dark-memory no disponible)",
      };
    }
  },
};

/**
 * Recupera el último session summary de dark-memory.
 * Reemplaza a extractRecoveryState() (regex sobre markdown).
 * Devuelve null si no hay bridge o no existe.
 */
export async function loadRecoveryState(
  bridgeInstance: DarkMemoryBridge | null = bridge,
): Promise<HarnessContext["retrievedMemories"][number] | null> {
  if (!bridgeInstance) return null;
  try {
    const hits = await bridgeInstance.recall({
      query: "session-summary",
      operator: bridgeInstance.operator,
      kind: "context",
      limit: 1,
    });
    return hits.length > 0 ? hits[0] : null;
  } catch (err: unknown) {
    console.warn("[session-summary] loadRecoveryState falló:", err);
    return null;
  }
}

/**
 * Genera un session summary del contexto actual.
 * Mantiene el formato markdown (legible por humanos), pero la
 * persistencia/recuperación real ya no depende de parsearlo.
 */
export function generateSessionSummary(ctx: Readonly<HarnessContext>): string {
  const lines: string[] = [
    `## Session State`,
    ``,
    `### Project`,
    `- Stack: [${ctx.project.stack.join(", ")}]`,
    `- Test runner: ${ctx.project.testRunner ?? "none"}`,
    `- Package manager: ${ctx.project.packageManager ?? "none"}`,
    `- Git: ${ctx.project.hasGit ? "yes" : "no"}`,
    ``,
    `### Execution`,
    `- Intent: ${ctx.intent ?? "none"}`,
    `- Mode: ${ctx.executionMode}`,
    `- TDD: ${ctx.useTDD ? "active" : "inactive"}`,
    `- Delivery: ${ctx.deliveryStrategy}`,
    `- Artifact store: ${ctx.artifactStore}`,
    ``,
    `### SDD State`,
    `- Current phase: ${ctx.currentPhase ?? "none"}`,
    `- Completed: [${ctx.completedPhases.join(", ")}]`,
    ``,
    `### Skills`,
    `- Resolved: ${ctx.resolvedSkills.length} skills`,
    `- Resolution: ${ctx.skillResolution}`,
    ``,
    `### Harness Trace`,
    ...ctx.harnessTrace
      .filter((t) => t.activated)
      .map((t) => `- ${t.harnessId}: ${t.result} (${t.durationMs.toFixed(1)}ms)`),
  ];

  return lines.join("\n");
}

/**
 * Extrae estado de recuperación de un summary markdown.
 *
 * @deprecated — el camino canónico es loadRecoveryState() contra
 * dark-memory. Se mantiene para compatibilidad con tests/consumidores
 * existentes; los nuevos consumidores deben usar dark-memory.
 */
export function extractRecoveryState(summary: string): {
  completedPhases: string[];
  currentPhase?: string;
  artifactStore?: string;
} {
  const phases: string[] = [];
  let currentPhase: string | undefined;
  let artifactStore: string | undefined;

  const completedMatch = summary.match(/Completed:\s*\[([^\]]*)\]/);
  if (completedMatch?.[1]) {
    phases.push(...completedMatch[1].split(",").map((s) => s.trim()).filter(Boolean));
  }

  const currentMatch = summary.match(/Current phase:\s*(\S+)/);
  if (currentMatch?.[1] && currentMatch[1] !== "none") {
    currentPhase = currentMatch[1];
  }

  const storeMatch = summary.match(/Artifact store:\s*(\S+)/);
  if (storeMatch?.[1] && storeMatch[1] !== "none") {
    artifactStore = storeMatch[1];
  }

  return { completedPhases: phases, currentPhase, artifactStore };
}
