/**
 * HarnessEngine + Core Harnesses — Unit Tests
 *
 * Tests the compositor and key harness behaviors.
 */

import { describe, it, expect } from "vitest";
import { HarnessEngine, createDefaultContext } from "../index";
import type { Harness } from "../types";

// ─── Test helpers ───────────────────────────────────────────────

function makeHarness(overrides: Partial<Harness> & Pick<Harness, "id">): Harness {
  return {
    name: overrides.id,
    phase: "pre-execute",
    priority: 100,
    shouldActivate: () => true,
    execute: () => ({ block: false, contextUpdates: {}, summary: "ok" }),
    ...overrides,
  };
}

// ─── HarnessEngine ──────────────────────────────────────────────

describe("HarnessEngine", () => {
  it("runs harnesses in priority order within a phase", async () => {
    const engine = new HarnessEngine();
    const order: string[] = [];

    engine.registerAll([
      makeHarness({
        id: "b",
        priority: 200,
        execute: () => {
          order.push("b");
          return { block: false, contextUpdates: {}, summary: "b" };
        },
      }),
      makeHarness({
        id: "a",
        priority: 100,
        execute: () => {
          order.push("a");
          return { block: false, contextUpdates: {}, summary: "a" };
        },
      }),
    ]);

    const ctx = createDefaultContext("test", "free");
    await engine.runPhase("pre-execute", ctx);

    expect(order).toEqual(["a", "b"]);
  });

  it("stops on block and sets blocked flag", async () => {
    const engine = new HarnessEngine();

    engine.registerAll([
      makeHarness({
        id: "blocker",
        priority: 10,
        execute: () => ({
          block: true,
          blockReason: "test block",
          contextUpdates: {},
        }),
      }),
      makeHarness({
        id: "never-reached",
        priority: 20,
        execute: () => {
          throw new Error("Should not reach this");
        },
      }),
    ]);

    const ctx = createDefaultContext("test", "free");
    const result = await engine.runPhase("pre-execute", ctx);

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("test block");
  });

  it("skips harnesses that don't activate", async () => {
    const engine = new HarnessEngine();
    const executed: string[] = [];

    engine.registerAll([
      makeHarness({
        id: "active",
        shouldActivate: () => true,
        execute: () => {
          executed.push("active");
          return { block: false, contextUpdates: {}, summary: "ok" };
        },
      }),
      makeHarness({
        id: "inactive",
        shouldActivate: () => false,
        execute: () => {
          executed.push("inactive");
          return { block: false, contextUpdates: {}, summary: "ok" };
        },
      }),
    ]);

    const ctx = createDefaultContext("test", "free");
    await engine.runPhase("pre-execute", ctx);

    expect(executed).toEqual(["active"]);
  });

  it("merges context updates from harnesses", async () => {
    const engine = new HarnessEngine();

    engine.register(
      makeHarness({
        id: "updater",
        execute: () => ({
          block: false,
          contextUpdates: { useTDD: true },
          summary: "enabled TDD",
        }),
      }),
    );

    const ctx = createDefaultContext("test", "pro");
    const result = await engine.runPhase("pre-execute", ctx);

    expect(result.useTDD).toBe(true);
  });

  it("records trace entries for all harnesses", async () => {
    const engine = new HarnessEngine();

    engine.registerAll([
      makeHarness({ id: "h1" }),
      makeHarness({ id: "h2", shouldActivate: () => false }),
    ]);

    const ctx = createDefaultContext("test", "free");
    const result = await engine.runPhase("pre-execute", ctx);

    expect(result.harnessTrace).toHaveLength(2);
    expect(result.harnessTrace[0].harnessId).toBe("h1");
    expect(result.harnessTrace[0].activated).toBe(true);
    expect(result.harnessTrace[0].result).toBe("pass");
    expect(result.harnessTrace[1].harnessId).toBe("h2");
    expect(result.harnessTrace[1].activated).toBe(false);
    expect(result.harnessTrace[1].result).toBe("skip");
  });

  it("inspect returns harnesses grouped by phase", () => {
    const engine = new HarnessEngine();

    engine.registerAll([
      makeHarness({ id: "pre1", phase: "pre-execute", priority: 10 }),
      makeHarness({ id: "post1", phase: "post-execute", priority: 10 }),
      makeHarness({ id: "pre2", phase: "pre-execute", priority: 5 }),
    ]);

    const inspection = engine.inspect();
    expect(inspection["pre-execute"]).toEqual(["pre2", "pre1"]);
    expect(inspection["post-execute"]).toEqual(["post1"]);
  });
});

// ─── createDefaultContext ───────────────────────────────────────

describe("createDefaultContext", () => {
  it("creates context with sensible defaults", () => {
    const ctx = createDefaultContext("crear un login", "pro");

    expect(ctx.userText).toBe("crear un login");
    expect(ctx.plan).toBe("pro");
    expect(ctx.executionMode).toBe("interactive");
    expect(ctx.useTDD).toBe(false);
    expect(ctx.deliveryStrategy).toBe("direct");
    expect(ctx.blocked).toBe(false);
    expect(ctx.harnessTrace).toEqual([]);
    expect(ctx.completedPhases).toEqual([]);
  });
});
