/**
 * Context Loader — Auto-detects project context on load.
 *
 * Runs once when a project is opened. Detects:
 * - Tech stack (React, Vue, Astro, etc.)
 * - Package manager (npm, pnpm, bun, yarn)
 * - Test runner (vitest, jest, playwright, etc.)
 * - Conventions (file patterns, naming)
 *
 * The result is cached as ProjectContext and used by agents
 * to make informed decisions about tools and prompts.
 */

import type { ProjectContext, AgentSkill } from "./types";

// ─── Detection Logic ───────────────────────────────────────────

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/**
 * Detects the tech stack from package.json dependencies.
 */
export function detectStack(pkg: PackageJson): string[] {
  const stack: string[] = [];
  const all = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Frameworks
  if (all["react"]) stack.push("react");
  if (all["next"]) stack.push("next");
  if (all["vue"]) stack.push("vue");
  if (all["nuxt"]) stack.push("nuxt");
  if (all["svelte"]) stack.push("svelte");
  if (all["astro"]) stack.push("astro");
  if (all["@angular/core"]) stack.push("angular");

  // Build tools
  if (all["vite"]) stack.push("vite");
  if (all["webpack"]) stack.push("webpack");
  if (all["esbuild"]) stack.push("esbuild");
  if (all["turbopack"]) stack.push("turbopack");

  // Language
  if (all["typescript"]) stack.push("typescript");

  // Styling
  if (all["tailwindcss"]) stack.push("tailwind");
  if (all["styled-components"]) stack.push("styled-components");

  // State
  if (all["zustand"]) stack.push("zustand");
  if (all["redux"] || all["@reduxjs/toolkit"]) stack.push("redux");

  // Backend
  if (all["express"]) stack.push("express");
  if (all["fastify"]) stack.push("fastify");
  if (all["hono"]) stack.push("hono");

  // DB
  if (all["prisma"] || all["@prisma/client"]) stack.push("prisma");
  if (all["drizzle-orm"]) stack.push("drizzle");

  // Desktop
  if (all["@tauri-apps/api"]) stack.push("tauri");
  if (all["electron"]) stack.push("electron");

  return stack;
}

/**
 * Detects the test runner from package.json.
 */
export function detectTestRunner(pkg: PackageJson): string | null {
  const all = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  const scripts = pkg.scripts || {};

  // Check devDependencies first (most reliable)
  if (all["vitest"]) return "vitest";
  if (all["jest"]) return "jest";
  if (all["mocha"]) return "mocha";
  if (all["ava"]) return "ava";

  // Check scripts for runner hints
  const testScript = scripts["test"] || "";
  if (testScript.includes("vitest")) return "vitest";
  if (testScript.includes("jest")) return "jest";
  if (testScript.includes("mocha")) return "mocha";
  if (testScript.includes("node:test") || testScript.includes("node --test"))
    return "node:test";

  return null;
}

/**
 * Detects the package manager from lockfile presence.
 */
export function detectPackageManager(
  files: string[]
): "npm" | "pnpm" | "bun" | "yarn" | null {
  const fileSet = new Set(files.map((f) => f.toLowerCase()));

  if (fileSet.has("bun.lockb") || fileSet.has("bun.lock")) return "bun";
  if (fileSet.has("pnpm-lock.yaml")) return "pnpm";
  if (fileSet.has("yarn.lock")) return "yarn";
  if (fileSet.has("package-lock.json")) return "npm";

  return null;
}

/**
 * Detects project conventions from file patterns.
 */
export function detectConventions(files: string[]): string[] {
  const conventions: string[] = [];

  const hasPattern = (pattern: string) =>
    files.some((f) => f.toLowerCase().includes(pattern));

  // Test conventions
  if (hasPattern("__tests__")) conventions.push("__tests__ directory pattern");
  if (hasPattern(".test.ts") || hasPattern(".test.tsx"))
    conventions.push("*.test.ts naming");
  if (hasPattern(".spec.ts") || hasPattern(".spec.tsx"))
    conventions.push("*.spec.ts naming");

  // Project structure
  if (hasPattern("src/components")) conventions.push("src/components structure");
  if (hasPattern("src/stores") || hasPattern("src/store"))
    conventions.push("centralized state management");
  if (hasPattern("src/lib") || hasPattern("src/utils"))
    conventions.push("shared utilities in src/lib or src/utils");

  // Config files
  if (hasPattern(".eslintrc") || hasPattern("eslint.config"))
    conventions.push("ESLint configured");
  if (hasPattern(".prettierrc") || hasPattern("prettier.config"))
    conventions.push("Prettier configured");

  return conventions;
}

/**
 * Detects built-in skills based on detected stack.
 */
export function detectSkills(stack: string[]): AgentSkill[] {
  const skills: AgentSkill[] = [];
  const stackSet = new Set(stack);

  if (stackSet.has("react")) {
    skills.push({
      id: "react",
      name: "React",
      patterns: ["*.tsx", "*.jsx"],
      source: "detected",
    });
  }

  if (stackSet.has("typescript")) {
    skills.push({
      id: "typescript",
      name: "TypeScript",
      commands: ["npx tsc --noEmit"],
      patterns: ["*.ts", "*.tsx"],
      source: "detected",
    });
  }

  if (stackSet.has("tailwind")) {
    skills.push({
      id: "tailwind",
      name: "Tailwind CSS",
      patterns: ["tailwind.config.*"],
      source: "detected",
    });
  }

  if (stackSet.has("vite")) {
    skills.push({
      id: "vite",
      name: "Vite",
      commands: ["npm run dev", "npm run build"],
      patterns: ["vite.config.*"],
      source: "detected",
    });
  }

  return skills;
}

/**
 * Builds a complete ProjectContext from raw project data.
 *
 * This is the main entry point — call this once when a project is opened.
 */
export function buildProjectContext(
  projectId: string,
  pkg: PackageJson,
  rootFiles: string[]
): ProjectContext {
  const stack = detectStack(pkg);
  const testRunner = detectTestRunner(pkg);
  const packageManager = detectPackageManager(rootFiles);
  const conventions = detectConventions(rootFiles);
  const skills = detectSkills(stack);

  return {
    projectId,
    stack,
    testRunner,
    packageManager,
    conventions,
    skills,
    lastUpdated: Date.now(),
  };
}
