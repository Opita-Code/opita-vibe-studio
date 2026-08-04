/**
 * Dark Memory Persist Harness — Persistencia post-ejecución.
 *
 * Corre en post-execute y guarda decisiones, hallazgos y artefactos
 * en dark-memory después de cada ejecución del agente. El kind
 * canónico se deriva del resultado: decision (model routing /
 * delivery), finding (verify / explore), todo (si hay follow-ups).
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";
import type { DarkMemoryBridge, MemoryKind } from "@opita/dark-memory-bridge";

let bridge: DarkMemoryBridge | null = null;

/** Inyecta el bridge (se llama una vez al arrancar el app). */
export function setDarkMemoryPersistBridge(b: DarkMemoryBridge | null): void {
  bridge = b;
}

export const darkMemoryPersistHarness: Harness = {
  id: "dark-memory-persist",
  name: "Dark Memory Persist",
  phase: "post-execute",
  priority: 85, // Después de verify (20) y rollback (80) — antes de result-contract (90)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Solo cuando hay persistencia activa (no free).
    return ctx.artifactStore === "engram" || ctx.artifactStore === "hybrid";
  },

  async execute(ctx: Readonly<HarnessContext>): Promise<HarnessResult> {
    if (!bridge) {
      return {
        block: false,
        contextUpdates: {},
        summary: "dark-memory: bridge no disponible, sin persistir",
      };
    }

    const payload = buildPersistencePayload(ctx);
    if (!payload) {
      return {
        block: false,
        contextUpdates: {},
        summary: "dark-memory: nada que persistir",
      };
    }

    try {
      await bridge.save({
        kind: payload.kind,
        title: payload.title,
        content: payload.content,
        tags: payload.tags,
        memory_type: "episodic",
      });
      return {
        block: false,
        contextUpdates: {},
        summary: `dark-memory: ${payload.kind} persistido`,
      };
    } catch (err: unknown) {
      console.warn("[dark-memory-persist] save falló:", err);
      return {
        block: false,
        contextUpdates: {},
        summary: "dark-memory: persist falló (degradado)",
      };
    }
  },
};

interface PersistencePayload {
  kind: MemoryKind;
  title: string;
  content: string;
  tags: string;
}

/**
 * Construye el payload de persistencia a partir del contexto.
 * Deriva kind según qué cambió en la ejecución.
 */
export function buildPersistencePayload(
  ctx: Readonly<HarnessContext>,
): PersistencePayload | null {
  // Sin intent → nada que persistir (puro chat de contexto).
  if (!ctx.intent) return null;

  const phase = ctx.currentPhase ?? "general";
  const title = `Aura: ${ctx.userText.slice(0, 80)}`;

  // Qué persistir según el estado del contexto.
  const sections: string[] = [];

  if (ctx.model.providerId && ctx.model.modelId) {
    sections.push(`Modelo: ${ctx.model.providerId}/${ctx.model.modelId} (byok: ${ctx.model.byok})`);
  }

  if (ctx.delegationReason) {
    sections.push(`Delegación: ${ctx.shouldDelegate ? "sí" : "no"} — ${ctx.delegationReason}`);
  }

  if (ctx.deliveryStrategy) {
    sections.push(`Delivery: ${ctx.deliveryStrategy}`);
  }

  if (ctx.resolvedSkills.length > 0) {
    sections.push(`Skills: ${ctx.resolvedSkills.map((s) => s.id).join(", ")}`);
  }

  if (ctx.completedPhases.length > 0) {
    sections.push(`Fases completadas: ${ctx.completedPhases.join(", ")}`);
  }

  if (ctx.blocked) {
    sections.push(`BLOQUEADO: ${ctx.blockReason ?? "sin razón"}`);
  }

  if (sections.length === 0) {
    return null;
  }

  const tags = `aura,${phase},${ctx.intent}`;

  // Derivar kind canónico.
  let kind: MemoryKind = "note";
  if (ctx.blocked) kind = "observation";
  else if (ctx.intent === "explore") kind = "finding";
  else if (ctx.deliveryStrategy && ctx.deliveryStrategy !== "direct") kind = "decision";
  else if (ctx.useTDD) kind = "decision";

  return {
    kind,
    title,
    content: sections.join("\n"),
    tags,
  };
}
