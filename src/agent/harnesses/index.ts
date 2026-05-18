/**
 * HarnessEngine — Compositor de harnesses.
 *
 * Ejecuta harnesses en orden de fase y prioridad.
 * Si un harness bloquea, la ejecución se detiene y el contexto
 * refleja el bloqueo para que el UI pueda reaccionar.
 *
 * Diseño: cada harness recibe el contexto COMPLETO y devuelve
 * un HarnessResult con updates parciales. Los updates se mergean
 * de forma inmutable (spread) entre cada harness.
 */

import type {
  Harness,
  HarnessContext,
  HarnessPhase,
  HarnessTraceEntry,
} from "./types";

// ─── Phase execution order ──────────────────────────────────────

const PHASE_ORDER: HarnessPhase[] = [
  "pre-classify",
  "post-classify",
  "pre-execute",
  "mid-execute",
  "post-execute",
  "pre-deliver",
];

// ─── Engine ─────────────────────────────────────────────────────

export class HarnessEngine {
  private harnesses: Harness[] = [];

  /** Register a harness. Can be chained. */
  register(harness: Harness): this {
    this.harnesses.push(harness);
    return this;
  }

  /** Register multiple harnesses at once. */
  registerAll(harnesses: Harness[]): this {
    for (const h of harnesses) {
      this.harnesses.push(h);
    }
    return this;
  }

  /**
   * Run all harnesses for a specific phase.
   * Mutates nothing — returns a new context.
   */
  async runPhase(
    phase: HarnessPhase,
    ctx: HarnessContext,
  ): Promise<HarnessContext> {
    const phaseHarnesses = this.harnesses
      .filter((h) => h.phase === phase)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    let current = { ...ctx };

    for (const harness of phaseHarnesses) {
      const start = performance.now();
      const activated = harness.shouldActivate(current);

      const trace: HarnessTraceEntry = {
        harnessId: harness.id,
        phase,
        activated,
        durationMs: 0,
        result: "skip",
      };

      if (!activated) {
        trace.durationMs = performance.now() - start;
        current = {
          ...current,
          harnessTrace: [...current.harnessTrace, trace],
        };
        continue;
      }

      const result = await harness.execute(current);
      trace.durationMs = performance.now() - start;

      if (result.block) {
        trace.result = "block";
        current = {
          ...current,
          ...result.contextUpdates,
          blocked: true,
          blockReason: result.blockReason ?? `Blocked by ${harness.id}`,
          harnessTrace: [...current.harnessTrace, trace],
        };
        // Stop processing — return blocked context
        return current;
      }

      trace.result = "pass";
      current = {
        ...current,
        ...result.contextUpdates,
        harnessTrace: [...current.harnessTrace, trace],
      };
    }

    return current;
  }

  /**
   * Run all phases in order.
   * Stops early if any harness blocks.
   */
  async runAll(ctx: HarnessContext): Promise<HarnessContext> {
    let current = ctx;

    for (const phase of PHASE_ORDER) {
      current = await this.runPhase(phase, current);
      if (current.blocked) break;
    }

    return current;
  }

  /**
   * Run a subset of phases (for mid-execution hooks).
   */
  async runPhases(
    phases: HarnessPhase[],
    ctx: HarnessContext,
  ): Promise<HarnessContext> {
    let current = ctx;

    for (const phase of phases) {
      current = await this.runPhase(phase, current);
      if (current.blocked) break;
    }

    return current;
  }

  /** Get registered harness count */
  get count(): number {
    return this.harnesses.length;
  }

  /** List registered harness IDs by phase */
  inspect(): Record<HarnessPhase, string[]> {
    const result: Record<string, string[]> = {};

    for (const phase of PHASE_ORDER) {
      result[phase] = this.harnesses
        .filter((h) => h.phase === phase)
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
        .map((h) => h.id);
    }

    return result as Record<HarnessPhase, string[]>;
  }
}

// ─── Re-exports ─────────────────────────────────────────────────

export { createDefaultContext } from "./types";
export type {
  Harness,
  HarnessContext,
  HarnessResult,
  HarnessPhase,
  HarnessTraceEntry,
  ProjectSnapshot,
  SDDPhase,
  PhaseEnvelope,
  ExecutionMode,
  DeliveryStrategy,
  ChainStrategy,
  ArtifactStoreMode,
  ArtifactRef,
  ArtifactMap,
  SkillEntry,
  SkillResolution,
  ModelSelection,
  PermissionCheck,
} from "./types";
