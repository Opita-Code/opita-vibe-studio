/**
 * Chain Strategy Harness — PR geometry management.
 *
 * When stacked/chained PRs are used, this harness manages
 * the branch targeting strategy:
 *
 * - stacked-to-main: Each PR targets previous PR's branch (or main)
 * - feature-branch-chain: PR #1 targets feature branch, children target previous
 */

import type { Harness, HarnessContext, HarnessResult, ChainStrategy } from "../types";

export const chainStrategyHarness: Harness = {
  id: "chain-strategy",
  name: "Chain Strategy Manager",
  phase: "pre-deliver",
  priority: 20,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.deliveryStrategy === "stacked-pr";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const chain = decideChainStrategy(ctx.userText);

    return {
      block: false,
      contextUpdates: { chainStrategy: chain },
      summary: `Chain strategy: ${chain}`,
    };
  },
};

/**
 * Decides which chain strategy to use for stacked PRs.
 */
export function decideChainStrategy(userText: string): ChainStrategy {
  const lower = userText.toLowerCase();

  // User explicitly mentions feature branch
  if (lower.includes("feature branch") || lower.includes("rama feature")) {
    return "feature-branch-chain";
  }

  // Default: stacked to main (simpler for most workflows)
  return "stacked-to-main";
}

/**
 * Calculates branch targeting for a chain slice.
 *
 * @param strategy - The chain strategy in use
 * @param sliceIndex - 0-based index of the current slice
 * @param mainBranch - Name of the main branch (e.g., "main")
 * @param featureBranch - Name of the feature branch (for feature-branch-chain)
 * @returns The target branch for this slice's PR
 */
export function getChainTarget(
  strategy: ChainStrategy,
  sliceIndex: number,
  mainBranch: string = "main",
  featureBranch?: string,
): string {
  if (strategy === "stacked-to-main") {
    return sliceIndex === 0 ? mainBranch : `slice-${sliceIndex}`;
  }

  if (strategy === "feature-branch-chain") {
    if (sliceIndex === 0) return featureBranch ?? `feature/change`;
    return `slice-${sliceIndex}`;
  }

  return mainBranch;
}
