/**
 * SDD Init Harness — Project calibration.
 *
 * Detects the project's tech stack, test runner, conventions,
 * and package manager. Sets up the ProjectSnapshot that all
 * other harnesses depend on.
 *
 * Runs very early (pre-classify) because intent classification
 * itself depends on knowing whether a project is open.
 */

import type { Harness, HarnessContext, HarnessResult, ProjectSnapshot } from "../types";

/** Known test runner patterns in package.json scripts */
const TEST_RUNNER_PATTERNS: Record<string, string> = {
  vitest: "vitest",
  jest: "jest",
  mocha: "mocha",
  "node --test": "node:test",
  ava: "ava",
  tap: "tap",
  playwright: "playwright",
  cypress: "cypress",
};

/** Files that indicate specific stack technologies */
const STACK_INDICATORS: Record<string, string[]> = {
  "vite.config.ts": ["vite"],
  "vite.config.js": ["vite"],
  "next.config.js": ["nextjs"],
  "next.config.ts": ["nextjs"],
  "next.config.mjs": ["nextjs"],
  "nuxt.config.ts": ["nuxt"],
  "angular.json": ["angular"],
  "svelte.config.js": ["svelte"],
  "astro.config.mjs": ["astro"],
  "tailwind.config.ts": ["tailwindcss"],
  "tailwind.config.js": ["tailwindcss"],
  "postcss.config.js": ["postcss"],
  "tsconfig.json": ["typescript"],
  "jsconfig.json": ["javascript"],
  ".eslintrc.json": ["eslint"],
  ".prettierrc": ["prettier"],
  "biome.json": ["biome"],
  "go.mod": ["go"],
  "Cargo.toml": ["rust"],
  "pyproject.toml": ["python"],
  "requirements.txt": ["python"],
  "Gemfile": ["ruby"],
  "composer.json": ["php"],
  "sst.config.ts": ["sst", "aws"],
  "serverless.yml": ["serverless", "aws"],
  "Dockerfile": ["docker"],
  "docker-compose.yml": ["docker"],
};

/** Files that indicate package managers */
const PKG_MANAGER_INDICATORS: Record<string, ProjectSnapshot["packageManager"]> = {
  "bun.lockb": "bun",
  "bun.lock": "bun",
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "package-lock.json": "npm",
};

/** Files that indicate conventions */
const CONVENTION_INDICATORS: Record<string, string> = {
  ".editorconfig": "editorconfig",
  ".husky": "husky",
  "commitlint.config.js": "commitlint",
  ".commitlintrc.json": "commitlint",
  "AGENTS.md": "agents-md",
  ".atl/skill-registry.md": "skill-registry",
  "openspec/": "openspec",
};

export const sddInitHarness: Harness = {
  id: "sdd-init",
  name: "Project Calibration",
  phase: "pre-classify",
  priority: 1, // First to run — everything depends on this

  shouldActivate(_ctx: Readonly<HarnessContext>): boolean {
    // Always activate — project detection is always needed
    return true;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // If project info was already set by the caller (from stores),
    // we just compute additional derived fields
    const project = calibrateProject(ctx.project);

    return {
      block: false,
      contextUpdates: { project },
      summary: project.isOpen
        ? `Project: [${project.stack.join(", ")}], test: ${project.testRunner ?? "none"}, pkg: ${project.packageManager ?? "none"}`
        : "No project open",
    };
  },
};

/**
 * Calibrates a project snapshot from root files.
 * Pure function — takes existing snapshot and enriches it.
 */
export function calibrateProject(existing: ProjectSnapshot): ProjectSnapshot {
  if (!existing.isOpen || existing.rootFiles.length === 0) {
    return existing;
  }

  const rootFiles = existing.rootFiles;
  const rootSet = new Set(rootFiles.map((f) => f.toLowerCase()));

  // Detect stack
  const stack = new Set(existing.stack);
  for (const [file, techs] of Object.entries(STACK_INDICATORS)) {
    if (rootSet.has(file.toLowerCase())) {
      for (const tech of techs) stack.add(tech);
    }
  }

  // Detect package manager
  let packageManager = existing.packageManager;
  if (!packageManager) {
    for (const [file, pm] of Object.entries(PKG_MANAGER_INDICATORS)) {
      if (rootSet.has(file.toLowerCase())) {
        packageManager = pm;
        break;
      }
    }
  }

  // Detect conventions
  const conventions = new Set(existing.conventions);
  for (const [file, conv] of Object.entries(CONVENTION_INDICATORS)) {
    if (rootSet.has(file.toLowerCase())) {
      conventions.add(conv);
    }
  }

  // React detection (check for .tsx files or react in package.json deps)
  if (rootSet.has("package.json") && (stack.has("vite") || stack.has("nextjs"))) {
    stack.add("react");
  }

  return {
    ...existing,
    stack: [...stack],
    packageManager,
    conventions: [...conventions],
  };
}

/**
 * Detects the test runner from package.json scripts.
 * Pure function — pass the `scripts` object from package.json.
 */
export function detectTestRunner(
  scripts: Record<string, string> | undefined,
): string | null {
  if (!scripts) return null;

  const testScript = scripts["test"] || scripts["test:unit"] || "";

  for (const [pattern, runner] of Object.entries(TEST_RUNNER_PATTERNS)) {
    if (testScript.includes(pattern)) return runner;
  }

  return null;
}
