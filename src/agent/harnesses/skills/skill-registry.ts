/**
 * Skill Registry Harness — Index of reusable capabilities.
 *
 * Maintains an index of available skills (conventions, tools,
 * patterns) that the agent can apply. The registry enables
 * the agent to know WHAT tools are available without loading
 * all skill files upfront.
 *
 * In Vibe Studio context, skills include:
 * - Project-detected conventions (ESLint, Prettier, etc.)
 * - Framework patterns (React hooks, Zustand stores)
 * - Testing patterns (Vitest, Playwright)
 * - Deployment patterns (SST, S3)
 */

import type { Harness, HarnessContext, HarnessResult, SkillEntry } from "../types";

/** Built-in skills that are always available */
const BUILTIN_SKILLS: SkillEntry[] = [
  {
    id: "html-css-js",
    name: "HTML/CSS/JS Basics",
    triggers: [".html", ".css", ".js", "web", "sitio", "página"],
    compactRules: "Use semantic HTML5. CSS custom properties for theming. ES modules.",
  },
  {
    id: "react-patterns",
    name: "React Patterns",
    triggers: [".tsx", ".jsx", "react", "componente", "hook", "estado"],
    compactRules: [
      "Functional components only. No class components.",
      "Hooks at top level, never conditional.",
      "Custom hooks prefixed with 'use'.",
      "Props destructured in function signature.",
      "Prefer Zustand over Context for shared state.",
    ].join("\n"),
  },
  {
    id: "typescript-strict",
    name: "TypeScript Strict",
    triggers: [".ts", ".tsx", "typescript", "tipos"],
    compactRules: [
      "Strict mode enabled. No 'any' unless justified.",
      "Prefer 'interface' for public API, 'type' for unions.",
      "Use 'satisfies' for type validation without widening.",
      "Export types separately from values.",
    ].join("\n"),
  },
  {
    id: "tailwind-patterns",
    name: "Tailwind CSS",
    triggers: ["tailwind", ".css", "clase css", "estilo"],
    compactRules: [
      "Use Tailwind utility classes over custom CSS.",
      "Group: layout → spacing → typography → visual → state.",
      "Extract repeated patterns to @apply only in component CSS.",
      "Use CSS variables for brand colors in tailwind.config.",
    ].join("\n"),
  },
  {
    id: "vitest-testing",
    name: "Vitest Testing",
    triggers: [".test.", ".spec.", "test", "prueba", "vitest"],
    compactRules: [
      "Describe blocks group related tests.",
      "Test names describe behavior, not implementation.",
      "Use 'vi.fn()' for mocks, 'vi.spyOn()' for spying.",
      "One assertion per test when possible.",
    ].join("\n"),
  },
];

export const skillRegistryHarness: Harness = {
  id: "skill-registry",
  name: "Skill Registry Loader",
  phase: "pre-execute",
  priority: 30, // After init (1) and dependency checks (15-20)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Always activate for code/explore tasks
    return ctx.intent === "code" || ctx.intent === "explore";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const skills = resolveSkills(ctx.userText, ctx.project.stack);

    return {
      block: false,
      contextUpdates: {
        resolvedSkills: skills,
        skillResolution: skills.length > 0 ? "injected" : "none",
      },
      summary: skills.length > 0
        ? `Resolved ${skills.length} skills: [${skills.map((s) => s.id).join(", ")}]`
        : "No matching skills",
    };
  },
};

/**
 * Resolves which skills match the current task.
 * Matches on user text AND detected stack.
 */
export function resolveSkills(
  userText: string,
  stack: string[],
): SkillEntry[] {
  const lower = userText.toLowerCase();
  const matched: SkillEntry[] = [];

  for (const skill of BUILTIN_SKILLS) {
    const textMatch = skill.triggers.some((t) => lower.includes(t.toLowerCase()));
    const stackMatch = skill.triggers.some((t) =>
      stack.some((s) => s.toLowerCase().includes(t.toLowerCase().replace(".", "")))
    );

    if (textMatch || stackMatch) {
      matched.push(skill);
    }
  }

  // Cap at 5 most relevant
  return matched.slice(0, 5);
}

/**
 * Generates the Project Standards block for injection into
 * sub-agent prompts.
 */
export function generateProjectStandards(skills: SkillEntry[]): string {
  if (skills.length === 0) return "";

  const blocks = skills.map(
    (s) => `### ${s.name}\n${s.compactRules}`
  );

  return `## Project Standards (auto-resolved)\n\n${blocks.join("\n\n")}`;
}
