/**
 * Dark-memory integration harnesses — unit tests.
 *
 * Verifica:
 *  - dark-memory-context: recall real inyecta retrievedMemories
 *  - dark-memory-persist: deriva kind canónico + persiste
 *  - engram-memory con bridge: recall por topic keys
 *  - session-summary con bridge: persiste state en dark-memory
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DarkMemoryBridge } from "@opita/dark-memory-bridge";
import { createDefaultContext } from "../types";
import { engramMemoryHarness, setEngramBridge } from "../phases/engram-memory";
import {
  darkMemoryContextHarness,
  setDarkMemoryContextBridge,
} from "../infrastructure/dark-memory-context";
import {
  darkMemoryPersistHarness,
  buildPersistencePayload,
  setDarkMemoryPersistBridge,
} from "../infrastructure/dark-memory-persist";
import {
  sessionSummaryHarness,
  loadRecoveryState,
  setSessionBridge,
} from "../infrastructure/session-summary";

const OPERATOR = "aura-test";
const PROJECT = "proyecto-demo";

function makeBridge() {
  return new DarkMemoryBridge({
    operator: OPERATOR,
    projectId: PROJECT,
    transport: "memory",
  });
}

function baseContext(userText: string) {
  const ctx = createDefaultContext(userText, "pro");
  return {
    ...ctx,
    intent: "code" as const,
    artifactStore: "engram" as const,
    currentPhase: "apply" as const,
    completedPhases: ["propose", "spec", "design", "tasks"] as Array<"propose" | "spec" | "design" | "tasks">,
    project: { ...ctx.project, isOpen: true, stack: ["react", "typescript"] },
  };
}

describe("dark-memory harnesses", () => {
  let bridge: DarkMemoryBridge;

  beforeEach(() => {
    bridge = makeBridge();
    setEngramBridge(bridge);
    setDarkMemoryContextBridge(bridge);
    setDarkMemoryPersistBridge(bridge);
    setSessionBridge(bridge);
  });

  afterEach(async () => {
    setEngramBridge(null);
    setDarkMemoryContextBridge(null);
    setDarkMemoryPersistBridge(null);
    setSessionBridge(null);
    await bridge.close();
  });

  describe("dark-memory-context (pre-execute)", () => {
    it("recupera memories relevantes y las inyecta", async () => {
      await bridge.save({
        kind: "decision",
        title: "Auth OCAIS",
        content: "Decidimos usar OCAIS como única fuente de verdad.",
        tags: "auth,ocais",
      });

      const result = await darkMemoryContextHarness.execute(
        baseContext("¿cómo implementamos auth OCAIS?"),
      );

      expect(result.block).toBe(false);
      expect(result.contextUpdates.retrievedMemories).toHaveLength(1);
      expect(result.contextUpdates.retrievedMemories![0].kind).toBe("decision");
    });

    it("no se activa para artifactStore none", () => {
      const ctx = { ...baseContext("hola"), artifactStore: "none" as const };
      expect(darkMemoryContextHarness.shouldActivate(ctx)).toBe(false);
    });

    it("degrada sin bridge", async () => {
      setDarkMemoryContextBridge(null);
      const result = await darkMemoryContextHarness.execute(baseContext("hola"));
      expect(result.block).toBe(false);
      expect(result.contextUpdates.retrievedMemories).toBeUndefined();
    });
  });

  describe("dark-memory-persist (post-execute)", () => {
    it("persiste decision tras ejecución con delivery", async () => {
      const ctx = {
        ...baseContext("refactorizar billing"),
        deliveryStrategy: "feature-branch" as const,
        model: { providerId: "deepseek", modelId: "deepseek-v4-pro", byok: false },
      };

      const result = await darkMemoryPersistHarness.execute(ctx);
      expect(result.block).toBe(false);
      expect(result.summary).toContain("persistido");

      const hits = await bridge.recall({ query: "billing refactorizar", operator: OPERATOR });
      expect(hits.length).toBe(1);
      expect(hits[0].kind).toBe("decision");
    });

    it("deriva kind finding para explore", () => {
      const ctx = {
        ...baseContext("explorar estructura"),
        intent: "explore" as const,
      };
      const payload = buildPersistencePayload(ctx);
      expect(payload?.kind).toBe("finding");
    });

    it("devuelve null sin intent", () => {
      const ctx = baseContext("hola");
      const payload = buildPersistencePayload({ ...ctx, intent: undefined });
      expect(payload).toBeNull();
    });
  });

  describe("engram-memory con bridge", () => {
    it("recupera memories por topic keys del plan", async () => {
      await bridge.save({
        kind: "finding",
        title: "sdd/mi-cambio/design",
        content: "El diseño usa eventos DDD.",
        tags: "sdd,mi-cambio,design",
      });

      const ctx = baseContext("continuar SDD");
      const result = await engramMemoryHarness.execute(ctx);

      expect(result.block).toBe(false);
      // apply → topics: tasks, spec, design, apply-progress
      expect(result.summary).toContain("memories recuperadas");
      const memories = result.contextUpdates.retrievedMemories ?? [];
      expect(memories.some((m) => m.title.includes("design"))).toBe(true);
    });
  });

  describe("session-summary con bridge", () => {
    it("persiste el resumen en dark-memory", async () => {
      const result = await sessionSummaryHarness.execute(baseContext("trabajo"));
      expect(result.summary).toContain("persisted");

      const state = await loadRecoveryState();
      expect(state).not.toBeNull();
      expect(state?.content).toContain("## Session State");
    });

    it("loadRecoveryState devuelve null sin bridge", async () => {
      setSessionBridge(null);
      const state = await loadRecoveryState();
      expect(state).toBeNull();
    });
  });
});
