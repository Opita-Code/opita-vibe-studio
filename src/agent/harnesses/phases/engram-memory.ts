/**
 * Engram Memory Harness — Cross-session persistence via dark-memory.
 *
 * El núcleo de persistencia del harness Aura. Antes era solo un
 * generador de planes (retrieval plan sin fetch). Ahora ejecuta
 * recall real contra dark-memory (BM25) y deja las memorias
 * recuperadas en HarnessContext.retrievedMemories para que el
 * prompt composer las inyecte.
 *
 * El bridge se inyecta con setEngramBridge(). Sin bridge, el harness
 * degrada al comportamiento anterior (solo plan) — el pipeline no
 * se bloquea.
 *
 * NOTE: Este harness gestiona la POLÍTICA de persistencia. La
 * persistencia real por fase la ejecuta dark-memory-persist
 * (post-execute) o los sub-agentes con acceso a las tools MCP.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";
import type { DarkMemoryBridge } from "@opita/dark-memory-bridge";

let bridge: DarkMemoryBridge | null = null;

/** Inyecta el bridge (se llama una vez al arrancar el app). */
export function setEngramBridge(b: DarkMemoryBridge | null): void {
  bridge = b;
}

export const engramMemoryHarness: Harness = {
  id: "engram-memory",
  name: "Engram Memory Manager",
  phase: "pre-execute",
  priority: 20, // After artifact-dependency (15)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Active when using engram or hybrid storage
    return ctx.artifactStore === "engram" || ctx.artifactStore === "hybrid";
  },

  async execute(ctx: Readonly<HarnessContext>): Promise<HarnessResult> {
    // Build the list of artifacts to retrieve based on current phase
    const retrievalPlan = buildRetrievalPlan(ctx);

    if (!bridge) {
      return {
        block: false,
        contextUpdates: {},
        summary: retrievalPlan.length > 0
          ? `Engram retrieval plan (sin bridge): [${retrievalPlan.join(", ")}]`
          : "Engram: no artifacts to retrieve",
      };
    }

    // Ejecución real: recall por cada topic key del plan.
    const retrieved = await recallFromPlan(retrievalPlan);

    return {
      block: false,
      contextUpdates: {
        retrievedMemories: [...ctx.retrievedMemories, ...retrieved],
      },
      summary: retrieved.length > 0
        ? `Engram: ${retrieved.length} memories recuperadas de dark-memory`
        : "Engram: sin memories relevantes",
    };
  },
};

/**
 * Ejecuta agent_memory_recall por cada topic key del plan.
 * Devuelve las memorias con su rank BM25.
 */
async function recallFromPlan(
  plan: string[],
): Promise<HarnessContext["retrievedMemories"]> {
  if (!bridge || plan.length === 0) return [];

  const results: HarnessContext["retrievedMemories"] = [];

  for (const topicKey of plan) {
    try {
      const hits = await bridge.recall({
        query: topicKey,
        operator: bridge.operator,
        limit: 3,
      });
      for (const hit of hits) {
        results.push({
          id: hit.id,
          kind: hit.kind,
          title: hit.title,
          content: hit.content,
          tags: hit.tags,
          rank: hit.rank,
        });
      }
    } catch (err: unknown) {
      console.warn(`[engram] recall falló para "${topicKey}":`, err);
    }
  }

  // Dedup por id, mantener rank más alto.
  const byId = new Map<number, HarnessContext["retrievedMemories"][number]>();
  for (const r of results) {
    const existing = byId.get(r.id);
    if (!existing || r.rank > existing.rank) byId.set(r.id, r);
  }

  return [...byId.values()].sort((a, b) => b.rank - a.rank).slice(0, 10);
}

/**
 * Determina qué topic keys recuperar para la fase actual.
 * Formato: "sdd/{change-name}/{artifact-type}".
 */
export function buildRetrievalPlan(ctx: Readonly<HarnessContext>): string[] {
  if (!ctx.currentPhase) return [];
  if (ctx.artifactStore !== "engram" && ctx.artifactStore !== "hybrid") return [];

  const keys: string[] = [];

  // Phase-specific retrieval
  switch (ctx.currentPhase) {
    case "spec":
    case "design":
      keys.push("proposal");
      break;
    case "tasks":
      keys.push("spec", "design");
      break;
    case "apply":
      keys.push("tasks", "spec", "design");
      // Check for existing apply-progress (continuation)
      keys.push("apply-progress");
      break;
    case "verify":
      keys.push("spec", "tasks", "apply-progress");
      break;
    case "archive":
      keys.push("proposal", "spec", "design", "tasks", "apply-progress", "verify-report");
      break;
  }

  return keys;
}

/**
 * Determina qué artifact persistir tras ejecutar la fase.
 * Devuelve el sufijo del topic key.
 */
export function getPersistenceTarget(
  phase: HarnessContext["currentPhase"],
): string | null {
  if (!phase) return null;

  const targets: Record<string, string> = {
    explore: "explore",
    propose: "proposal",
    spec: "spec",
    design: "design",
    tasks: "tasks",
    apply: "apply-progress",
    verify: "verify-report",
    archive: "archive-report",
  };

  return targets[phase] ?? null;
}

/**
 * Genera las instrucciones de persistencia para un sub-agente.
 * Ahora usa las tools reales de dark-memory.
 */
export function generatePersistenceInstructions(
  changeName: string,
  phase: HarnessContext["currentPhase"],
  mode: HarnessContext["artifactStore"],
): string {
  if (mode === "none" || !phase) return "";

  const target = getPersistenceTarget(phase);
  if (!target) return "";

  const topicKey = `sdd/${changeName}/${target}`;

  if (mode === "engram" || mode === "hybrid") {
    return [
      `PERSISTENCE (MANDATORY — do NOT skip):`,
      `After completing your work, you MUST call:`,
      `  dark_memory_agent_memory_save(`,
      `    title: "${topicKey}",`,
      `    kind: "finding",`,
      `    tags: "sdd,${changeName},${target}",`,
      `    content: "{your full artifact markdown}"`,
      `  )`,
      `If you return without calling dark_memory_agent_memory_save, the next phase CANNOT find your artifact.`,
    ].join("\n");
  }

  return "";
}
