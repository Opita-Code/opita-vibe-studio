/**
 * Orchestration Harnesses — Unit Tests
 *
 * Tests phase-dag, execution-mode, delegation, sdd-init, and artifact-store.
 */

import { describe, it, expect } from "vitest";
import { phaseDagHarness, getNextPhases, validatePhaseSequence } from "../orchestration/phase-dag";
import { decideExecutionMode } from "../orchestration/execution-mode";
import { decideDelegation } from "../orchestration/delegation";
import { calibrateProject, detectTestRunner } from "../orchestration/sdd-init";
import { decideArtifactStore } from "../orchestration/artifact-store";
import { createDefaultContext } from "../types";
import type { ProjectSnapshot } from "../types";

// ─── Phase DAG ──────────────────────────────────────────────────

describe("phaseDagHarness", () => {
  it("blocks when dependencies are missing", async () => {
    const ctx = {
      ...createDefaultContext("test", "pro"),
      currentPhase: "apply" as const,
      completedPhases: ["propose" as const], // Missing spec, design, tasks
    };

    const result = await phaseDagHarness.execute(ctx);
    expect(result.block).toBe(true);
    expect(result.blockReason).toContain("tasks");
  });

  it("passes when all dependencies are met", async () => {
    const ctx = {
      ...createDefaultContext("test", "pro"),
      currentPhase: "apply" as const,
      completedPhases: ["propose" as const, "spec" as const, "design" as const, "tasks" as const],
    };

    const result = await phaseDagHarness.execute(ctx);
    expect(result.block).toBe(false);
  });

  it("allows explore with no dependencies", async () => {
    const ctx = {
      ...createDefaultContext("test", "pro"),
      currentPhase: "explore" as const,
      completedPhases: [],
    };

    const result = await phaseDagHarness.execute(ctx);
    expect(result.block).toBe(false);
  });
});

describe("getNextPhases", () => {
  it("returns explore and propose when nothing is completed", () => {
    const next = getNextPhases([]);
    expect(next).toContain("explore");
    expect(next).toContain("propose");
  });

  it("returns spec and design after propose", () => {
    const next = getNextPhases(["propose"]);
    expect(next).toContain("spec");
    expect(next).toContain("design");
  });

  it("returns tasks after spec and design", () => {
    const next = getNextPhases(["propose", "spec", "design"]);
    expect(next).toContain("tasks");
  });
});

describe("validatePhaseSequence", () => {
  it("validates a correct sequence", () => {
    const result = validatePhaseSequence(["propose", "spec", "design", "tasks", "apply"]);
    expect(result).toBeNull();
  });

  it("catches an invalid skip", () => {
    const result = validatePhaseSequence(["propose", "apply"]); // skipping spec, design, tasks
    expect(result).not.toBeNull();
    expect(result!.phase).toBe("apply");
  });
});

// ─── Execution Mode ─────────────────────────────────────────────

describe("decideExecutionMode", () => {
  it("returns auto when user explicitly requests it", () => {
    expect(decideExecutionMode("modo auto por favor", "interactive", "pro")).toBe("auto");
  });

  it("returns interactive when user explicitly requests it", () => {
    expect(decideExecutionMode("paso a paso", "auto", "pro")).toBe("interactive");
  });

  it("returns interactive for complex tasks", () => {
    expect(decideExecutionMode("migrar el sistema de autenticación completo", "auto", "pro")).toBe("interactive");
  });

  it("returns auto for simple styling tasks", () => {
    expect(decideExecutionMode("cambiar el color y el estilo del botón", "interactive", "pro")).toBe("auto");
  });

  it("defaults to current mode when no indicators", () => {
    expect(decideExecutionMode("haz algo", "interactive", "pro")).toBe("interactive");
    expect(decideExecutionMode("haz algo", "auto", "pro")).toBe("auto");
  });
});

// ─── Delegation ─────────────────────────────────────────────────

describe("decideDelegation", () => {
  it("never delegates without a project", () => {
    const { shouldDelegate } = decideDelegation("crear sistema completo", "pro", false);
    expect(shouldDelegate).toBe(false);
  });

  it("never delegates for free plan", () => {
    const { shouldDelegate } = decideDelegation("crear sistema completo", "free", true);
    expect(shouldDelegate).toBe(false);
  });

  it("delegates for complex architecture tasks", () => {
    const { shouldDelegate } = decideDelegation("refactorizar la arquitectura", "pro", true);
    expect(shouldDelegate).toBe(true);
  });

  it("stays inline for simple edits", () => {
    const { shouldDelegate } = decideDelegation("cambiar color del botón", "pro", true);
    expect(shouldDelegate).toBe(false);
  });
});

// ─── SDD Init ───────────────────────────────────────────────────

describe("calibrateProject", () => {
  it("detects stack from root files", () => {
    const snapshot: ProjectSnapshot = {
      stack: [],
      testRunner: null,
      hasGit: true,
      packageManager: null,
      rootFiles: ["tsconfig.json", "vite.config.ts", "tailwind.config.ts", "package-lock.json"],
      conventions: [],
      isOpen: true,
    };

    const calibrated = calibrateProject(snapshot);
    expect(calibrated.stack).toContain("typescript");
    expect(calibrated.stack).toContain("vite");
    expect(calibrated.stack).toContain("tailwindcss");
    expect(calibrated.packageManager).toBe("npm");
  });

  it("returns unchanged when not open", () => {
    const snapshot: ProjectSnapshot = {
      stack: [],
      testRunner: null,
      hasGit: false,
      packageManager: null,
      rootFiles: ["tsconfig.json"],
      conventions: [],
      isOpen: false,
    };

    const calibrated = calibrateProject(snapshot);
    expect(calibrated.stack).toEqual([]);
  });
});

describe("detectTestRunner", () => {
  it("detects vitest", () => {
    expect(detectTestRunner({ test: "vitest run" })).toBe("vitest");
  });

  it("detects jest", () => {
    expect(detectTestRunner({ test: "jest --coverage" })).toBe("jest");
  });

  it("returns null when no test script", () => {
    expect(detectTestRunner({ start: "vite" })).toBeNull();
  });
});

// ─── Artifact Store ─────────────────────────────────────────────

describe("decideArtifactStore", () => {
  it("returns none for free plan", () => {
    expect(decideArtifactStore("free", "none", [])).toBe("none");
  });

  it("returns hybrid when project has openspec", () => {
    expect(decideArtifactStore("pro", "none", ["openspec"])).toBe("hybrid");
  });

  it("returns engram as default for paid plans", () => {
    expect(decideArtifactStore("pro", "none", [])).toBe("engram");
    expect(decideArtifactStore("estudiante", "none", [])).toBe("engram");
  });

  it("respects explicit mode choice", () => {
    expect(decideArtifactStore("pro", "hybrid", [])).toBe("hybrid");
  });
});
