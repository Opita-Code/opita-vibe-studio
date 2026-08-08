/**
 * Harness unit tests (part 2) — continuity, isolation, dependencies,
 * engram helpers, skill registry.
 *
 * Ejecutar: npx vitest run src/agent/harnesses/__tests__/misc-harnesses2.test.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import { DarkMemoryBridge } from "@opita/dark-memory-bridge";
import { createDefaultContext } from "../types";
import {
  applyContinuityHarness,
  mergeProgress,
  generateContinuityInstructions,
} from "../quality/apply-continuity";
import {
  profileIsolationHarness,
  validateContextIsolation,
} from "../infrastructure/profile-isolation";
import {
  artifactDependencyHarness,
  createArtifactRef,
  checkArtifactReadiness,
} from "../phases/artifact-dependency";
import {
  engramMemoryHarness,
  setEngramBridge,
  buildRetrievalPlan,
  getPersistenceTarget,
  generatePersistenceInstructions,
} from "../phases/engram-memory";
import {
  skillRegistryHarness,
  setSkillBridge,
  resolveSkills,
  learnSkill,
  generateProjectStandards,
} from "../skills/skill-registry";

// ─── apply-continuity ──────────────────────────────────────────

describe("apply-continuity", () => {
  it("shouldActivate solo en fase apply", () => {
    const ctx = { ...createDefaultContext("x", "pro"), currentPhase: "apply" as const };
    expect(applyContinuityHarness.shouldActivate(ctx)).toBe(true);
    expect(applyContinuityHarness.shouldActivate({ ...ctx, currentPhase: "spec" as const })).toBe(false);
  });

  it("execute con progreso existente", async () => {
    const ctx = {
      ...createDefaultContext("x", "pro"),
      currentPhase: "apply" as const,
      artifacts: { "apply-progress": { type: "apply-progress" as const, topicKey: "sdd/x/apply-progress" } },
    };
    const res = await applyContinuityHarness.execute(ctx);
    expect(res.block).toBe(false);
    expect(res.summary).toContain("merge");
  });

  it("execute sin progreso existente", async () => {
    const ctx = { ...createDefaultContext("x", "pro"), currentPhase: "apply" as const, artifacts: {} };
    const res = await applyContinuityHarness.execute(ctx);
    expect(res.summary).toContain("starting fresh");
  });

  it("mergeProgress re-marca tareas previas completadas", () => {
    const existing = "- [x] 1.1 auth\n- [x] 2.1 tests\n";
    const newProgress = "- [ ] 1.1 auth\n- [ ] 1.2 routes\n";
    const merged = mergeProgress(existing, newProgress);
    expect(merged).toContain("[x] 1.1");
    expect(merged).toContain("[ ] 1.2");
  });

  it("generateContinuityInstructions vacío sin tareas", () => {
    expect(generateContinuityInstructions([])).toBe("");
  });

  it("generateContinuityInstructions lista tareas", () => {
    const instr = generateContinuityInstructions(["1.1", "2.1"]);
    expect(instr).toContain("1.1");
    expect(instr).toContain("SKIP estas tareas");
  });
});

// ─── profile-isolation ─────────────────────────────────────────

describe("profile-isolation", () => {
  it("siempre activa", () => {
    expect(profileIsolationHarness.shouldActivate(createDefaultContext("x", "pro"))).toBe(true);
  });

  it("execute verifica limpieza", async () => {
    const res = await profileIsolationHarness.execute(createDefaultContext("hola", "pro"));
    expect(res.block).toBe(false);
    expect(res.summary).toContain("verified");
  });

  it("execute detecta contaminación por harnessTrace", async () => {
    const ctx = { ...createDefaultContext("hola", "pro"), harnessTrace: [{ harnessId: "x", phase: "pre-classify" as const, activated: true, durationMs: 1, result: "pass" as const }] };
    const res = await profileIsolationHarness.execute(ctx);
    expect(res.summary).toContain("contamination");
  });

  it("validateContextIsolation con fallos", () => {
    expect(validateContextIsolation(createDefaultContext("", "pro"))).toBe(false);
    const ctx = { ...createDefaultContext("x", "pro"), harnessTrace: [{ harnessId: "y", phase: "pre-classify" as const, activated: true, durationMs: 1, result: "pass" as const }] };
    expect(validateContextIsolation(ctx)).toBe(false);
  });
});

// ─── artifact-dependency ───────────────────────────────────────

describe("artifact-dependency", () => {
  it("shouldActivate con currentPhase", () => {
    expect(artifactDependencyHarness.shouldActivate({ ...createDefaultContext("x", "pro"), currentPhase: "tasks" as const })).toBe(true);
    expect(artifactDependencyHarness.shouldActivate(createDefaultContext("x", "pro"))).toBe(false);
  });

  it("execute sin artefactos requeridos", async () => {
    const res = await artifactDependencyHarness.execute({ ...createDefaultContext("x", "pro"), currentPhase: "propose" as const });
    expect(res.block).toBe(false);
    expect(res.summary).toContain("no required artifacts");
  });

  it("execute bloquea con artefactos faltantes", async () => {
    const res = await artifactDependencyHarness.execute({ ...createDefaultContext("x", "pro"), currentPhase: "tasks" as const, artifacts: {} });
    expect(res.block).toBe(true);
    expect(res.blockReason).toContain("spec");
    expect(res.blockReason).toContain("design");
  });

  it("execute pasa con artefactos presentes", async () => {
    const res = await artifactDependencyHarness.execute({
      ...createDefaultContext("x", "pro"),
      currentPhase: "tasks" as const,
      artifacts: {
        spec: { type: "spec", topicKey: "sdd/x/spec" },
        design: { type: "design", topicKey: "sdd/x/design" },
      },
    });
    expect(res.block).toBe(false);
    expect(res.summary).toContain("All required artifacts present");
  });

  it("createArtifactRef construye ref", () => {
    const ref = createArtifactRef("apply-progress", "login", "/tmp/apply.md", 42);
    expect(ref.topicKey).toBe("sdd/login/apply-progress");
    expect(ref.filePath).toBe("/tmp/apply.md");
    expect(ref.observationId).toBe(42);
  });

  it("checkArtifactReadiness", () => {
    expect(checkArtifactReadiness("tasks", { spec: { type: "spec", topicKey: "k" }, design: { type: "design", topicKey: "k2" } }).ready).toBe(true);
    const r = checkArtifactReadiness("tasks", { spec: { type: "spec", topicKey: "k" } });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["design"]);
  });
});

// ─── engram-memory helpers ─────────────────────────────────────

describe("engram-memory", () => {
  afterEach(() => setEngramBridge(null));

  it("shouldActivate solo con engram/hybrid", () => {
    expect(engramMemoryHarness.shouldActivate({ ...createDefaultContext("x", "pro"), artifactStore: "engram" as const })).toBe(true);
    expect(engramMemoryHarness.shouldActivate({ ...createDefaultContext("x", "pro"), artifactStore: "hybrid" as const })).toBe(true);
    expect(engramMemoryHarness.shouldActivate({ ...createDefaultContext("x", "pro"), artifactStore: "none" as const })).toBe(false);
  });

  it("sin bridge → solo plan", async () => {
    setEngramBridge(null);
    const res = await engramMemoryHarness.execute({ ...createDefaultContext("x", "pro"), artifactStore: "engram" as const, currentPhase: "apply" as const });
    expect(res.block).toBe(false);
    expect(res.summary).toContain("sin bridge");
  });

  it("sin bridge y sin plan → no artifacts", async () => {
    setEngramBridge(null);
    const res = await engramMemoryHarness.execute({ ...createDefaultContext("x", "pro"), artifactStore: "engram" as const });
    expect(res.summary).toContain("no artifacts");
  });

  it("con bridge y memories → retrievedMemories", async () => {
    const bridge = new DarkMemoryBridge({ operator: "op", projectId: "p", transport: "memory" });
    setEngramBridge(bridge);
    await bridge.save({ kind: "finding", title: "Diseño del módulo", content: "design del sistema con eventos DDD", tags: "sdd,x,design" });
    const res = await engramMemoryHarness.execute({ ...createDefaultContext("x", "pro"), artifactStore: "engram" as const, currentPhase: "apply" as const, retrievedMemories: [] });
    expect(res.summary).toContain("memories recuperadas");
    expect((res.contextUpdates.retrievedMemories ?? []).length).toBeGreaterThan(0);
    await bridge.close();
  });

  it("con bridge sin memories → sin relevantes", async () => {
    const bridge = new DarkMemoryBridge({ operator: "op", projectId: "p2", transport: "memory" });
    setEngramBridge(bridge);
    const res = await engramMemoryHarness.execute({ ...createDefaultContext("x", "pro"), artifactStore: "hybrid" as const, currentPhase: "verify" as const, retrievedMemories: [] });
    expect(res.summary).toContain("sin memories");
    await bridge.close();
  });

  it("buildRetrievalPlan por fase", () => {
    const ctx = { ...createDefaultContext("x", "pro"), artifactStore: "engram" as const } as const;
    expect(buildRetrievalPlan({ ...ctx, currentPhase: undefined })).toEqual([]);
    expect(buildRetrievalPlan({ ...ctx, currentPhase: "tasks" as const })).toEqual(["spec", "design"]);
    expect(buildRetrievalPlan({ ...ctx, currentPhase: "archive" as const }).length).toBe(6);
    expect(buildRetrievalPlan({ ...ctx, currentPhase: "explore" as const })).toEqual([]);
  });

  it("getPersistenceTarget", () => {
    expect(getPersistenceTarget("apply")).toBe("apply-progress");
    expect(getPersistenceTarget("verify")).toBe("verify-report");
    expect(getPersistenceTarget("explore")).toBe("explore");
    expect(getPersistenceTarget(undefined)).toBeNull();
  });

  it("generatePersistenceInstructions", () => {
    const instr = generatePersistenceInstructions("login", "spec", "engram");
    expect(instr).toContain("sdd/login/spec");
    expect(generatePersistenceInstructions("login", "spec", "none")).toBe("");
    expect(generatePersistenceInstructions("login", undefined, "engram")).toBe("");
  });
});

// ─── skill-registry ────────────────────────────────────────────

describe("skill-registry", () => {
  afterEach(() => setSkillBridge(null));

  it("shouldActivate code/explore", () => {
    expect(skillRegistryHarness.shouldActivate({ ...createDefaultContext("x", "pro"), intent: "code" as const })).toBe(true);
    expect(skillRegistryHarness.shouldActivate({ ...createDefaultContext("x", "pro"), intent: "chat" as const })).toBe(false);
  });

  it("execute resuelve skills y marca injected", async () => {
    const res = await skillRegistryHarness.execute({ ...createDefaultContext("crear un componente react", "pro"), intent: "code" as const, project: { ...createDefaultContext("", "pro").project, stack: [] } });
    expect(res.block).toBe(false);
    expect((res.contextUpdates.resolvedSkills ?? []).length).toBeGreaterThan(0);
    expect(res.contextUpdates.skillResolution).toBe("injected");
  });

  it("execute con bridge carga skills dinámicas", async () => {
    const bridge = new DarkMemoryBridge({ operator: "op", projectId: "psk", transport: "memory" });
    setSkillBridge(bridge);
    await bridge.save({ kind: "context", title: "my-skill", content: JSON.stringify({ triggers: ["custom-tool"], compactRules: "usa la tool" }), tags: "skill,my-skill" });
    const res = await skillRegistryHarness.execute({ ...createDefaultContext("usa custom-tool", "pro"), intent: "code" as const, project: { ...createDefaultContext("", "pro").project, stack: [] } });
    expect((res.contextUpdates.resolvedSkills ?? []).some((s) => s.id === "my-skill")).toBe(true);
    await bridge.close();
  });

  it("resolveSkills matchea por stack", () => {
    const matched = resolveSkills("haz el layout", ["tailwindcss", "react"]);
    expect(matched.some((s) => s.id === "tailwind-patterns")).toBe(true);
    expect(matched.some((s) => s.id === "react-patterns")).toBe(true);
  });

  it("resolveSkills sin match → vacío", () => {
    expect(resolveSkills("xyz", [])).toEqual([]);
  });

  it("learnSkill sin bridge → false", async () => {
    expect(await learnSkill(null, { id: "x", name: "X", triggers: [], compactRules: "r" })).toBe(false);
  });

  it("learnSkill con bridge → true y recall", async () => {
    const bridge = new DarkMemoryBridge({ operator: "op", projectId: "pl", transport: "memory" });
    const ok = await learnSkill(bridge, { id: "eslint-strict", name: "ESLint", triggers: ["eslint"], compactRules: "no anys" });
    expect(ok).toBe(true);
    const hits = await bridge.list({ kind: "context", tag: "skill" });
    expect(hits.length).toBe(1);
    await bridge.close();
  });

  it("generateProjectStandards", () => {
    expect(generateProjectStandards([])).toBe("");
    const out = generateProjectStandards([{ id: "1", name: "React", triggers: [], compactRules: "Functional components" }]);
    expect(out).toContain("React");
    expect(out).toContain("Functional components");
  });
});
