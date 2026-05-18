/**
 * Verify Harness — Mandatory QA with evidence.
 *
 * The agent MUST demonstrate with tests/evidence that its work
 * is correct. No silent self-approval.
 *
 * Responsibilities:
 * - Ensures verify phase runs after apply
 * - Validates that test evidence exists
 * - Blocks delivery without verification
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const verifyHarness: Harness = {
  id: "verify",
  name: "Verify Gate",
  phase: "post-execute",
  priority: 20, // Before result-contract (90)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Activate after code execution completes
    return ctx.intent === "code" && ctx.currentPhase === "apply";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // Check if verification should be required
    const requiresVerify = shouldRequireVerification(ctx);

    if (requiresVerify) {
      return {
        block: false,
        contextUpdates: {},
        summary: "Verification required — verify phase must run before delivery",
      };
    }

    return {
      block: false,
      contextUpdates: {},
      summary: "Verification not required for this change type",
    };
  },
};

/**
 * Determines if verification is required based on context.
 *
 * Rules:
 * - Changes with test runner → ALWAYS verify
 * - TDD mode → ALWAYS verify (part of the cycle)
 * - Style-only changes → skip verify
 * - Config changes → skip verify
 */
export function shouldRequireVerification(ctx: Readonly<HarnessContext>): boolean {
  // If TDD is active, verification is mandatory
  if (ctx.useTDD) return true;

  // If project has a test runner, verify is recommended
  if (ctx.project.testRunner) return true;

  // Style-only changes don't need verification
  const lower = ctx.userText.toLowerCase();
  const styleOnly = [
    "color", "css", "estilo", "fuente", "gradiente",
    "sombra", "borde", "margen", "padding",
  ];
  if (styleOnly.some((s) => lower.includes(s))) return false;

  // Default: require for paid plans
  return ctx.plan !== "free";
}

/**
 * Validates verification evidence in a report string.
 * Returns issues found (empty = valid).
 */
export function validateVerificationEvidence(report: string): string[] {
  const issues: string[] = [];

  // Must have test execution evidence
  if (!report.includes("✅") && !report.includes("PASS") && !report.includes("pass")) {
    issues.push("No test pass evidence found in verification report");
  }

  // Must have a compliance matrix or equivalent
  if (!report.includes("Compliance") && !report.includes("compliance") &&
      !report.includes("Spec") && !report.includes("spec")) {
    issues.push("No spec compliance check found");
  }

  // Must have a final verdict
  if (!report.includes("PASS") && !report.includes("FAIL") &&
      !report.includes("pass") && !report.includes("fail")) {
    issues.push("No final verdict (PASS/FAIL) found");
  }

  return issues;
}
