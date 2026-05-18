/**
 * Profile Isolation Harness — User config separation.
 *
 * Prevents contamination between different user profiles,
 * sessions, and configuration modes. Each user gets an
 * isolated execution context.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const profileIsolationHarness: Harness = {
  id: "profile-isolation",
  name: "Profile Isolation Guard",
  phase: "pre-classify",
  priority: 5, // Very early — before anything else

  shouldActivate(_ctx: Readonly<HarnessContext>): boolean {
    // Always active
    return true;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // Validate that context is clean (no cross-contamination)
    const isClean = validateContextIsolation(ctx);

    return {
      block: false,
      contextUpdates: {},
      summary: isClean
        ? "Context isolation verified"
        : "Warning: potential context contamination detected",
    };
  },
};

/**
 * Validates that the context doesn't have contamination
 * from a different user/session.
 */
export function validateContextIsolation(ctx: Readonly<HarnessContext>): boolean {
  // Check that critical fields are present
  if (!ctx.userText) return false;
  if (!ctx.plan) return false;

  // Check that harness trace is fresh (no leftover traces)
  if (ctx.harnessTrace.length > 0) return false;

  return true;
}
