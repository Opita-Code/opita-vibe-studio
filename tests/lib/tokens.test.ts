import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  getRemainingPrompts,
  isLimitReached,
  getUsagePercent,
  formatRenewalDate,
  getDaysUntilRenewal,
  PLAN_LIMITS,
  PLAN_NAMES,
  PLAN_FEATURES,
} from "../../src/lib/tokens";
import type { TokenUsage } from "../../src/lib/types";

function makeUsage(overrides?: Partial<TokenUsage>): TokenUsage {
  return {
    promptsUsed: 12,
    promptsLimit: 30,
    billingPeriodStart: "2026-05-01T00:00:00.000Z",
    billingPeriodEnd: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("estimateTokens", () => {
  it("should estimate tokens from text length / 4", () => {
    expect(estimateTokens("hola")).toBe(1); // 4 chars / 4 = 1
    expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 → 3
    expect(estimateTokens("")).toBe(0);
  });

  it("should round up", () => {
    expect(estimateTokens("abc")).toBe(1); // 3/4 = 0.75 → 1
    expect(estimateTokens("a")).toBe(1); // 1/4 = 0.25 → 1
  });
});

describe("plan limits", () => {
  it("should have correct plan limits", () => {
    expect(PLAN_LIMITS.free).toBe(30);
    expect(PLAN_LIMITS.estudiante).toBe(200);
    expect(PLAN_LIMITS.creador).toBe(500);
    expect(PLAN_LIMITS.pro).toBe(2000);
    expect(PLAN_LIMITS.universidad).toBe(2000);
  });

  it("should have names for all plans", () => {
    expect(PLAN_NAMES.free).toBe("Gratis");
    expect(PLAN_NAMES.estudiante).toBe("Estudiante");
    expect(PLAN_NAMES.pro).toBe("Pro");
  });

  it("should have features for all plans", () => {
    expect(PLAN_FEATURES.free.length).toBeGreaterThan(0);
    expect(PLAN_FEATURES.estudiante.length).toBeGreaterThan(0);
    expect(PLAN_FEATURES.pro.length).toBeGreaterThan(0);
  });
});

describe("getRemainingPrompts", () => {
  it("should calculate remaining prompts", () => {
    const usage = makeUsage({ promptsUsed: 12, promptsLimit: 30 });
    expect(getRemainingPrompts(usage)).toBe(18);
  });

  it("should return 0 if over limit", () => {
    const usage = makeUsage({ promptsUsed: 35, promptsLimit: 30 });
    expect(getRemainingPrompts(usage)).toBe(0);
  });
});

describe("isLimitReached", () => {
  it("should return false when under limit", () => {
    const usage = makeUsage({ promptsUsed: 29, promptsLimit: 30 });
    expect(isLimitReached(usage)).toBe(false);
  });

  it("should return true when at limit", () => {
    const usage = makeUsage({ promptsUsed: 30, promptsLimit: 30 });
    expect(isLimitReached(usage)).toBe(true);
  });

  it("should return true when over limit", () => {
    const usage = makeUsage({ promptsUsed: 31, promptsLimit: 30 });
    expect(isLimitReached(usage)).toBe(true);
  });
});

describe("getUsagePercent", () => {
  it("should calculate percentage", () => {
    const usage = makeUsage({ promptsUsed: 15, promptsLimit: 30 });
    expect(getUsagePercent(usage)).toBe(50);
  });

  it("should cap at 100", () => {
    const usage = makeUsage({ promptsUsed: 60, promptsLimit: 30 });
    expect(getUsagePercent(usage)).toBe(100);
  });
});

describe("formatRenewalDate", () => {
  it("should format date in Spanish", () => {
    const date = "2026-06-01T00:00:00.000Z";
    expect(formatRenewalDate(date)).toBe("1 de junio");
  });

  it("should handle different months", () => {
    expect(formatRenewalDate("2026-05-04T00:00:00.000Z")).toBe("4 de mayo");
  });
});

describe("getDaysUntilRenewal", () => {
  it("should calculate days until renewal", () => {
    // Usar una fecha futura lejana para evitar problemas con fechas pasadas
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(getDaysUntilRenewal(future.toISOString())).toBe(5);
  });

  it("should return 0 for past dates", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(getDaysUntilRenewal(past.toISOString())).toBe(0);
  });
});
