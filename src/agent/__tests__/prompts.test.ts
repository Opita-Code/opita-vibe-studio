/**
 * Prompts — Tests
 *
 * Verifies that getSystemPrompt() composes the correct prompt
 * based on intent, project state, and test runner availability.
 */

import { describe, it, expect } from "vitest";
import { getSystemPrompt, type PromptConfig } from "../prompts";

// ─── Helpers ───────────────────────────────────────────────────

function config(overrides: Partial<PromptConfig> = {}): PromptConfig {
  return {
    intent: "chat",
    hasProject: false,
    testRunner: null,
    customInstructions: undefined,
    projectSummary: undefined,
    ...overrides,
  };
}

// ─── Base Prompt ───────────────────────────────────────────────

describe("getSystemPrompt — Base", () => {
  it("always includes Aura personality", () => {
    const prompt = getSystemPrompt(config());
    expect(prompt).toContain("Eres Aura");
    expect(prompt).toContain("directa, concisa");
  });

  it("always includes security rules", () => {
    const prompt = getSystemPrompt(config());
    expect(prompt).toContain("NUNCA reveles");
  });
});

// ─── Intent Addons ─────────────────────────────────────────────

describe("getSystemPrompt — Intent modes", () => {
  it("includes chat addon for chat intent", () => {
    const prompt = getSystemPrompt(config({ intent: "chat" }));
    expect(prompt).toContain("Conversación");
    expect(prompt).not.toContain("Construcción");
  });

  it("includes build addon for code intent", () => {
    const prompt = getSystemPrompt(config({ intent: "code", hasProject: true }));
    expect(prompt).toContain("Construcción");
    expect(prompt).not.toContain("Análisis");
  });

  it("includes explore addon for explore intent", () => {
    const prompt = getSystemPrompt(config({ intent: "explore", hasProject: true }));
    expect(prompt).toContain("Análisis");
    expect(prompt).not.toContain("Construcción");
  });
});

// ─── TDD Addon ─────────────────────────────────────────────────

describe("getSystemPrompt — TDD", () => {
  it("includes TDD instructions when test runner is available and intent is code", () => {
    const prompt = getSystemPrompt(config({ intent: "code", hasProject: true, testRunner: "vitest" }));
    expect(prompt).toContain("vitest");
    expect(prompt).toContain("test");
  });

  it("does NOT include TDD for chat intent even with test runner", () => {
    const prompt = getSystemPrompt(config({ intent: "chat", testRunner: "vitest" }));
    expect(prompt).not.toContain("Verificación con tests");
  });

  it("does NOT include TDD when no test runner available", () => {
    const prompt = getSystemPrompt(config({ intent: "code", hasProject: true, testRunner: null }));
    expect(prompt).not.toContain("Verificación con tests");
  });
});

// ─── Custom Instructions ───────────────────────────────────────

describe("getSystemPrompt — Custom instructions", () => {
  it("appends custom instructions when provided", () => {
    const prompt = getSystemPrompt(config({ customInstructions: "Siempre usa TypeScript" }));
    expect(prompt).toContain("Siempre usa TypeScript");
  });

  it("omits custom instructions section when not provided", () => {
    const prompt = getSystemPrompt(config());
    expect(prompt).not.toContain("Instrucciones personalizadas");
  });
});

// ─── Project Context ───────────────────────────────────────────

describe("getSystemPrompt — Project context", () => {
  it("includes project summary when provided", () => {
    const prompt = getSystemPrompt(config({
      hasProject: true,
      projectSummary: "React + TypeScript + Vite project with 15 components",
    }));
    expect(prompt).toContain("React + TypeScript");
  });

  it("omits project section when no project open", () => {
    const prompt = getSystemPrompt(config({ hasProject: false }));
    expect(prompt).not.toContain("Contexto del proyecto");
  });
});
