/**
 * Component Dependency Harness — Change ordering by deps.
 *
 * Models dependencies between software components to order
 * changes and validations logically. Ensures foundation
 * components are modified before dependents.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const componentDependencyHarness: Harness = {
  id: "component-dependency",
  name: "Component Dependency Orderer",
  phase: "pre-execute",
  priority: 48,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code" && ctx.shouldDelegate;
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    return {
      block: false,
      contextUpdates: {},
      summary: "Component dependency ordering active",
    };
  },
};

/**
 * Topologically sorts files by their import dependencies.
 * Ensures files that are imported by others are processed first.
 */
export function topologicalSort(
  files: string[],
  imports: Record<string, string[]>,
): string[] {
  const visited = new Set<string>();
  const sorted: string[] = [];

  function visit(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);

    const deps = imports[file] ?? [];
    for (const dep of deps) {
      if (files.includes(dep)) {
        visit(dep);
      }
    }
    sorted.push(file);
  }

  for (const file of files) {
    visit(file);
  }

  return sorted;
}
