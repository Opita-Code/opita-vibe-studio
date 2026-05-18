/**
 * Model Router — Tests
 *
 * Verifies that selectModel() returns the correct provider+model
 * combination for every tier × action × degradation scenario.
 */

import { describe, it, expect } from "vitest";
import { selectModel, type ModelRouterInput } from "../model-router";

// ─── Helpers ───────────────────────────────────────────────────

function input(overrides: Partial<ModelRouterInput> = {}): ModelRouterInput {
  return {
    plan: "free",
    action: "chat",
    subagentId: undefined,
    modelId: undefined,
    customApiKey: undefined,
    degraded: false,
    hasGoogleAI: true,
    hasDeepSeek: true,
    ...overrides,
  };
}

// ─── Free Tier ─────────────────────────────────────────────────

describe("selectModel — Free tier", () => {
  it("routes free chat to gemini-2.5-flash when Google AI available", () => {
    const result = selectModel(input({ plan: "free", action: "chat" }));
    expect(result.providerId).toBe("gemini");
    expect(result.modelId).toBe("gemini-2.5-flash");
  });

  it("falls back to deepseek when no Google AI", () => {
    const result = selectModel(input({ plan: "free", hasGoogleAI: false }));
    expect(result.providerId).toBe("deepseek");
  });

  it("blocks subagent (SDD) action for free plan", () => {
    const result = selectModel(input({ plan: "free", action: "subagent" }));
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("upgrade");
  });

  it("allows build action for free plan", () => {
    const result = selectModel(input({ plan: "free", action: "build" }));
    expect(result.blocked).toBeFalsy();
    expect(result.providerId).toBe("gemini");
    expect(result.modelId).toBe("gemini-2.5-flash");
  });

  it("routes free build to deepseek when no Google AI", () => {
    const result = selectModel(input({ plan: "free", action: "build", hasGoogleAI: false }));
    expect(result.blocked).toBeFalsy();
    expect(result.providerId).toBe("deepseek");
  });
});

// ─── Estudiante Tier ───────────────────────────────────────────

describe("selectModel — Estudiante tier", () => {
  it("routes estudiante chat to gemini-2.5-flash", () => {
    const result = selectModel(input({ plan: "estudiante", action: "chat" }));
    expect(result.providerId).toBe("gemini");
    expect(result.modelId).toBe("gemini-2.5-flash");
  });

  it("routes estudiante subagent to gemini-2.5-flash", () => {
    const result = selectModel(input({ plan: "estudiante", action: "subagent", subagentId: "sdd-apply" }));
    expect(result.providerId).toBe("gemini");
    expect(result.modelId).toBe("gemini-2.5-flash");
  });

  it("allows subagent action", () => {
    const result = selectModel(input({ plan: "estudiante", action: "subagent" }));
    expect(result.blocked).toBeFalsy();
  });
});

// ─── Pro Tier ──────────────────────────────────────────────────

describe("selectModel — Pro tier", () => {
  it("routes pro chat to gemini-2.5-flash by default", () => {
    const result = selectModel(input({ plan: "pro", action: "chat" }));
    expect(result.providerId).toBe("gemini");
    expect(result.modelId).toBe("gemini-2.5-flash");
  });

  it("routes high-cognitive SDD phases to deepseek-v4-pro", () => {
    const highCogPhases = ["sdd-explore", "sdd-propose", "sdd-design", "sdd-verify"];
    for (const phase of highCogPhases) {
      const result = selectModel(input({ plan: "pro", action: "subagent", subagentId: phase }));
      expect(result.providerId).toBe("deepseek");
      expect(result.modelId).toBe("deepseek-v4-pro");
    }
  });

  it("routes mechanical SDD phases to gemini-2.5-flash", () => {
    const mechPhases = ["sdd-apply", "sdd-spec", "sdd-tasks"];
    for (const phase of mechPhases) {
      const result = selectModel(input({ plan: "pro", action: "subagent", subagentId: phase }));
      expect(result.providerId).toBe("gemini");
      expect(result.modelId).toBe("gemini-2.5-flash");
    }
  });
});

// ─── Degraded Mode ─────────────────────────────────────────────

describe("selectModel — Degraded (Pro over quota)", () => {
  it("forces gemini-2.5-flash when degraded", () => {
    const result = selectModel(input({ plan: "pro", degraded: true }));
    expect(result.providerId).toBe("gemini");
    expect(result.modelId).toBe("gemini-2.5-flash");
  });

  it("forces flash even for high-cognitive subagent phases", () => {
    const result = selectModel(input({
      plan: "pro",
      degraded: true,
      action: "subagent",
      subagentId: "sdd-explore",
    }));
    expect(result.modelId).toBe("gemini-2.5-flash");
  });
});

// ─── BYOK ──────────────────────────────────────────────────────

describe("selectModel — BYOK (custom API key)", () => {
  it("uses explicit modelId when provided with custom key", () => {
    const result = selectModel(input({
      plan: "free",
      customApiKey: "sk-xxx",
      modelId: "gpt-4o",
    }));
    expect(result.modelId).toBe("gpt-4o");
    expect(result.byok).toBe(true);
  });

  it("does not block free subagent with BYOK", () => {
    const result = selectModel(input({
      plan: "free",
      action: "subagent",
      customApiKey: "sk-xxx",
    }));
    expect(result.blocked).toBeFalsy();
  });
});

// ─── Edge Cases ────────────────────────────────────────────────

describe("selectModel — Edge cases", () => {
  it("respects explicit modelId from client when no custom key", () => {
    const result = selectModel(input({ plan: "pro", modelId: "deepseek-chat" }));
    expect(result.modelId).toBe("deepseek-chat");
  });

  it("returns valid result when neither Google AI nor DeepSeek available", () => {
    const result = selectModel(input({ hasGoogleAI: false, hasDeepSeek: false }));
    expect(result.providerId).toBeDefined();
    expect(result.modelId).toBeDefined();
  });
});
