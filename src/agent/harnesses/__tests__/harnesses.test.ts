/**
 * Quality + Delivery + Infrastructure Harnesses — Unit Tests
 */

import { describe, it, expect } from "vitest";

// Quality
import { decideTDD, validateTDDEvidence } from "../quality/strict-tdd";
import { shouldRequireVerification, validateVerificationEvidence } from "../quality/verify";
import { parseCompletedTasks } from "../quality/apply-continuity";

// Delivery
import { assessWorkloadRisk, generateWorkloadForecast } from "../delivery/review-workload";
import { decideDeliveryStrategy } from "../delivery/delivery-strategy";
import { getChainTarget } from "../delivery/chain-strategy";

// Infrastructure
import { checkCommandPermission } from "../infrastructure/permission-security";
import { isCriticalFile } from "../infrastructure/backup";
import { normalizeOutput, truncateOutput } from "../infrastructure/command-wrapper";
import { topologicalSort } from "../infrastructure/component-dependency";
import { generateSessionSummary, extractRecoveryState } from "../infrastructure/session-summary";
import { createDefaultContext } from "../types";

// ─── Strict TDD ─────────────────────────────────────────────────

describe("decideTDD", () => {
  it("returns false when no test runner", () => {
    expect(decideTDD("crear un login", null)).toBe(false);
  });

  it("returns true for new feature with test runner", () => {
    expect(decideTDD("crear un nuevo servicio", "vitest")).toBe(true);
  });

  it("returns false when user opts out", () => {
    expect(decideTDD("crear login sin tests", "vitest")).toBe(false);
  });

  it("returns false for CSS tasks", () => {
    expect(decideTDD("cambiar el estilo del botón", "vitest")).toBe(false);
  });
});

describe("validateTDDEvidence", () => {
  it("passes with proper evidence", () => {
    const report = "RED: wrote failing test\nGREEN: implementation passes";
    expect(validateTDDEvidence(report)).toEqual([]);
  });

  it("fails without RED phase", () => {
    const report = "GREEN: implementation passes";
    const issues = validateTDDEvidence(report);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain("RED");
  });
});

// ─── Verify ─────────────────────────────────────────────────────

describe("shouldRequireVerification", () => {
  it("requires verify when TDD is active", () => {
    const ctx = { ...createDefaultContext("crear login", "pro"), useTDD: true };
    expect(shouldRequireVerification(ctx)).toBe(true);
  });

  it("skips verify for style-only changes", () => {
    const ctx = {
      ...createDefaultContext("cambiar color del header", "free"),
      useTDD: false,
      project: { ...createDefaultContext("", "free").project, testRunner: null },
    };
    expect(shouldRequireVerification(ctx)).toBe(false);
  });
});

describe("validateVerificationEvidence", () => {
  it("passes with proper evidence", () => {
    const report = "✅ All tests PASS. Spec compliance verified.";
    expect(validateVerificationEvidence(report)).toEqual([]);
  });
});

// ─── Apply Continuity ───────────────────────────────────────────

describe("parseCompletedTasks", () => {
  it("parses completed tasks from markdown", () => {
    const progress = `- [x] 1.1 Create auth module\n- [ ] 1.2 Add routes\n- [x] 2.1 Write tests`;
    const tasks = parseCompletedTasks(progress);
    expect(tasks).toContain("1.1");
    expect(tasks).toContain("2.1");
    expect(tasks).not.toContain("1.2");
  });
});

// ─── Review Workload ────────────────────────────────────────────

describe("assessWorkloadRisk", () => {
  it("returns low for small changes", () => {
    expect(assessWorkloadRisk(100).risk).toBe("low");
  });

  it("returns medium for moderate changes", () => {
    expect(assessWorkloadRisk(300).risk).toBe("medium");
  });

  it("returns high for large changes", () => {
    expect(assessWorkloadRisk(500).risk).toBe("high");
  });
});

describe("generateWorkloadForecast", () => {
  it("includes budget risk assessment", () => {
    const forecast = generateWorkloadForecast(500, 10);
    expect(forecast).toContain("High");
    expect(forecast).toContain("Chained PRs recommended: Yes");
  });
});

// ─── Delivery Strategy ──────────────────────────────────────────

describe("decideDeliveryStrategy", () => {
  it("returns direct without git", () => {
    expect(decideDeliveryStrategy("crear módulo", false, "pro")).toBe("direct");
  });

  it("returns pr when user requests it", () => {
    expect(decideDeliveryStrategy("crear pull request", true, "pro")).toBe("pr");
  });

  it("returns feature-branch for large scope", () => {
    expect(decideDeliveryStrategy("migrar el sistema completo", true, "pro")).toBe("feature-branch");
  });

  it("returns direct for free plan", () => {
    expect(decideDeliveryStrategy("crear módulo", true, "free")).toBe("direct");
  });
});

// ─── Chain Strategy ─────────────────────────────────────────────

describe("getChainTarget", () => {
  it("targets main for first slice in stacked-to-main", () => {
    expect(getChainTarget("stacked-to-main", 0)).toBe("main");
  });

  it("targets previous slice for subsequent slices", () => {
    expect(getChainTarget("stacked-to-main", 1)).toBe("slice-1");
  });

  it("targets feature branch for first slice in feature-branch-chain", () => {
    expect(getChainTarget("feature-branch-chain", 0, "main", "feature/auth")).toBe("feature/auth");
  });
});

// ─── Permission Security ────────────────────────────────────────

describe("checkCommandPermission", () => {
  it("blocks critical commands", () => {
    const check = checkCommandPermission("rm -rf /");
    expect(check.risk).toBe("critical");
    expect(check.requiresConfirmation).toBe(true);
  });

  it("flags high-risk commands", () => {
    const check = checkCommandPermission("git reset --hard HEAD~3");
    expect(check.risk).toBe("high");
  });

  it("allows safe commands", () => {
    const check = checkCommandPermission("npm run test");
    expect(check.risk).toBe("low");
    expect(check.requiresConfirmation).toBe(false);
  });

  it("flags force flags", () => {
    const check = checkCommandPermission("git push --force");
    expect(check.risk).toBe("critical");
  });
});

// ─── Backup ─────────────────────────────────────────────────────

describe("isCriticalFile", () => {
  it("identifies package.json as critical", () => {
    expect(isCriticalFile("package.json")).toBe(true);
  });

  it("identifies tsconfig as critical", () => {
    expect(isCriticalFile("tsconfig.json")).toBe(true);
  });

  it("does not flag regular source files", () => {
    expect(isCriticalFile("src/components/Button.tsx")).toBe(false);
  });
});

// ─── Command Wrapper ────────────────────────────────────────────

describe("normalizeOutput", () => {
  it("strips ANSI codes", () => {
    const raw = "\u001b[32mSuccess\u001b[0m";
    expect(normalizeOutput(raw)).toBe("Success");
  });

  it("trims trailing whitespace", () => {
    expect(normalizeOutput("hello   \nworld  ")).toBe("hello\nworld");
  });
});

describe("truncateOutput", () => {
  it("keeps short output as-is", () => {
    expect(truncateOutput("hello", 100)).toBe("hello");
  });

  it("truncates long output from the start", () => {
    const long = "a".repeat(200);
    const result = truncateOutput(long, 50);
    expect(result.length).toBeLessThan(200);
    expect(result).toContain("truncated");
  });
});

// ─── Component Dependency ───────────────────────────────────────

describe("topologicalSort", () => {
  it("sorts files by dependencies", () => {
    const files = ["c.ts", "a.ts", "b.ts"];
    const imports = {
      "c.ts": ["b.ts"],
      "b.ts": ["a.ts"],
    };
    const sorted = topologicalSort(files, imports);
    expect(sorted.indexOf("a.ts")).toBeLessThan(sorted.indexOf("b.ts"));
    expect(sorted.indexOf("b.ts")).toBeLessThan(sorted.indexOf("c.ts"));
  });
});

// ─── Session Summary ────────────────────────────────────────────

describe("generateSessionSummary", () => {
  it("includes project context", () => {
    const ctx = {
      ...createDefaultContext("test", "pro"),
      project: {
        ...createDefaultContext("", "pro").project,
        stack: ["react", "typescript"],
        testRunner: "vitest",
        isOpen: true,
      },
    };

    const summary = generateSessionSummary(ctx);
    expect(summary).toContain("react");
    expect(summary).toContain("vitest");
  });
});

describe("extractRecoveryState", () => {
  it("extracts completed phases from summary", () => {
    const summary = "Completed: [propose, spec, design]";
    const state = extractRecoveryState(summary);
    expect(state.completedPhases).toContain("propose");
    expect(state.completedPhases).toContain("spec");
  });
});
