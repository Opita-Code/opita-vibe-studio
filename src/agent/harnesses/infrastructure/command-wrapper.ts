/**
 * Command Wrapper Harness — Normalized command execution.
 *
 * Wraps executed commands to normalize outputs, apply logging,
 * and manage confirmations in a standardized way.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const commandWrapperHarness: Harness = {
  id: "command-wrapper",
  name: "Command Wrapper",
  phase: "mid-execute",
  priority: 10,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code";
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    return {
      block: false,
      contextUpdates: {},
      summary: "Command wrapper active — outputs will be normalized",
    };
  },
};

/**
 * Normalizes command output for consistent processing.
 * Removes ANSI color codes and trims excess whitespace.
 */
export function normalizeOutput(raw: string): string {
  // Strip ANSI escape codes
  const stripped = raw.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );

  // Trim trailing whitespace per line
  return stripped
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Truncates output to a maximum character count.
 * Preserves the end (most recent output) if truncating.
 */
export function truncateOutput(output: string, maxChars: number = 5000): string {
  if (output.length <= maxChars) return output;

  const truncated = output.slice(-maxChars);
  return `... [truncated ${output.length - maxChars} chars] ...\n${truncated}`;
}

/**
 * Extracts exit code from a command execution result.
 */
export function extractExitCode(result: string): number | null {
  const match = result.match(/exit (?:code|status)[:\s]+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}
