/**
 * Harness Factory — Creates a pre-configured HarnessEngine.
 *
 * Registers all harnesses in the correct order and returns
 * a ready-to-use engine. This is the ONLY place where all
 * harnesses are assembled.
 */

import { HarnessEngine } from "./index";

// ─── Orchestration ──────────────────────────────────────────────
import { sddInitHarness } from "./orchestration/sdd-init";
import { executionModeHarness } from "./orchestration/execution-mode";
import { delegationHarness } from "./orchestration/delegation";
import { artifactStoreHarness } from "./orchestration/artifact-store";
import { phaseDagHarness } from "./orchestration/phase-dag";
import { resultContractHarness } from "./orchestration/result-contract";

// ─── Phases ─────────────────────────────────────────────────────
import { artifactDependencyHarness } from "./phases/artifact-dependency";
import { engramMemoryHarness } from "./phases/engram-memory";

// ─── Quality ────────────────────────────────────────────────────
import { verifyHarness } from "./quality/verify";
import { strictTDDHarness } from "./quality/strict-tdd";
import { applyContinuityHarness } from "./quality/apply-continuity";

// ─── Skills ─────────────────────────────────────────────────────
import { skillRegistryHarness } from "./skills/skill-registry";
import { skillResolutionHarness } from "./skills/skill-resolution";

// ─── Delivery ───────────────────────────────────────────────────
import { reviewWorkloadHarness } from "./delivery/review-workload";
import { deliveryStrategyHarness } from "./delivery/delivery-strategy";
import { chainStrategyHarness } from "./delivery/chain-strategy";

// ─── Infrastructure ─────────────────────────────────────────────
import { modelRoutingHarness } from "./infrastructure/model-routing";
import { permissionSecurityHarness } from "./infrastructure/permission-security";
import { backupHarness } from "./infrastructure/backup";
import { rollbackHarness } from "./infrastructure/rollback";
import { profileIsolationHarness } from "./infrastructure/profile-isolation";
import { mcpInjectionHarness } from "./infrastructure/mcp-injection";
import { componentDependencyHarness } from "./infrastructure/component-dependency";
import { commandWrapperHarness } from "./infrastructure/command-wrapper";
import { perAgentAdapterHarness } from "./infrastructure/per-agent-adapter";
import { sessionSummaryHarness } from "./infrastructure/session-summary";

/**
 * Creates a fully configured HarnessEngine with all harnesses registered.
 *
 * Registration order doesn't matter — the engine sorts by phase + priority.
 * But we register in logical groups for readability.
 */
export function createHarnessEngine(): HarnessEngine {
  const engine = new HarnessEngine();

  engine.registerAll([
    // ─── Pre-classify: environment detection ─────────────────
    profileIsolationHarness,        // priority: 5
    sddInitHarness,                 // priority: 1
    perAgentAdapterHarness,         // priority: 3

    // ─── Post-classify: decision making ──────────────────────
    executionModeHarness,           // priority: 20
    artifactStoreHarness,           // priority: 25
    delegationHarness,              // priority: 30
    deliveryStrategyHarness,        // priority: 40

    // ─── Pre-execute: guards and setup ───────────────────────
    phaseDagHarness,                // priority: 10
    artifactDependencyHarness,      // priority: 15
    engramMemoryHarness,            // priority: 20
    skillRegistryHarness,           // priority: 30
    modelRoutingHarness,            // priority: 40
    mcpInjectionHarness,            // priority: 45
    componentDependencyHarness,     // priority: 48
    strictTDDHarness,               // priority: 50
    applyContinuityHarness,         // priority: 55
    backupHarness,                  // priority: 60

    // ─── Mid-execute: runtime guards ─────────────────────────
    permissionSecurityHarness,      // priority: 1
    commandWrapperHarness,          // priority: 10

    // ─── Post-execute: validation and cleanup ────────────────
    verifyHarness,                  // priority: 20
    skillResolutionHarness,         // priority: 50
    rollbackHarness,                // priority: 80
    resultContractHarness,          // priority: 90
    sessionSummaryHarness,          // priority: 95

    // ─── Pre-deliver: final checks ──────────────────────────
    reviewWorkloadHarness,          // priority: 10
    chainStrategyHarness,           // priority: 20
  ]);

  return engine;
}
