import { describe, it, expect } from "vitest";
import {
  detectStack,
  detectTestRunner,
  detectPackageManager,
  detectConventions,
  detectSkills,
  buildProjectContext,
} from "../context-loader";

describe("context-loader", () => {
  // ─── detectStack ────────────────────────────────────────────

  describe("detectStack", () => {
    it("should detect React + Vite + TypeScript", () => {
      const stack = detectStack({
        dependencies: { react: "^18.0.0" },
        devDependencies: { vite: "^5.0.0", typescript: "^5.0.0" },
      });
      expect(stack).toContain("react");
      expect(stack).toContain("vite");
      expect(stack).toContain("typescript");
    });

    it("should detect Next.js", () => {
      const stack = detectStack({
        dependencies: { next: "^14.0.0", react: "^18.0.0" },
      });
      expect(stack).toContain("next");
      expect(stack).toContain("react");
    });

    it("should detect Tailwind and Zustand", () => {
      const stack = detectStack({
        devDependencies: { tailwindcss: "^3.0.0" },
        dependencies: { zustand: "^4.0.0" },
      });
      expect(stack).toContain("tailwind");
      expect(stack).toContain("zustand");
    });

    it("should detect Tauri", () => {
      const stack = detectStack({
        dependencies: { "@tauri-apps/api": "^2.0.0" },
      });
      expect(stack).toContain("tauri");
    });

    it("should return empty array for empty package.json", () => {
      expect(detectStack({})).toEqual([]);
    });
  });

  // ─── detectTestRunner ───────────────────────────────────────

  describe("detectTestRunner", () => {
    it("should detect vitest from devDependencies", () => {
      expect(
        detectTestRunner({ devDependencies: { vitest: "^1.0.0" } })
      ).toBe("vitest");
    });

    it("should detect jest from devDependencies", () => {
      expect(
        detectTestRunner({ devDependencies: { jest: "^29.0.0" } })
      ).toBe("jest");
    });

    it("should detect node:test from scripts", () => {
      expect(
        detectTestRunner({ scripts: { test: "node --test" } })
      ).toBe("node:test");
    });

    it("should detect vitest from test script", () => {
      expect(
        detectTestRunner({ scripts: { test: "vitest run" } })
      ).toBe("vitest");
    });

    it("should return null when no test runner found", () => {
      expect(detectTestRunner({})).toBeNull();
    });
  });

  // ─── detectPackageManager ───────────────────────────────────

  describe("detectPackageManager", () => {
    it("should detect npm from package-lock.json", () => {
      expect(detectPackageManager(["package-lock.json"])).toBe("npm");
    });

    it("should detect pnpm from pnpm-lock.yaml", () => {
      expect(detectPackageManager(["pnpm-lock.yaml"])).toBe("pnpm");
    });

    it("should detect bun from bun.lockb", () => {
      expect(detectPackageManager(["bun.lockb"])).toBe("bun");
    });

    it("should detect yarn from yarn.lock", () => {
      expect(detectPackageManager(["yarn.lock"])).toBe("yarn");
    });

    it("should return null when no lockfile found", () => {
      expect(detectPackageManager(["README.md"])).toBeNull();
    });

    it("should prioritize bun over npm", () => {
      expect(
        detectPackageManager(["bun.lockb", "package-lock.json"])
      ).toBe("bun");
    });
  });

  // ─── detectConventions ──────────────────────────────────────

  describe("detectConventions", () => {
    it("should detect __tests__ pattern", () => {
      const conventions = detectConventions([
        "src/agent/__tests__/intent.test.ts",
      ]);
      expect(conventions).toContain("__tests__ directory pattern");
    });

    it("should detect src/components structure", () => {
      const conventions = detectConventions([
        "src/components/Header.tsx",
      ]);
      expect(conventions).toContain("src/components structure");
    });

    it("should detect ESLint configuration", () => {
      const conventions = detectConventions([".eslintrc.json"]);
      expect(conventions).toContain("ESLint configured");
    });
  });

  // ─── detectSkills ───────────────────────────────────────────

  describe("detectSkills", () => {
    it("should detect React skill", () => {
      const skills = detectSkills(["react", "typescript"]);
      expect(skills.find((s) => s.id === "react")).toBeDefined();
      expect(skills.find((s) => s.id === "typescript")).toBeDefined();
    });

    it("should detect Vite skill with commands", () => {
      const skills = detectSkills(["vite"]);
      const vite = skills.find((s) => s.id === "vite");
      expect(vite).toBeDefined();
      expect(vite!.commands).toContain("npm run dev");
    });

    it("should return empty for unknown stack", () => {
      expect(detectSkills([])).toEqual([]);
    });
  });

  // ─── buildProjectContext ────────────────────────────────────

  describe("buildProjectContext", () => {
    it("should build complete context for a React + Vite project", () => {
      const ctx = buildProjectContext(
        "test-project",
        {
          dependencies: { react: "^18.0.0", zustand: "^4.0.0" },
          devDependencies: {
            vite: "^5.0.0",
            typescript: "^5.0.0",
            vitest: "^1.0.0",
            tailwindcss: "^3.0.0",
          },
          scripts: { test: "vitest run" },
        },
        [
          "package-lock.json",
          "src/components/App.tsx",
          "src/stores/auth.ts",
          "src/agent/__tests__/intent.test.ts",
          ".eslintrc.json",
        ]
      );

      expect(ctx.projectId).toBe("test-project");
      expect(ctx.stack).toContain("react");
      expect(ctx.stack).toContain("vite");
      expect(ctx.stack).toContain("typescript");
      expect(ctx.stack).toContain("tailwind");
      expect(ctx.stack).toContain("zustand");
      expect(ctx.testRunner).toBe("vitest");
      expect(ctx.packageManager).toBe("npm");
      expect(ctx.conventions).toContain("src/components structure");
      expect(ctx.conventions).toContain("__tests__ directory pattern");
      expect(ctx.skills.length).toBeGreaterThan(0);
      expect(ctx.lastUpdated).toBeGreaterThan(0);
    });
  });
});
