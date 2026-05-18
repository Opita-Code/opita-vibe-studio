/**
 * Artifact Grammar Harness — Shared document structure.
 *
 * Defines a predictable, consistent grammar for all SDD artifacts.
 * Improves AI predictability and human readability.
 *
 * Each artifact type has a defined structure with required and
 * optional sections. The harness validates that produced artifacts
 * conform to the grammar.
 */

import type { SDDPhase } from "../types";

/** Required sections for each artifact type */
export const ARTIFACT_GRAMMAR: Record<SDDPhase, ArtifactSection[]> = {
  explore: [
    { name: "Context", required: true, description: "Background and current state" },
    { name: "Findings", required: true, description: "What was discovered" },
    { name: "Options", required: false, description: "Possible approaches" },
    { name: "Recommendation", required: false, description: "Suggested direction" },
  ],
  propose: [
    { name: "Intent", required: true, description: "What and why" },
    { name: "Scope", required: true, description: "What's in/out" },
    { name: "Approach", required: true, description: "How to do it" },
    { name: "Risks", required: false, description: "Known risks" },
    { name: "Rollback", required: true, description: "How to undo" },
  ],
  spec: [
    { name: "Requirements", required: true, description: "Functional requirements" },
    { name: "Scenarios", required: true, description: "Given/When/Then test cases" },
    { name: "Constraints", required: false, description: "Non-functional constraints" },
    { name: "Acceptance Criteria", required: true, description: "How to know it's done" },
  ],
  design: [
    { name: "Architecture", required: true, description: "Structural decisions" },
    { name: "Components", required: true, description: "What to build" },
    { name: "Interfaces", required: false, description: "API/type contracts" },
    { name: "Dependencies", required: false, description: "External dependencies" },
    { name: "Decisions", required: true, description: "Technical tradeoffs" },
  ],
  tasks: [
    { name: "Phases", required: true, description: "Ordered implementation phases" },
    { name: "Tasks", required: true, description: "Checked items within phases" },
    { name: "Review Workload Forecast", required: true, description: "Line count estimate" },
  ],
  apply: [
    { name: "Completed Tasks", required: true, description: "What was done" },
    { name: "Files Changed", required: true, description: "File-level diff summary" },
    { name: "Deviations", required: false, description: "Differences from design" },
    { name: "Issues Found", required: false, description: "Problems discovered" },
    { name: "Remaining Tasks", required: false, description: "What's left" },
  ],
  verify: [
    { name: "Completeness", required: true, description: "Task completion check" },
    { name: "Test Results", required: true, description: "Test execution evidence" },
    { name: "Spec Compliance", required: true, description: "Behavioral compliance matrix" },
    { name: "Design Coherence", required: false, description: "Architecture alignment" },
    { name: "Verdict", required: true, description: "PASS/FAIL with rationale" },
  ],
  archive: [
    { name: "Summary", required: true, description: "What was accomplished" },
    { name: "Delta Specs", required: false, description: "Spec changes to sync" },
    { name: "Lessons Learned", required: false, description: "What to remember" },
  ],
};

export interface ArtifactSection {
  name: string;
  required: boolean;
  description: string;
}

/**
 * Validates that an artifact string contains all required sections.
 * Returns missing section names (empty = valid).
 */
export function validateArtifactGrammar(
  phase: SDDPhase,
  content: string,
): string[] {
  const grammar = ARTIFACT_GRAMMAR[phase];
  if (!grammar) return [];

  const requiredSections = grammar.filter((s) => s.required);
  const missing: string[] = [];

  for (const section of requiredSections) {
    // Check for markdown headers (## or ###) containing the section name
    const pattern = new RegExp(`#+\\s*${section.name}`, "i");
    if (!pattern.test(content)) {
      missing.push(section.name);
    }
  }

  return missing;
}

/**
 * Generates a template for an artifact based on its grammar.
 */
export function generateArtifactTemplate(phase: SDDPhase): string {
  const grammar = ARTIFACT_GRAMMAR[phase];
  if (!grammar) return "";

  return grammar
    .map((section) => {
      const required = section.required ? " (required)" : " (optional)";
      return `## ${section.name}\n\n<!-- ${section.description}${required} -->\n`;
    })
    .join("\n");
}
