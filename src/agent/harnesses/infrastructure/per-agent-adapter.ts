/**
 * Per-Agent Adapter Harness — Environment-aware instructions.
 *
 * Adapts instructions and capabilities based on the specific
 * agent environment (VS Code, Claude Code, Pi, web browser, etc.)
 *
 * In Vibe Studio, the primary environment is always "web-browser"
 * since it's a web IDE. But the adapter can detect capabilities
 * like filesystem access, terminal access, etc.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

/** Known agent environments */
export type AgentEnvironment = "web-browser" | "vscode" | "terminal" | "desktop";

/** Environment capabilities */
export interface EnvironmentCapabilities {
  hasFileSystem: boolean;
  hasTerminal: boolean;
  hasGitIntegration: boolean;
  hasBrowserPreview: boolean;
  maxContextTokens: number;
}

/** Default capabilities for Vibe Studio (web-browser) */
const WEB_BROWSER_CAPS: EnvironmentCapabilities = {
  hasFileSystem: true,  // Via File System Access API or sandbox
  hasTerminal: false,   // No terminal in browser
  hasGitIntegration: false, // No direct git in browser
  hasBrowserPreview: true,  // VibeLens preview
  maxContextTokens: 16000,
};

export const perAgentAdapterHarness: Harness = {
  id: "per-agent-adapter",
  name: "Agent Environment Adapter",
  phase: "pre-classify",
  priority: 3, // Very early

  shouldActivate(_ctx: Readonly<HarnessContext>): boolean {
    return true;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const caps = detectCapabilities(ctx);

    return {
      block: false,
      contextUpdates: {
        project: {
          ...ctx.project,
          // If no terminal, git is limited
          hasGit: caps.hasGitIntegration ? ctx.project.hasGit : false,
        },
      },
      summary: `Environment: web-browser, fs: ${caps.hasFileSystem}, terminal: ${caps.hasTerminal}`,
    };
  },
};

/**
 * Detects environment capabilities.
 * In Vibe Studio, this is always web-browser with known limits.
 */
export function detectCapabilities(
  _ctx: Readonly<HarnessContext>,
): EnvironmentCapabilities {
  // Vibe Studio runs in the browser — capabilities are fixed
  return WEB_BROWSER_CAPS;
}
