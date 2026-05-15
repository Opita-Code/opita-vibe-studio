import { describe, it, expect } from "vitest";
import {
  getRemainingTokens,
  isLimitReached,
  isHourlyLimitReached,
  getUsagePercent,
  getHourlyUsagePercent,
  formatRenewalDate,
  formatTokenCount,
  getMinutesUntilHourlyReset,
  getHoursUntilDailyReset,
  PLAN_LIMITS,
  PLAN_NAMES,
  PLAN_FEATURES,
} from "../../src/lib/tokens";
import type { TokenUsage } from "../../src/lib/types";

function makeUsage(overrides?: Partial<TokenUsage>): TokenUsage {
  return {
    tokensUsedToday: 50_000,
    tokensLimitDaily: 150_000,
    tokensUsedThisHour: 10_000,
    tokensLimitHourly: 30_000,
    plan: "free",
    resetDailyAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    resetHourlyAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("formatTokenCount", () => {
  it("should format tokens as K and M", () => {
    expect(formatTokenCount(150_000)).toBe("150K");
    expect(formatTokenCount(1_000_000)).toBe("1M");
    expect(formatTokenCount(45230)).toBe("45.2K");
    expect(formatTokenCount(500)).toBe("500");
  });
});

describe("plan limits", () => {
  it("should have correct plan limits (daily + hourly)", () => {
    expect(PLAN_LIMITS.free.daily).toBe(150_000);
    expect(PLAN_LIMITS.free.hourly).toBe(30_000);
    expect(PLAN_LIMITS.estudiante.daily).toBe(250_000);
    expect(PLAN_LIMITS.pro.daily).toBe(1_000_000);
  });

  it("should have names for all plans", () => {
    expect(PLAN_NAMES.free).toBe("Gratis");
    expect(PLAN_NAMES.estudiante).toBe("Estudiante");
    expect(PLAN_NAMES.pro).toBe("Vibe Pro");
  });

  it("should have features for all plans", () => {
    expect(PLAN_FEATURES.free.length).toBeGreaterThan(0);
    expect(PLAN_FEATURES.estudiante.length).toBeGreaterThan(0);
    expect(PLAN_FEATURES.pro.length).toBeGreaterThan(0);
  });
});

describe("getRemainingTokens", () => {
  it("should calculate remaining tokens", () => {
    const usage = makeUsage({ tokensUsedToday: 50_000, tokensLimitDaily: 150_000 });
    expect(getRemainingTokens(usage)).toBe(100_000);
  });

  it("should return 0 if over limit", () => {
    const usage = makeUsage({ tokensUsedToday: 200_000, tokensLimitDaily: 150_000 });
    expect(getRemainingTokens(usage)).toBe(0);
  });
});

describe("isLimitReached", () => {
  it("should return false when under limit", () => {
    const usage = makeUsage({ tokensUsedToday: 100_000, tokensLimitDaily: 150_000 });
    expect(isLimitReached(usage)).toBe(false);
  });

  it("should return true when at limit", () => {
    const usage = makeUsage({ tokensUsedToday: 150_000, tokensLimitDaily: 150_000 });
    expect(isLimitReached(usage)).toBe(true);
  });

  it("should return true when over limit", () => {
    const usage = makeUsage({ tokensUsedToday: 200_000, tokensLimitDaily: 150_000 });
    expect(isLimitReached(usage)).toBe(true);
  });
});

describe("isHourlyLimitReached", () => {
  it("should return true when hourly limit reached", () => {
    const usage = makeUsage({ tokensUsedThisHour: 30_000, tokensLimitHourly: 30_000 });
    expect(isHourlyLimitReached(usage)).toBe(true);
  });

  it("should return false when under hourly limit", () => {
    const usage = makeUsage({ tokensUsedThisHour: 10_000, tokensLimitHourly: 30_000 });
    expect(isHourlyLimitReached(usage)).toBe(false);
  });
});

describe("getUsagePercent", () => {
  it("should calculate percentage", () => {
    const usage = makeUsage({ tokensUsedToday: 75_000, tokensLimitDaily: 150_000 });
    expect(getUsagePercent(usage)).toBe(50);
  });

  it("should cap at 100", () => {
    const usage = makeUsage({ tokensUsedToday: 300_000, tokensLimitDaily: 150_000 });
    expect(getUsagePercent(usage)).toBe(100);
  });
});

describe("getHourlyUsagePercent", () => {
  it("should calculate hourly percentage", () => {
    const usage = makeUsage({ tokensUsedThisHour: 15_000, tokensLimitHourly: 30_000 });
    expect(getHourlyUsagePercent(usage)).toBe(50);
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

describe("getHoursUntilDailyReset", () => {
  it("should calculate hours until reset", () => {
    const future = new Date(Date.now() + 5 * 60 * 60 * 1000);
    expect(getHoursUntilDailyReset(future.toISOString())).toBe(5);
  });

  it("should return 0 for past dates", () => {
    const past = new Date(Date.now() - 10 * 60 * 60 * 1000);
    expect(getHoursUntilDailyReset(past.toISOString())).toBe(0);
  });
});

describe("getMinutesUntilHourlyReset", () => {
  it("should calculate minutes until hourly reset", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000);
    expect(getMinutesUntilHourlyReset(future.toISOString())).toBe(30);
  });

  it("should return 0 for past dates", () => {
    const past = new Date(Date.now() - 10 * 60 * 1000);
    expect(getMinutesUntilHourlyReset(past.toISOString())).toBe(0);
  });
});
