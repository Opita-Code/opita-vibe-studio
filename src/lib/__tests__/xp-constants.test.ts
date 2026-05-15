import { describe, it, expect } from "vitest";
import {
  calculateLevel,
  xpForLevel,
  levelProgress,
  xpToNextLevel,
  applyQuotaDecay,
  streakMultiplier,
  getDifficulty,
  QUOTA_DECAY_FLOOR,
} from "@/lib/xp-constants";

describe("XP Constants — Level Formula", () => {
  it("level 0 at 0 XP", () => {
    expect(calculateLevel(0)).toBe(0);
  });

  it("level 1 at 100 XP", () => {
    expect(calculateLevel(100)).toBe(1);
  });

  it("level 1 at 99 XP (not enough)", () => {
    expect(calculateLevel(99)).toBe(0);
  });

  it("level 5 at 2500 XP", () => {
    expect(calculateLevel(2500)).toBe(5);
  });

  it("level 10 at 10000 XP", () => {
    expect(calculateLevel(10000)).toBe(10);
  });

  it("level 50 at 250000 XP", () => {
    expect(calculateLevel(250000)).toBe(50);
  });

  it("xpForLevel is inverse of calculateLevel", () => {
    for (const level of [0, 1, 5, 10, 25, 50]) {
      const xp = xpForLevel(level);
      expect(calculateLevel(xp)).toBe(level);
    }
  });
});

describe("XP Constants — Level Progress", () => {
  it("0% at start of level", () => {
    expect(levelProgress(100)).toBe(0); // exactly level 1
  });

  it("100% just before level up", () => {
    // Level 1 = 100 XP, Level 2 = 400 XP, range = 300
    expect(levelProgress(399)).toBe(100); // 299/300 rounds to 100
  });

  it("50% midway through level", () => {
    // Level 1 = 100 XP, Level 2 = 400 XP, midpoint = 250
    expect(levelProgress(250)).toBe(50);
  });

  it("xpToNextLevel is correct", () => {
    expect(xpToNextLevel(0)).toBe(100);   // need 100 for level 1
    expect(xpToNextLevel(100)).toBe(300); // need 300 for level 2 (400 - 100)
    expect(xpToNextLevel(400)).toBe(500); // need 500 for level 3 (900 - 400)
  });
});

describe("XP Constants — Quota Decay", () => {
  it("no decay with 0 inactive days", () => {
    expect(applyQuotaDecay(300_000, 0, 150_000)).toBe(300_000);
  });

  it("10% decay after 1 inactive day", () => {
    expect(applyQuotaDecay(300_000, 1, 150_000)).toBe(270_000);
  });

  it("decays compound over multiple days", () => {
    // 300K × 0.9 × 0.9 = 243K
    expect(applyQuotaDecay(300_000, 2, 150_000)).toBe(243_000);
  });

  it("never decays below plan floor", () => {
    expect(applyQuotaDecay(300_000, 100, 150_000)).toBe(150_000);
  });

  it("respects different plan floors", () => {
    expect(applyQuotaDecay(400_000, 100, QUOTA_DECAY_FLOOR.estudiante)).toBe(250_000);
  });
});

describe("XP Constants — Streak", () => {
  it("1x multiplier under 3 days", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(2)).toBe(1);
  });

  it("1.5x multiplier at 3+ days", () => {
    expect(streakMultiplier(3)).toBe(1.5);
    expect(streakMultiplier(6)).toBe(1.5);
  });

  it("2x multiplier at 7+ days", () => {
    expect(streakMultiplier(7)).toBe(2);
    expect(streakMultiplier(30)).toBe(2);
  });
});

describe("XP Constants — Difficulty", () => {
  it("novato for levels 0-4", () => {
    expect(getDifficulty(0)).toBe("novato");
    expect(getDifficulty(4)).toBe("novato");
  });

  it("intermedio for levels 5-14", () => {
    expect(getDifficulty(5)).toBe("intermedio");
    expect(getDifficulty(14)).toBe("intermedio");
  });

  it("avanzado for levels 15+", () => {
    expect(getDifficulty(15)).toBe("avanzado");
    expect(getDifficulty(50)).toBe("avanzado");
  });
});
