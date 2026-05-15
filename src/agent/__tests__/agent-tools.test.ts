import { describe, it, expect } from "vitest";
import {
  getToolNamesForPhase,
  isDangerousTool,
  CHAT_TOOLS,
  EXPLORE_TOOLS,
  PROPOSE_TOOLS,
  DESIGN_TOOLS,
  APPLY_TOOLS,
  VERIFY_TOOLS,
} from "../agent-tools";

describe("agent-tools", () => {
  // ─── Tool Set Isolation ─────────────────────────────────────

  describe("tool isolation per phase", () => {
    it("chat should only have memory tools", () => {
      const names = getToolNamesForPhase("chat");
      expect(names).toContain("memory_search");
      expect(names).toContain("memory_save");
      expect(names).not.toContain("write_file");
      expect(names).not.toContain("read_file");
      expect(names).not.toContain("execute_command");
    });

    it("explore should have research tools but NO write tools", () => {
      const names = getToolNamesForPhase("explore");
      expect(names).toContain("read_file");
      expect(names).toContain("web_search");
      expect(names).toContain("browse_url");
      expect(names).toContain("memory_search");
      expect(names).toContain("analyze_dependencies");
      // Explore MUST NOT have write access
      expect(names).not.toContain("write_file");
      expect(names).not.toContain("apply_diff");
      expect(names).not.toContain("delete_file");
      expect(names).not.toContain("execute_command");
    });

    it("propose should be read-only with no web access", () => {
      const names = getToolNamesForPhase("propose");
      expect(names).toContain("read_file");
      expect(names).toContain("search_code");
      expect(names).toContain("memory_search");
      expect(names).not.toContain("write_file");
      expect(names).not.toContain("web_search");
      expect(names).not.toContain("execute_command");
    });

    it("design should have read + memory + web, but no writes", () => {
      const names = getToolNamesForPhase("design");
      expect(names).toContain("read_file");
      expect(names).toContain("memory_save");
      expect(names).toContain("web_search");
      expect(names).not.toContain("write_file");
      expect(names).not.toContain("execute_command");
    });

    it("apply should have full filesystem + execution", () => {
      const names = getToolNamesForPhase("apply");
      expect(names).toContain("read_file");
      expect(names).toContain("write_file");
      expect(names).toContain("apply_diff");
      expect(names).toContain("delete_file");
      expect(names).toContain("execute_command");
      expect(names).toContain("search_code");
    });

    it("verify should have tests + read + corrections, but no delete", () => {
      const names = getToolNamesForPhase("verify");
      expect(names).toContain("read_file");
      expect(names).toContain("execute_command");
      expect(names).toContain("apply_diff"); // for corrections
      expect(names).not.toContain("write_file");
      expect(names).not.toContain("delete_file");
    });
  });

  // ─── Dangerous Tool Detection ──────────────────────────────

  describe("isDangerousTool", () => {
    it("should mark write_file as dangerous in apply phase", () => {
      expect(isDangerousTool("apply", "write_file")).toBe(true);
    });

    it("should mark read_file as safe in all phases", () => {
      expect(isDangerousTool("explore", "read_file")).toBe(false);
      expect(isDangerousTool("apply", "read_file")).toBe(false);
      expect(isDangerousTool("verify", "read_file")).toBe(false);
    });

    it("should default to dangerous for unknown tools", () => {
      expect(isDangerousTool("chat", "unknown_tool")).toBe(true);
    });

    it("should mark execute_command as dangerous", () => {
      expect(isDangerousTool("apply", "execute_command")).toBe(true);
      expect(isDangerousTool("verify", "execute_command")).toBe(true);
    });
  });

  // ─── Tool Count Sanity ─────────────────────────────────────

  describe("tool counts", () => {
    it("chat should have the fewest tools", () => {
      expect(CHAT_TOOLS.length).toBeLessThanOrEqual(3);
    });

    it("apply should have the most tools", () => {
      expect(APPLY_TOOLS.length).toBeGreaterThan(CHAT_TOOLS.length);
      expect(APPLY_TOOLS.length).toBeGreaterThan(PROPOSE_TOOLS.length);
      expect(APPLY_TOOLS.length).toBeGreaterThanOrEqual(VERIFY_TOOLS.length);
    });

    it("explore should have more tools than propose", () => {
      expect(EXPLORE_TOOLS.length).toBeGreaterThan(PROPOSE_TOOLS.length);
    });
  });

  // ─── No Dangerous Tools in Read-Only Phases ─────────────────

  describe("safety constraints", () => {
    it("explore tools should have zero dangerous tools", () => {
      expect(EXPLORE_TOOLS.every((t) => !t.dangerous)).toBe(true);
    });

    it("propose tools should have zero dangerous tools", () => {
      expect(PROPOSE_TOOLS.every((t) => !t.dangerous)).toBe(true);
    });

    it("design tools should have zero dangerous tools", () => {
      expect(DESIGN_TOOLS.every((t) => !t.dangerous)).toBe(true);
    });

    it("apply tools should have at least one dangerous tool", () => {
      expect(APPLY_TOOLS.some((t) => t.dangerous)).toBe(true);
    });

    it("verify tools should have dangerous tools only for corrections", () => {
      const dangerousVerify = VERIFY_TOOLS.filter((t) => t.dangerous);
      expect(dangerousVerify.length).toBeGreaterThan(0);
      // Only apply_diff and execute_command should be dangerous
      const dangerousNames = dangerousVerify.map((t) => t.name);
      expect(dangerousNames).toContain("apply_diff");
      expect(dangerousNames).toContain("execute_command");
      expect(dangerousNames).not.toContain("delete_file");
    });
  });
});
