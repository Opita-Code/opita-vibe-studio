/**
 * MCP Injection Harness — Model Context Protocol management.
 *
 * Controls which MCP capabilities are active and in which
 * phases they should be applied. Prevents unnecessary tool
 * loading and ensures the right capabilities are available.
 */

import type { Harness, HarnessContext, HarnessResult, SDDPhase } from "../types";

/** Which MCP tools are relevant for each phase */
const PHASE_MCP_MAP: Partial<Record<SDDPhase, string[]>> = {
  explore: ["read_file", "list_files", "search_code"],
  apply: ["read_file", "write_file", "apply_diff", "list_files", "search_code", "execute_command"],
  verify: ["read_file", "execute_command", "search_code"],
};

/** Tools that are always available */
const UNIVERSAL_TOOLS = ["read_file", "list_files"];

export const mcpInjectionHarness: Harness = {
  id: "mcp-injection",
  name: "MCP Capability Manager",
  phase: "pre-execute",
  priority: 45,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const tools = getToolsForPhase(ctx.currentPhase);

    return {
      block: false,
      contextUpdates: {},
      summary: `MCP tools: [${tools.join(", ")}]`,
    };
  },
};

/**
 * Returns the list of MCP tools available for a given phase.
 */
export function getToolsForPhase(phase?: SDDPhase): string[] {
  if (!phase) return UNIVERSAL_TOOLS;
  return PHASE_MCP_MAP[phase] ?? UNIVERSAL_TOOLS;
}
