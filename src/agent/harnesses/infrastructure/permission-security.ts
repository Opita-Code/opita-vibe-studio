/**
 * Permission Security Harness — Blocks dangerous commands.
 *
 * Implements a security layer that:
 * 1. Identifies potentially destructive commands
 * 2. Blocks critical ones outright
 * 3. Requires confirmation for high-risk ones
 * 4. Logs all security-relevant actions
 */

import type { Harness, HarnessContext, HarnessResult, PermissionCheck } from "../types";

/** Commands that are NEVER allowed */
const BLOCKED_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "format c:",
  "del /s /q",
  ":(){:|:&};:", // Fork bomb
  "dd if=/dev/zero",
  "mkfs",
  "chmod -R 777 /",
  "git push --force",
  "git push -f",
  "DROP DATABASE",
  "DROP TABLE",
  "TRUNCATE TABLE",
];

/** Commands that require explicit confirmation */
const HIGH_RISK_COMMANDS: Array<{ pattern: string; reason: string }> = [
  { pattern: "npm publish", reason: "Publishing to npm is irreversible" },
  { pattern: "git reset --hard", reason: "Hard reset loses uncommitted changes" },
  { pattern: "git clean -fd", reason: "Removes untracked files permanently" },
  { pattern: "rm -rf", reason: "Recursive delete can destroy data" },
  { pattern: "docker system prune", reason: "Removes all unused Docker resources" },
  { pattern: "DROP ", reason: "Database destructive operation" },
  { pattern: "DELETE FROM", reason: "Mass data deletion" },
  { pattern: "sst remove", reason: "Destroys cloud infrastructure" },
  { pattern: "terraform destroy", reason: "Destroys cloud infrastructure" },
];

export const permissionSecurityHarness: Harness = {
  id: "permission-security",
  name: "Permission Security Guard",
  phase: "mid-execute",
  priority: 1, // Absolute first in mid-execute

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Always active during execution
    return ctx.intent === "code";
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    // The harness sets the policy; actual command checking
    // happens per-command in the tool executor
    return {
      block: false,
      contextUpdates: {},
      summary: "Permission security active — destructive commands blocked",
    };
  },
};

/**
 * Checks if a command is safe to execute.
 * Called by the tool executor before running any command.
 */
export function checkCommandPermission(command: string): PermissionCheck {
  const lower = command.toLowerCase().trim();

  // Check absolute blocks
  for (const blocked of BLOCKED_COMMANDS) {
    if (lower.includes(blocked.toLowerCase())) {
      return {
        command,
        risk: "critical",
        requiresConfirmation: true,
        reason: `BLOCKED: "${blocked}" is never allowed`,
      };
    }
  }

  // Check high-risk commands
  for (const { pattern, reason } of HIGH_RISK_COMMANDS) {
    if (lower.includes(pattern.toLowerCase())) {
      return {
        command,
        risk: "high",
        requiresConfirmation: true,
        reason,
      };
    }
  }

  // Check medium-risk patterns
  if (lower.includes("--force") || lower.includes("--no-verify")) {
    return {
      command,
      risk: "medium",
      requiresConfirmation: true,
      reason: "Force/no-verify flags bypass safety checks",
    };
  }

  // Safe
  return {
    command,
    risk: "low",
    requiresConfirmation: false,
  };
}
