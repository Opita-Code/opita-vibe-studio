/**
 * Harness Engine — Core Types
 *
 * Tipos compartidos para todo el sistema de harnesses.
 * Cada harness implementa la interfaz `Harness` y opera sobre un
 * `HarnessContext` inmutable, devolviendo un `HarnessResult`.
 *
 * Diseño: pipeline de middleware — cada harness puede:
 * 1. Enriquecer el contexto (agregar datos)
 * 2. Bloquear la ejecución (devolver block: true)
 * 3. Modificar la decisión de routing
 */

// ─── Lifecycle Phase ────────────────────────────────────────────

/**
 * En qué momento del pipeline se ejecuta un harness.
 *
 * - `pre-classify`: Antes de clasificar el intent (ej: security checks)
 * - `post-classify`: Después del intent, antes de routing (ej: delegation)
 * - `pre-execute`: Justo antes de ejecutar el agente (ej: skill injection)
 * - `mid-execute`: Durante el ReAct loop (ej: TDD enforcement)
 * - `post-execute`: Después del agente, antes de entregar (ej: verify)
 * - `pre-deliver`: Última etapa antes de devolver al UI (ej: workload guard)
 */
export type HarnessPhase =
  | "pre-classify"
  | "post-classify"
  | "pre-execute"
  | "mid-execute"
  | "post-execute"
  | "pre-deliver";

// ─── SDD Phases ─────────────────────────────────────────────────

/** The ordered phases of the SDD workflow */
export const SDD_PHASES = [
  "explore",
  "propose",
  "spec",
  "design",
  "tasks",
  "apply",
  "verify",
  "archive",
] as const;

export type SDDPhase = (typeof SDD_PHASES)[number];

/** Phase DAG — defines which phases require which predecessors */
export const PHASE_DEPENDENCIES: Record<SDDPhase, SDDPhase[]> = {
  explore: [],
  propose: [],                     // Can start from scratch or from explore
  spec: ["propose"],               // Needs a proposal
  design: ["propose"],             // Needs a proposal (parallel with spec)
  tasks: ["spec", "design"],       // Needs both spec and design
  apply: ["tasks"],                // Needs task breakdown
  verify: ["apply"],               // Needs implementation
  archive: ["verify"],             // Needs verification pass
};

// ─── Project Context ────────────────────────────────────────────

export interface ProjectSnapshot {
  /** Detected tech stack (e.g., ["react", "typescript", "vite"]) */
  stack: string[];
  /** Detected test runner command (e.g., "vitest", "jest", null) */
  testRunner: string | null;
  /** Whether git is initialized */
  hasGit: boolean;
  /** Detected package manager */
  packageManager: "npm" | "pnpm" | "bun" | "yarn" | null;
  /** Root-level file names for convention detection */
  rootFiles: string[];
  /** Project conventions detected */
  conventions: string[];
  /** Whether a project workspace is open */
  isOpen: boolean;
}

// ─── Execution Mode ─────────────────────────────────────────────

export type ExecutionMode = "auto" | "interactive";

// ─── Delivery ───────────────────────────────────────────────────

export type DeliveryStrategy =
  | "direct"            // Apply directly to working tree
  | "feature-branch"    // Create a feature branch
  | "pr"                // PR-ready branch
  | "stacked-pr"        // Chained PRs for large changes
  | "size-exception";   // Oversized but accepted

export type ChainStrategy =
  | "none"
  | "stacked-to-main"
  | "feature-branch-chain";

// ─── Artifact System ────────────────────────────────────────────

export type ArtifactStoreMode = "engram" | "openspec" | "hybrid" | "none";

export interface ArtifactRef {
  type: SDDPhase | "apply-progress" | "verify-report" | "state";
  /** Topic key for Engram retrieval */
  topicKey: string;
  /** File path for OpenSpec retrieval */
  filePath?: string;
  /** Engram observation ID (if known) */
  observationId?: number;
}

/** Map of artifact type → reference */
export type ArtifactMap = Partial<Record<ArtifactRef["type"], ArtifactRef>>;

// ─── Skill System ───────────────────────────────────────────────

export interface SkillEntry {
  id: string;
  name: string;
  triggers: string[];
  /** Compact rules (pre-digested, 5-15 lines) */
  compactRules: string;
}

export type SkillResolution = "injected" | "fallback-registry" | "fallback-path" | "none";

// ─── Model Routing ──────────────────────────────────────────────

export interface ModelSelection {
  providerId: string;
  modelId: string;
  byok: boolean;
  blocked?: boolean;
  blockReason?: string;
}

// ─── Security ───────────────────────────────────────────────────

/** Commands that require explicit user confirmation */
export interface PermissionCheck {
  command: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
  reason?: string;
}

// ─── HarnessContext ─────────────────────────────────────────────

/**
 * The immutable context that flows through the harness pipeline.
 * Each harness reads from it and returns updates via HarnessResult.
 */
export interface HarnessContext {
  // ─── Input (set at start, never changes) ───────────────────
  /** Original user message */
  userText: string;
  /** User plan tier */
  plan: "free" | "estudiante" | "pro";
  /** Custom API key (BYOK) */
  customApiKey?: string;
  /** Explicit model from client */
  requestedModelId?: string;
  /** Custom instructions from settings */
  customInstructions?: string;
  /** Abort signal */
  signal?: AbortSignal;

  // ─── Detected (set by harnesses) ───────────────────────────
  /** Project snapshot (from sdd-init harness) */
  project: ProjectSnapshot;
  /** Classified intent */
  intent?: "chat" | "code" | "explore";
  /** Current SDD phase (if in SDD flow) */
  currentPhase?: SDDPhase;
  /** Completed SDD phases */
  completedPhases: SDDPhase[];

  // ─── Decisions (set by harnesses) ──────────────────────────
  /** How to execute: auto or interactive */
  executionMode: ExecutionMode;
  /** Whether to use TDD */
  useTDD: boolean;
  /** Delivery strategy */
  deliveryStrategy: DeliveryStrategy;
  /** Chain strategy for PRs */
  chainStrategy: ChainStrategy;
  /** Where to store artifacts */
  artifactStore: ArtifactStoreMode;
  /** Available artifacts */
  artifacts: ArtifactMap;
  /** Model selection */
  model: ModelSelection;
  /** Whether this task should be delegated to a subagent */
  shouldDelegate: boolean;
  /** Delegation reason */
  delegationReason?: string;

  // ─── Skills ────────────────────────────────────────────────
  /** Resolved skills for this execution */
  resolvedSkills: SkillEntry[];
  /** How skills were resolved */
  skillResolution: SkillResolution;

  // ─── Security ──────────────────────────────────────────────
  /** Pending permission checks */
  permissionChecks: PermissionCheck[];
  /** Whether execution is blocked */
  blocked: boolean;
  /** Block reason */
  blockReason?: string;

  // ─── Metadata ──────────────────────────────────────────────
  /** Trace of which harnesses executed */
  harnessTrace: HarnessTraceEntry[];
}

export interface HarnessTraceEntry {
  harnessId: string;
  phase: HarnessPhase;
  activated: boolean;
  durationMs: number;
  result: "pass" | "block" | "skip";
}

// ─── HarnessResult ──────────────────────────────────────────────

/**
 * What a harness returns after execution.
 * `contextUpdates` is a partial HarnessContext that gets merged.
 */
export interface HarnessResult {
  /** Whether the harness blocks further execution */
  block: boolean;
  /** Reason for blocking (required if block is true) */
  blockReason?: string;
  /** Partial context updates to merge */
  contextUpdates: Partial<HarnessContext>;
  /** Human-readable summary of what the harness did */
  summary?: string;
}

// ─── Harness Interface ──────────────────────────────────────────

/**
 * A harness is a composable middleware that enriches or guards
 * the agent pipeline.
 *
 * Harnesses are:
 * - Pure: no side effects (except logging)
 * - Composable: multiple harnesses chain together
 * - Ordered: execute by `phase`, then by registration order
 */
export interface Harness {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** When in the pipeline this harness runs */
  phase: HarnessPhase;
  /** Priority within phase (lower = earlier). Default: 100 */
  priority?: number;
  /** Whether this harness should activate for the given context */
  shouldActivate(ctx: Readonly<HarnessContext>): boolean;
  /** Execute the harness logic */
  execute(ctx: Readonly<HarnessContext>): HarnessResult | Promise<HarnessResult>;
}

// ─── Result Contract (envelope between phases) ──────────────────

/**
 * Standardized envelope for communication between SDD phases.
 * Every phase must return this shape.
 */
export interface PhaseEnvelope {
  /** Phase that produced this envelope */
  phase: SDDPhase;
  /** Outcome */
  status: "success" | "partial" | "blocked";
  /** 1-3 sentence summary */
  executiveSummary: string;
  /** Artifact keys/paths written */
  artifacts: string[];
  /** Next recommended phase */
  nextRecommended: SDDPhase | "none";
  /** Risks discovered */
  risks: string[];
  /** How skills were loaded */
  skillResolution: SkillResolution;
}

// ─── Factory Defaults ───────────────────────────────────────────

/** Creates a default HarnessContext with sensible defaults */
export function createDefaultContext(
  userText: string,
  plan: "free" | "estudiante" | "pro",
): HarnessContext {
  return {
    userText,
    plan,
    project: {
      stack: [],
      testRunner: null,
      hasGit: false,
      packageManager: null,
      rootFiles: [],
      conventions: [],
      isOpen: false,
    },
    completedPhases: [],
    executionMode: "interactive",
    useTDD: false,
    deliveryStrategy: "direct",
    chainStrategy: "none",
    artifactStore: "none",
    artifacts: {},
    model: { providerId: "gemini", modelId: "gemini-2.5-flash", byok: false },
    shouldDelegate: false,
    resolvedSkills: [],
    skillResolution: "none",
    permissionChecks: [],
    blocked: false,
    harnessTrace: [],
  };
}
