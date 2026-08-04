/**
 * Dark Memory Context Harness — Recuperación de contexto antes de ejecutar.
 *
 * Corre en pre-execute y carga memories relevantes de dark-memory
 * (BM25 recall sobre el mensaje del usuario) para que el prompt
 * composer las inyecte. Previene que Aura contradiga decisiones
 * previas o redescubra lo ya resuelto.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";
import type { DarkMemoryBridge } from "@opita/dark-memory-bridge";

let bridge: DarkMemoryBridge | null = null;

/** Inyecta el bridge (se llama una vez al arrancar el app). */
export function setDarkMemoryContextBridge(b: DarkMemoryBridge | null): void {
  bridge = b;
}

export const darkMemoryContextHarness: Harness = {
  id: "dark-memory-context",
  name: "Dark Memory Context Loader",
  phase: "pre-execute",
  priority: 15, // Después de artifact-dependency (15) — antes de engram-memory (20)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Solo cuando hay persistencia activa (no free).
    return ctx.artifactStore === "engram" || ctx.artifactStore === "hybrid";
  },

  async execute(ctx: Readonly<HarnessContext>): Promise<HarnessResult> {
    if (!bridge) {
      return {
        block: false,
        contextUpdates: {},
        summary: "dark-memory: bridge no disponible, sin contexto",
      };
    }

    try {
      const hits = await bridge.recall({
        query: ctx.userText,
        operator: bridge.operator,
        limit: 5,
      });

      const memories = hits.map((hit) => ({
        id: hit.id,
        kind: hit.kind,
        title: hit.title,
        content: hit.content,
        tags: hit.tags,
        rank: hit.rank,
      }));

      return {
        block: false,
        contextUpdates: {
          retrievedMemories: [...ctx.retrievedMemories, ...memories],
        },
        summary: memories.length > 0
          ? `dark-memory: ${memories.length} memories de contexto`
          : "dark-memory: sin memories relevantes",
      };
    } catch (err: unknown) {
      console.warn("[dark-memory-context] recall falló:", err);
      return {
        block: false,
        contextUpdates: {},
        summary: "dark-memory: recall falló (degradado)",
      };
    }
  },
};
