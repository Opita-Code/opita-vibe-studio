/**
 * Skill Digestion Harness — Compact rules for sub-agents.
 *
 * Takes extensive skill rules and compacts them into specific,
 * actionable instructions for sub-agents. Reduces context noise
 * and keeps prompts focused.
 *
 * The digestion process:
 * 1. Take the resolved skills (from skill-registry)
 * 2. Filter to only relevant rules for the task
 * 3. Compact into a single block (~50-150 tokens per skill)
 * 4. Inject into sub-agent prompt as "Project Standards"
 */

import type { SkillEntry } from "../types";

/**
 * Digests a list of skills into a compact prompt block.
 *
 * Token budget: ~50-150 tokens per skill
 * Max skills: 5 (to keep context manageable)
 *
 * @param skills - Resolved skills from the registry
 * @param taskDescription - Brief description of the task for filtering
 * @returns Compact rules string ready for prompt injection
 */
export function digestSkills(
  skills: SkillEntry[],
  taskDescription: string,
): string {
  if (skills.length === 0) return "";

  const lower = taskDescription.toLowerCase();

  // Filter to most relevant skills for this specific task
  const relevant = skills.filter((skill) => {
    return skill.triggers.some((t) => lower.includes(t.toLowerCase()));
  });

  // If no specific match, use all resolved skills (they matched at registry level)
  const toDigest = relevant.length > 0 ? relevant : skills;

  // Cap at 5
  const capped = toDigest.slice(0, 5);

  // Build digested output
  const blocks = capped.map((skill) => {
    // Trim each rule to essential info
    const rules = skill.compactRules
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, 5) // Max 5 rules per skill
      .join("\n");

    return `### ${skill.name}\n${rules}`;
  });

  return [
    "## Project Standards (auto-resolved)",
    "",
    ...blocks,
  ].join("\n");
}

/**
 * Estimates the token count for a digested skills block.
 * Rough estimate: ~4 chars per token for English/Spanish.
 */
export function estimateTokens(digestedBlock: string): number {
  return Math.ceil(digestedBlock.length / 4);
}

/**
 * Validates that the digested output stays within token budget.
 */
export function validateDigestionBudget(
  digestedBlock: string,
  maxTokens: number = 800,
): { valid: boolean; tokens: number; maxTokens: number } {
  const tokens = estimateTokens(digestedBlock);
  return {
    valid: tokens <= maxTokens,
    tokens,
    maxTokens,
  };
}
