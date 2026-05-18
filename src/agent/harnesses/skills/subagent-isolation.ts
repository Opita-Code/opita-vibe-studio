/**
 * Subagent Isolation Harness — Clean context per sub-agent.
 *
 * Ensures each sub-agent works in an isolated environment,
 * receiving ONLY the context necessary for its specific task.
 * Prevents context pollution between different sub-agents.
 *
 * What gets isolated:
 * - Skills (only relevant ones)
 * - Artifacts (only dependencies for the current phase)
 * - Conversation history (trimmed to relevant messages)
 * - System prompt (composed per sub-agent)
 */

import type { HarnessContext, SDDPhase } from "../types";
import { digestSkills } from "./skill-digestion";
import { generatePersistenceInstructions } from "../phases/engram-memory";

/**
 * A clean, isolated context for a sub-agent.
 * Contains everything the sub-agent needs and nothing more.
 */
export interface SubagentContext {
  /** System prompt (composed specifically for this sub-agent) */
  systemPrompt: string;
  /** Skills block (pre-digested, ready for injection) */
  projectStandards: string;
  /** Persistence instructions */
  persistenceInstructions: string;
  /** Which artifacts to retrieve (topic keys) */
  artifactsToRetrieve: string[];
  /** Model selection */
  model: { providerId: string; modelId: string };
  /** Phase being executed */
  phase: SDDPhase;
}

/**
 * Creates an isolated context for a sub-agent.
 * Filters skills, artifacts, and instructions to only what's needed.
 */
export function createSubagentContext(
  ctx: Readonly<HarnessContext>,
  phase: SDDPhase,
  changeName: string,
  taskDescription: string,
): SubagentContext {
  // Digest skills to compact form
  const projectStandards = digestSkills(ctx.resolvedSkills, taskDescription);

  // Persistence instructions for the artifact store mode
  const persistenceInstructions = generatePersistenceInstructions(
    changeName,
    phase,
    ctx.artifactStore,
  );

  // Determine which artifacts to retrieve
  const artifactsToRetrieve = getArtifactsForPhase(phase, changeName);

  return {
    systemPrompt: "", // Composed by the caller (build-agent or orchestrator)
    projectStandards,
    persistenceInstructions,
    artifactsToRetrieve,
    model: {
      providerId: ctx.model.providerId,
      modelId: ctx.model.modelId,
    },
    phase,
  };
}

/**
 * Returns the artifact topic keys a phase needs to retrieve.
 */
function getArtifactsForPhase(phase: SDDPhase, changeName: string): string[] {
  const base = `sdd/${changeName}`;

  const phaseArtifacts: Record<SDDPhase, string[]> = {
    explore: [],
    propose: [],
    spec: [`${base}/proposal`],
    design: [`${base}/proposal`],
    tasks: [`${base}/spec`, `${base}/design`],
    apply: [`${base}/tasks`, `${base}/spec`, `${base}/design`, `${base}/apply-progress`],
    verify: [`${base}/spec`, `${base}/tasks`, `${base}/apply-progress`],
    archive: [
      `${base}/proposal`, `${base}/spec`, `${base}/design`,
      `${base}/tasks`, `${base}/apply-progress`, `${base}/verify-report`,
    ],
  };

  return phaseArtifacts[phase] ?? [];
}

/**
 * Trims conversation history to reduce context size for sub-agents.
 * Keeps only the most recent and relevant messages.
 */
export function trimConversationForSubagent(
  messages: Array<{ role: string; content: string }>,
  maxMessages: number = 10,
): Array<{ role: string; content: string }> {
  if (messages.length <= maxMessages) return messages;

  // Keep first message (usually system/context) and last N-1 messages
  const first = messages[0];
  const recent = messages.slice(-(maxMessages - 1));

  return [first, ...recent];
}
