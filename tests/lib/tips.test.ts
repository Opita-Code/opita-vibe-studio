import { describe, it, expect } from "vitest";
import {
  TIP_DICTIONARY,
  getTipsByTag,
  getTipByTrigger,
  getUnseenTipsByTags,
} from "../../src/lib/tips";

describe("TIP_DICTIONARY", () => {
  it("should have at least 20 tips", () => {
    expect(TIP_DICTIONARY.length).toBeGreaterThanOrEqual(20);
  });

  it("should have unique IDs for all tips", () => {
    const ids = TIP_DICTIONARY.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have non-empty question and explanation for all tips", () => {
    for (const tip of TIP_DICTIONARY) {
      expect(tip.question.length).toBeGreaterThan(0);
      expect(tip.explanation.length).toBeGreaterThan(0);
    }
  });

  it("should have at least one tag for each tip", () => {
    for (const tip of TIP_DICTIONARY) {
      expect(tip.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should cover multiple concepts", () => {
    const concepts = new Set(TIP_DICTIONARY.map((t) => t.concept));
    expect(concepts.size).toBeGreaterThanOrEqual(5);
  });

  it("should include Spanish text in all tips", () => {
    for (const tip of TIP_DICTIONARY) {
      expect(tip.question).toMatch(/[áéíóúñ¿¡]/i);
    }
  });

  it("should use Colombian-neutral Spanish in 'css-grid' tip explanation", () => {
    const gridTip = TIP_DICTIONARY.find((t) => t.id === "css-grid");
    expect(gridTip).toBeDefined();
    expect(gridTip!.explanation).not.toContain("Definis");
    expect(gridTip!.explanation).not.toContain("Puedes");
    expect(gridTip!.explanation).toContain("Defines");
    expect(gridTip!.explanation).toContain("Puedes");
  });
});

describe("getTipsByTag", () => {
  it("should return tips matching a tag", () => {
    const tips = getTipsByTag("css");
    expect(tips.length).toBeGreaterThan(0);
    tips.forEach((tip) => {
      expect(tip.tags.some((t) => t.toLowerCase() === "css")).toBe(true);
    });
  });

  it("should return tips matching by concept name", () => {
    const tips = getTipsByTag("flexbox");
    expect(tips.length).toBeGreaterThan(0);
  });

  it("should return empty array for unknown tag", () => {
    const tips = getTipsByTag("tag-inexistente");
    expect(tips).toEqual([]);
  });

  it("should be case insensitive", () => {
    const lower = getTipsByTag("javascript");
    const upper = getTipsByTag("JAVASCRIPT");
    expect(lower.length).toBe(upper.length);
  });
});

describe("getTipByTrigger", () => {
  it("should find tip by trigger event", () => {
    const tip = getTipByTrigger("css-flexbox");
    expect(tip).toBeDefined();
    expect(tip?.concept).toBe("flexbox");
  });

  it("should find tip by trigger event (js-var)", () => {
    const tip = getTipByTrigger("js-var");
    expect(tip).toBeDefined();
    expect(tip?.concept).toBe("variables");
  });

  it("should return undefined for unknown trigger", () => {
    const tip = getTipByTrigger("trigger-inexistente");
    expect(tip).toBeUndefined();
  });

  it("should be case insensitive", () => {
    const lower = getTipByTrigger("css-flexbox");
    const upper = getTipByTrigger("CSS-FLEXBOX");
    expect(lower?.id).toBe(upper?.id);
  });
});

describe("getUnseenTipsByTags", () => {
  it("should return unseen tips from multiple tags", () => {
    const seen = new Set<string>();
    const tips = getUnseenTipsByTags(["css", "flexbox"], seen);
    expect(tips.length).toBeGreaterThan(0);
  });

  it("should exclude seen tips", () => {
    const allTips = getUnseenTipsByTags(["css"], new Set<string>());
    expect(allTips.length).toBeGreaterThan(0);

    const seenId = allTips[0].id;
    const seen = new Set([seenId]);
    const filtered = getUnseenTipsByTags(["css"], seen);

    expect(filtered.find((t) => t.id === seenId)).toBeUndefined();
  });

  it("should not return duplicates for overlapping tags", () => {
    // "css-flexbox" has tags ["css", "flexbox"] — both should not return dupes
    const seen = new Set<string>();
    const tips = getUnseenTipsByTags(["css", "flexbox", "layout"], seen);
    const ids = tips.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
