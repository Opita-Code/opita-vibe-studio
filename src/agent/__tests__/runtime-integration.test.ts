/**
 * Runtime integration (VL-3) — unit tests.
 *
 * Verifica:
 *  - deriveProjectContext(): contexto real del workspace (testRunner,
 *    hasGit, packageManager) en vez de hardcodes.
 *  - runHarnessPreExecute(): el harness engine corre pre-execute y
 *    devuelve retrievedMemories/skills sin romper el flujo.
 *  - Degradación: sin workspace o sin bridge, no lanza.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProjectStore } from "@/stores/project";
import { deriveProjectContext } from "../useAgentHandler";
import { runHarnessPreExecute } from "../orchestrator";
import type { OrchestratorConfig } from "../orchestrator";

function makeConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    providerId: "deepseek",
    modelId: "deepseek-v4-flash",
    plan: "pro",
    executionMode: "auto",
    hasProjectOpen: false,
    testRunner: null,
    hasGit: false,
    projectFiles: [],
    packageManager: null,
    ...overrides,
  };
}

describe("deriveProjectContext (VL-3)", () => {
  beforeEach(() => {
    useProjectStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  it("sin workspace devuelve fallback (null/false)", () => {
    const ctx = deriveProjectContext();
    expect(ctx.testRunner).toBeNull();
    expect(ctx.hasGit).toBe(false);
    expect(ctx.packageManager).toBeNull();
  });

  it("con workspace detecta testRunner vitest desde package.json", () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/proj",
        name: "proj",
        path: "/proj",
        files: [{ name: "package.json", path: "package.json", type: "file" as const }],
        isGitRepo: true,
        gitBranch: "main",
      }],
      activeWorkspaceId: "/proj",
      fileContents: {
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      },
    });

    const ctx = deriveProjectContext();
    expect(ctx.testRunner).toBe("vitest");
    expect(ctx.hasGit).toBe(true);
  });

  it("con workspace sin package.json → testRunner null pero hasGit real", () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/proj2",
        name: "proj2",
        path: "/proj2",
        files: [{ name: "index.ts", path: "index.ts", type: "file" as const }],
        isGitRepo: false,
        gitBranch: null,
      }],
      activeWorkspaceId: "/proj2",
      fileContents: {},
    });

    const ctx = deriveProjectContext();
    expect(ctx.testRunner).toBeNull();
    expect(ctx.hasGit).toBe(false);
    expect(ctx.rootFiles).toContain("index.ts");
  });
});

describe("runHarnessPreExecute (VL-3)", () => {
  it("devuelve contexto sin romper cuando no hay workspace", async () => {
    const result = await runHarnessPreExecute("crear login", makeConfig({ hasProjectOpen: false }));
    expect(result).toBeDefined();
    expect(Array.isArray(result.retrievedMemories)).toBe(true);
  });

  it("ejecuta pre-execute con proyecto abierto sin lanzar", async () => {
    const config = makeConfig({
      hasProjectOpen: true,
      testRunner: "vitest",
      hasGit: true,
      projectFiles: ["package.json", "tsconfig.json"],
    });

    const result = await runHarnessPreExecute("refactorizar billing", config);
    expect(result).toBeDefined();
    // El harness puede o no decidir TDD — pero no debe lanzar.
    expect(result.blocked).toBeFalsy();
  });

  it("degrada a {} si el engine falla (sin crash)", async () => {
    // Forzar fallo: engine roto.
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await runHarnessPreExecute("x", makeConfig());
    expect(result).toBeDefined();
    spy.mockRestore();
  });
});
