/**
 * Harness unit tests — coverage for low-covered harness modules.
 *
 * Cubre: artifact-grammar, skill-digestion, subagent-isolation,
 * model-routing, skill-resolution, rollback, result-contract.
 *
 * Ejecutar: npx vitest run src/agent/harnesses/__tests__/misc-harnesses.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  ARTIFACT_GRAMMAR,
  validateArtifactGrammar,
  generateArtifactTemplate,
} from "../phases/artifact-grammar";
import { digestSkills, estimateTokens, validateDigestionBudget } from "../skills/skill-digestion";
import {
  createSubagentContext,
  trimConversationForSubagent,
} from "../skills/subagent-isolation";
import {
  modelRoutingHarness,
  selectModel,
} from "../infrastructure/model-routing";
import {
  skillResolutionHarness,
  auditSkillResolution,
  shouldReloadRegistry,
} from "../skills/skill-resolution";
import { rollbackHarness, generateRollbackPlan } from "../infrastructure/rollback";
import {
  resultContractHarness,
  createPhaseEnvelope,
  validateEnvelope,
} from "../orchestration/result-contract";
import { createDefaultContext } from "../types";
import type { SkillEntry } from "../types";

// ─── artifact-grammar ──────────────────────────────────────────

describe("artifact-grammar", () => {
  it("define gramática para las 8 fases SDD", () => {
    expect(Object.keys(ARTIFACT_GRAMMAR)).toEqual([
      "explore", "propose", "spec", "design", "tasks", "apply", "verify", "archive",
    ]);
  });

  it("validateArtifactGrammar retorna [] sin secciones faltantes", () => {
    const content = "## Context\n## Findings\n## Options";
    expect(validateArtifactGrammar("explore", content)).toEqual([]);
  });

  it("validateArtifactGrammar detecta secciones requeridas faltantes", () => {
    const content = "## Context\n";
    const missing = validateArtifactGrammar("explore", content);
    expect(missing).toContain("Findings");
  });

  it("validateArtifactGrammar ignora fases desconocidas", () => {
    expect(validateArtifactGrammar("nope" as never, "x")).toEqual([]);
  });

  it("generateArtifactTemplate genera markdown con secciones", () => {
    const tpl = generateArtifactTemplate("spec");
    expect(tpl).toContain("## Requirements");
    expect(tpl).toContain("(required)");
    expect(tpl).toContain("(optional)");
  });

  it("generateArtifactTemplate retorna '' para fase desconocida", () => {
    expect(generateArtifactTemplate("nope" as never)).toBe("");
  });
});

// ─── skill-digestion ───────────────────────────────────────────

const skills: SkillEntry[] = [
  { id: "1", name: "TypeScript", triggers: ["typescript", "ts"], compactRules: "Usa TS estricto\nEvita any\n" },
  { id: "2", name: "Testing", triggers: ["test", "prueba"], compactRules: "Escribe tests\nCubre edge cases\n" },
  { id: "3", name: "API", triggers: ["api", "endpoint"], compactRules: "REST\nVersiona endpoints" },
];

describe("skill-digestion", () => {
  it("retorna '' sin skills", () => {
    expect(digestSkills([], "cualquier cosa")).toBe("");
  });

  it("filtra skills relevantes por triggers", () => {
    const block = digestSkills(skills, "escribe tests para el endpoint");
    expect(block).toContain("Project Standards");
    expect(block).toContain("Testing");
    expect(block).toContain("API");
  });

  it("usa todos los skills si ninguno matchea", () => {
    const block = digestSkills(skills, "haz la portada del sitio");
    expect(block).toContain("TypeScript");
    expect(block).toContain("Testing");
    expect(block).toContain("API");
  });

  it("limita a 5 skills y 5 reglas por skill", () => {
    const many: SkillEntry[] = Array.from({ length: 8 }, (_, i) => ({
      id: `${i}`, name: `Skill${i}`, triggers: ["x"], compactRules: "r1\nr2\nr3\nr4\nr5\nr6\nr7\n",
    }));
    const block = digestSkills(many, "x");
    const count = (block.match(/^### /gm) ?? []).length;
    expect(count).toBe(5);
  });

  it("estimateTokens y validateDigestionBudget", () => {
    const block = digestSkills(skills, "tests");
    expect(estimateTokens(block)).toBe(Math.ceil(block.length / 4));
    const budget = validateDigestionBudget(block, 800);
    expect(budget.valid).toBe(true);
    expect(validateDigestionBudget("x".repeat(5000)).valid).toBe(false);
  });
});

// ─── subagent-isolation ────────────────────────────────────────

describe("subagent-isolation", () => {
  it("crea contexto aislado de subagente", () => {
    const ctx = {
      ...createDefaultContext("haz algo", "pro"),
      resolvedSkills: skills,
      artifactStore: "engram" as const,
      model: { providerId: "deepseek", modelId: "deepseek-v4-pro", byok: false },
    };
    const sub = createSubagentContext(ctx, "spec", "login", "escribe el spec de login");
    expect(sub.projectStandards).toContain("Project Standards");
    expect(sub.phase).toBe("spec");
    expect(sub.model.modelId).toBe("deepseek-v4-pro");
    expect(sub.artifactsToRetrieve).toContain("sdd/login/proposal");
  });

  it("sin resolvedSkills → projectStandards vacío", () => {
    const ctx = { ...createDefaultContext("x", "free"), resolvedSkills: [], artifactStore: "none" as const, model: { providerId: "g", modelId: "m", byok: false } };
    const sub = createSubagentContext(ctx, "apply", "cambio", "hazlo");
    expect(sub.projectStandards).toBe("");
    expect(sub.artifactsToRetrieve).toContain("sdd/cambio/tasks");
  });

  it("getArtifactsForPhase: archive trae todo", () => {
    const ctx = { ...createDefaultContext("x", "free"), resolvedSkills: [], artifactStore: "none" as const, model: { providerId: "g", modelId: "m", byok: false } };
    const sub = createSubagentContext(ctx, "archive", "c", "terminar");
    expect(sub.artifactsToRetrieve.length).toBe(6);
  });

  it("trimConversationForSubagent recorta mensajes", () => {
    const msgs = [{ role: "system", content: "sys" }, { role: "user", content: "1" }, { role: "user", content: "2" }, { role: "assistant", content: "3" }];
    expect(trimConversationForSubagent(msgs)).toHaveLength(4);
    const trimmed = trimConversationForSubagent(msgs, 2);
    expect(trimmed).toHaveLength(2);
    expect(trimmed[0].content).toBe("sys");
    expect(trimmed[1].content).toBe("3");
  });
});

// ─── model-routing ─────────────────────────────────────────────

describe("model-routing", () => {
  it("shouldActivate solo para code/explore", () => {
    const ctx = { ...createDefaultContext("x", "free"), intent: "code" as const };
    expect(modelRoutingHarness.shouldActivate(ctx)).toBe(true);
    expect(modelRoutingHarness.shouldActivate({ ...ctx, intent: "explore" as const })).toBe(true);
    expect(modelRoutingHarness.shouldActivate({ ...ctx, intent: "chat" as const })).toBe(false);
  });

  it("execute devuelve modelo en contextUpdates", async () => {
    const ctx = { ...createDefaultContext("x", "pro"), intent: "code" as const, currentPhase: "design" as const };
    const res = await modelRoutingHarness.execute(ctx);
    expect(res.block).toBe(false);
    expect((res.contextUpdates.model as { providerId: string }).providerId).toBeTruthy();
  });

  it("selectModel: BYOK respeta el modelo del usuario", () => {
    const m = selectModel({
      ...createDefaultContext("x", "free"),
      customApiKey: "user-key",
      requestedModelId: "gpt-4o",
    });
    expect(m.byok).toBe(true);
    expect(m.providerId).toBe("openai");
    expect(m.modelId).toBe("gpt-4o");
  });

  it("selectModel: free + shouldDelegate → bloqueado", () => {
    const m = selectModel({
      ...createDefaultContext("x", "free"),
      shouldDelegate: true,
    });
    expect(m.blocked).toBe(true);
    expect(m.blockReason).toContain("Estudiante");
  });

  it("selectModel: requestedModelId explícito", () => {
    const m = selectModel({
      ...createDefaultContext("x", "free"),
      requestedModelId: "gemini-2.5-flash",
    });
    expect(m.providerId).toBe("gemini");
    expect(m.byok).toBe(false);
  });

  it("selectModel: pro + high-cognitive phase → deepseek-v4-pro", () => {
    const m = selectModel({
      ...createDefaultContext("x", "pro"),
      currentPhase: "explore",
    });
    expect(m.modelId).toBe("deepseek-v4-pro");
  });

  it("selectModel: default → gemini flash", () => {
    const m = selectModel({ ...createDefaultContext("x", "free") });
    expect(m.modelId).toBe("gemini-2.5-flash");
  });

  it("selectModel: inferProvider variantes", () => {
    expect(selectModel({ ...createDefaultContext("x", "free"), customApiKey: "k", requestedModelId: "o1-mini" }).providerId).toBe("openai");
    expect(selectModel({ ...createDefaultContext("x", "free"), customApiKey: "k", requestedModelId: "MiniMax-M3" }).providerId).toBe("minimax");
    expect(selectModel({ ...createDefaultContext("x", "free"), customApiKey: "k", requestedModelId: "provider/model" }).providerId).toBe("openrouter");
    expect(selectModel({ ...createDefaultContext("x", "free"), customApiKey: "k", requestedModelId: "" }).modelId).toBe("deepseek-v4-flash");
  });
});

// ─── skill-resolution ──────────────────────────────────────────

describe("skill-resolution", () => {
  it("shouldActivate con resolvedSkills > 0", () => {
    expect(skillResolutionHarness.shouldActivate({ ...createDefaultContext("x", "pro"), resolvedSkills: [skills[0]] })).toBe(true);
    expect(skillResolutionHarness.shouldActivate(createDefaultContext("x", "pro"))).toBe(false);
  });

  it("auditSkillResolution: injected → healthy", () => {
    const a = auditSkillResolution("injected", 3);
    expect(a.healthy).toBe(true);
    expect(a.action).toBe("none");
    expect(a.message).toContain("3 skills");
  });

  it("auditSkillResolution: fallback-registry/path → reload", () => {
    expect(auditSkillResolution("fallback-registry", 1).action).toBe("reload-registry");
    expect(auditSkillResolution("fallback-path", 1).action).toBe("reload-registry");
  });

  it("auditSkillResolution: none con skills esperadas → warn-user", () => {
    const a = auditSkillResolution("none", 2);
    expect(a.healthy).toBe(false);
    expect(a.action).toBe("warn-user");
  });

  it("auditSkillResolution: none sin skills → healthy", () => {
    const a = auditSkillResolution("none", 0);
    expect(a.healthy).toBe(true);
  });

  it("shouldReloadRegistry por threshold", () => {
    const ok = auditSkillResolution("injected", 1);
    const bad = auditSkillResolution("fallback-registry", 1);
    expect(shouldReloadRegistry([ok, ok])).toBe(false);
    expect(shouldReloadRegistry([bad, bad])).toBe(true);
    expect(shouldReloadRegistry([bad, bad], 3)).toBe(false);
  });
});

// ─── rollback ──────────────────────────────────────────────────

describe("rollback", () => {
  it("shouldActivate con intent code + git", () => {
    const ctx = {
      ...createDefaultContext("x", "pro"),
      intent: "code" as const,
      project: { ...createDefaultContext("x", "pro").project, hasGit: true },
    };
    expect(rollbackHarness.shouldActivate(ctx)).toBe(true);
    expect(rollbackHarness.shouldActivate({ ...ctx, project: { ...ctx.project, hasGit: false } })).toBe(false);
    expect(rollbackHarness.shouldActivate({ ...ctx, intent: "chat" as const })).toBe(false);
  });

  it("execute devuelve resumen", async () => {
    const res = await rollbackHarness.execute(createDefaultContext("x", "pro"));
    expect(res.block).toBe(false);
    expect(res.summary).toContain("git");
  });

  it("generateRollbackPlan sin git", () => {
    expect(generateRollbackPlan(["a.ts"], false)).toContain("No git");
  });

  it("generateRollbackPlan sin archivos", () => {
    expect(generateRollbackPlan([], true)).toContain("No files changed");
  });

  it("generateRollbackPlan con archivos", () => {
    const plan = generateRollbackPlan(["src/a.ts", "src/b.ts"], true);
    expect(plan).toContain("git checkout -- src/a.ts src/b.ts");
    expect(plan).toContain("git stash");
    expect(plan).toContain("- `git checkout -- src/b.ts`");
  });
});

// ─── result-contract ───────────────────────────────────────────

describe("result-contract", () => {
  it("shouldActivate con currentPhase definido", () => {
    expect(resultContractHarness.shouldActivate({ ...createDefaultContext("x", "pro"), currentPhase: "spec" as const })).toBe(true);
    expect(resultContractHarness.shouldActivate(createDefaultContext("x", "pro"))).toBe(false);
  });

  it("execute agrega phase a completedPhases", async () => {
    const ctx = { ...createDefaultContext("x", "pro"), currentPhase: "propose" as const, completedPhases: [] };
    const res = await resultContractHarness.execute(ctx);
    expect((res.contextUpdates.completedPhases as string[])).toContain("propose");
    expect(res.summary).toContain("propose");
  });

  it("execute no duplica completedPhases", async () => {
    const ctx = { ...createDefaultContext("x", "pro"), currentPhase: "spec" as const, completedPhases: ["spec" as const] };
    const res = await resultContractHarness.execute(ctx);
    expect(res.contextUpdates.completedPhases).toHaveLength(1);
  });

  it("createPhaseEnvelope con defaults", () => {
    const env = createPhaseEnvelope("spec", "success", "ok");
    expect(env.artifacts).toEqual([]);
    expect(env.nextRecommended).toBe("none");
    expect(env.risks).toEqual([]);
    expect(env.skillResolution).toBe("none");
  });

  it("createPhaseEnvelope con opts", () => {
    const env = createPhaseEnvelope("spec", "partial", "x", {
      artifacts: ["a"], nextRecommended: "design", risks: ["r"], skillResolution: "injected",
    });
    expect(env.artifacts).toEqual(["a"]);
    expect(env.nextRecommended).toBe("design");
  });

  it("validateEnvelope detecta campos faltantes", () => {
    const errors = validateEnvelope({});
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it("validateEnvelope pasa envelope completo", () => {
    const env = createPhaseEnvelope("tasks", "success", "ok");
    expect(validateEnvelope(env)).toEqual([]);
  });
});
