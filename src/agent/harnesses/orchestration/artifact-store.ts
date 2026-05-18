/**
 * Artifact Store Harness — Persistence mode selector.
 *
 * The chat is NOT the source of truth. State must persist in
 * artifacts — either in Engram, the filesystem (OpenSpec), both, or none.
 *
 * Decision:
 * - Pro users with SDD → engram (default) or hybrid
 * - Estudiante users → engram
 * - Free users → none (chat-only, no persistence)
 * - User explicit choice overrides everything
 */

import type { Harness, HarnessContext, HarnessResult, ArtifactStoreMode } from "../types";

export const artifactStoreHarness: Harness = {
  id: "artifact-store",
  name: "Artifact Store Selector",
  phase: "post-classify",
  priority: 25,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Relevant when doing code work that might need persistence
    return ctx.intent === "code" || ctx.intent === "explore";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const mode = decideArtifactStore(ctx.plan, ctx.artifactStore, ctx.project.conventions);

    return {
      block: false,
      contextUpdates: { artifactStore: mode },
      summary: `Artifact store: ${mode}`,
    };
  },
};

/**
 * Decides which artifact store mode to use.
 * Pure function — easy to test.
 */
export function decideArtifactStore(
  plan: "free" | "estudiante" | "pro",
  currentMode: ArtifactStoreMode,
  conventions: string[],
): ArtifactStoreMode {
  // If already explicitly set (user preference), respect it
  if (currentMode !== "none") return currentMode;

  // Free plan → no persistence
  if (plan === "free") return "none";

  // Project has OpenSpec → hybrid (engram + files)
  if (conventions.includes("openspec")) return "hybrid";

  // Default for paid plans: engram (lightweight, cross-session)
  return "engram";
}
