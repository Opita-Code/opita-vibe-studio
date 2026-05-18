/**
 * Backup Harness — Snapshots before critical changes.
 *
 * Creates restore points before modifying configurations
 * or critical assets. Functions as a safety net.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

/** File patterns that trigger backup before modification */
const CRITICAL_PATTERNS = [
  "package.json",
  "tsconfig.json",
  "sst.config",
  ".env",
  "tailwind.config",
  "vite.config",
  "next.config",
  "docker-compose",
  "Dockerfile",
  ".github/workflows",
];

export const backupHarness: Harness = {
  id: "backup",
  name: "Backup Safety Net",
  phase: "pre-execute",
  priority: 60,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code" && ctx.project.hasGit;
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    // The backup policy is set; actual backup happens in the tool layer
    return {
      block: false,
      contextUpdates: {},
      summary: "Backup policy active — critical files will be snapshotted before modification",
    };
  },
};

/**
 * Determines if a file path is critical and needs backup.
 */
export function isCriticalFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return CRITICAL_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Generates a backup identifier for a file.
 */
export function generateBackupId(filePath: string): string {
  const timestamp = Date.now();
  const sanitized = filePath.replace(/[/\\:]/g, "_");
  return `backup_${sanitized}_${timestamp}`;
}
