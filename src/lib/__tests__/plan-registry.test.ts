import { describe, it, expect } from "vitest";
import {
  getPlan,
  canAccess,
  requiresTier,
  getPlanLimits,
  getStorageLimit,
  getPlanName,
  getPlanFeatures,
  getXpMultiplier,
  getQuotaDecayFloor,
  getQuotaCap,
  getAllPlanIds,
} from "../plan-registry";

describe("Plan Registry", () => {
  // ─── getPlan ────────────────────────────────────────────────
  describe("getPlan", () => {
    it("returns correct config for each plan", () => {
      expect(getPlan("free").tier).toBe(0);
      expect(getPlan("estudiante").tier).toBe(1);
      expect(getPlan("pro").tier).toBe(2);
    });

    it("falls back to free for unknown plan", () => {
      // @ts-expect-error — testing invalid input
      expect(getPlan("enterprise").tier).toBe(0);
    });
  });

  // ─── canAccess ──────────────────────────────────────────────
  describe("canAccess", () => {
    it("all plans have tier 0 capabilities", () => {
      for (const plan of getAllPlanIds()) {
        expect(canAccess(plan, "chat")).toBe(true);
        expect(canAccess(plan, "byok")).toBe(true);
        expect(canAccess(plan, "preview")).toBe(true);
        expect(canAccess(plan, "templates")).toBe(true);
      }
    });

    it("free cannot access tier 1+ capabilities", () => {
      expect(canAccess("free", "cloud_sync")).toBe(false);
      expect(canAccess("free", "sdd")).toBe(false);
      expect(canAccess("free", "sub_agents")).toBe(false);
    });

    it("estudiante has tier 1 capabilities", () => {
      expect(canAccess("estudiante", "cloud_sync")).toBe(true);
      expect(canAccess("estudiante", "sdd")).toBe(true);
    });

    it("estudiante cannot access tier 2 capabilities", () => {
      expect(canAccess("estudiante", "sub_agents")).toBe(false);
      expect(canAccess("estudiante", "advanced_models")).toBe(false);
      expect(canAccess("estudiante", "degraded_mode")).toBe(false);
    });

    it("pro has all current capabilities", () => {
      expect(canAccess("pro", "cloud_sync")).toBe(true);
      expect(canAccess("pro", "sdd")).toBe(true);
      expect(canAccess("pro", "sub_agents")).toBe(true);
      expect(canAccess("pro", "advanced_models")).toBe(true);
      expect(canAccess("pro", "degraded_mode")).toBe(true);
    });

    it("no plan has future capabilities yet", () => {
      for (const plan of getAllPlanIds()) {
        expect(canAccess(plan, "team_sharing")).toBe(false);
        expect(canAccess(plan, "custom_agents")).toBe(false);
        expect(canAccess(plan, "priority_queue")).toBe(false);
      }
    });
  });

  // ─── requiresTier ──────────────────────────────────────────
  describe("requiresTier", () => {
    it("free meets tier 0 only", () => {
      expect(requiresTier("free", 0)).toBe(true);
      expect(requiresTier("free", 1)).toBe(false);
    });

    it("estudiante meets tier 0 and 1", () => {
      expect(requiresTier("estudiante", 0)).toBe(true);
      expect(requiresTier("estudiante", 1)).toBe(true);
      expect(requiresTier("estudiante", 2)).toBe(false);
    });

    it("pro meets all current tiers", () => {
      expect(requiresTier("pro", 0)).toBe(true);
      expect(requiresTier("pro", 1)).toBe(true);
      expect(requiresTier("pro", 2)).toBe(true);
      expect(requiresTier("pro", 3)).toBe(false);
    });
  });

  // ─── Limits ────────────────────────────────────────────────
  describe("getPlanLimits", () => {
    it("returns correct token limits", () => {
      expect(getPlanLimits("free")).toEqual({ daily: 150_000, hourly: 30_000 });
      expect(getPlanLimits("estudiante")).toEqual({ daily: 250_000, hourly: 60_000 });
      expect(getPlanLimits("pro")).toEqual({ daily: 1_000_000, hourly: 200_000 });
    });
  });

  describe("getStorageLimit", () => {
    it("returns bytes from MB", () => {
      expect(getStorageLimit("free")).toBe(5 * 1024 * 1024);
      expect(getStorageLimit("estudiante")).toBe(50 * 1024 * 1024);
      expect(getStorageLimit("pro")).toBe(500 * 1024 * 1024);
    });
  });

  // ─── Display helpers ──────────────────────────────────────
  describe("display helpers", () => {
    it("getPlanName returns localized names", () => {
      expect(getPlanName("free")).toBe("Gratis");
      expect(getPlanName("estudiante")).toBe("Estudiante");
      expect(getPlanName("pro")).toBe("Vibe Pro");
    });

    it("getPlanFeatures returns non-empty arrays", () => {
      for (const plan of getAllPlanIds()) {
        expect(getPlanFeatures(plan).length).toBeGreaterThan(0);
      }
    });
  });

  // ─── Gamification helpers ─────────────────────────────────
  describe("gamification", () => {
    it("xp multipliers scale with tier", () => {
      expect(getXpMultiplier("free")).toBe(1);
      expect(getXpMultiplier("estudiante")).toBe(1.5);
      expect(getXpMultiplier("pro")).toBe(2);
    });

    it("quota decay floors match plan base", () => {
      expect(getQuotaDecayFloor("free")).toBe(150_000);
      expect(getQuotaDecayFloor("estudiante")).toBe(250_000);
      expect(getQuotaDecayFloor("pro")).toBe(1_000_000);
    });

    it("quota caps are >= decay floors", () => {
      for (const plan of getAllPlanIds()) {
        expect(getQuotaCap(plan)).toBeGreaterThanOrEqual(getQuotaDecayFloor(plan));
      }
    });
  });

  // ─── Registry integrity ───────────────────────────────────
  describe("registry integrity", () => {
    it("all plans have unique tiers", () => {
      const tiers = getAllPlanIds().map((id) => getPlan(id).tier);
      expect(new Set(tiers).size).toBe(tiers.length);
    });

    it("tiers are in ascending order: free < estudiante < pro", () => {
      expect(getPlan("free").tier).toBeLessThan(getPlan("estudiante").tier);
      expect(getPlan("estudiante").tier).toBeLessThan(getPlan("pro").tier);
    });

    it("higher tier includes all lower tier capabilities", () => {
      const freeCaps = getPlan("free").capabilities;
      const estCaps = getPlan("estudiante").capabilities;
      const proCaps = getPlan("pro").capabilities;

      for (const cap of freeCaps) {
        expect(estCaps.has(cap)).toBe(true);
        expect(proCaps.has(cap)).toBe(true);
      }
      for (const cap of estCaps) {
        expect(proCaps.has(cap)).toBe(true);
      }
    });
  });
});
