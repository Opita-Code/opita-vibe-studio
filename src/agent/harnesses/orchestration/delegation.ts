/**
 * Delegation Harness — Inline vs Subagent decision.
 *
 * Determines whether a task should be handled inline (simple,
 * mechanical) or delegated to a specialized subagent (complex,
 * multi-file, requires deeper analysis).
 *
 * Decision matrix:
 * ┌─────────────────────┬──────────┬──────────────────┐
 * │ Task Type           │ Inline   │ Delegate         │
 * ├─────────────────────┼──────────┼──────────────────┤
 * │ Read 1-3 files      │ ✓        │                  │
 * │ Read 4+ files       │          │ ✓ (explore)      │
 * │ Atomic write        │ ✓        │                  │
 * │ Multi-file write    │          │ ✓ (apply)        │
 * │ State check (git)   │ ✓        │                  │
 * │ Test/build          │          │ ✓ (verify)       │
 * │ Chat/question       │ ✓        │                  │
 * │ Complex feature     │          │ ✓ (full SDD)     │
 * └─────────────────────┴──────────┴──────────────────┘
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";
import { canAccess } from "@/lib/plan-registry";

/** Patterns that indicate a complex, multi-step task → delegate */
const DELEGATION_PATTERNS = [
  // Multi-file/system level
  "sistema completo", "múltiples archivos", "multiples archivos",
  "crear proyecto", "módulo completo", "modulo completo",
  "aplicación", "aplicacion", "app completa",
  // Architecture
  "arquitectura", "refactorizar", "migrar", "migración", "migracion",
  "rediseñar", "redisenar", "reescribir",
  // Full features
  "implementar feature", "nueva funcionalidad", "sistema de",
  "motor de", "pipeline de", "flujo completo",
  // SDD explicit
  "sdd", "spec-driven", "openspec",
];

/** Patterns that indicate simple, inline work */
const INLINE_PATTERNS = [
  // Styling
  "cambiar color", "estilo", "css", "centrar", "alinear",
  // Quick edits
  "renombrar", "mover", "borrar", "eliminar archivo",
  "corregir typo", "fix typo", "comentario",
  // Config
  "env", "configuración simple", "configuracion simple",
  // Questions
  "qué es", "que es", "cómo funciona", "como funciona",
  "explica", "dime", "muéstrame", "muestrame",
];

export const delegationHarness: Harness = {
  id: "delegation",
  name: "Delegation Decider",
  phase: "post-classify",
  priority: 30,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Only for code and explore intents — chat is always inline
    return ctx.intent === "code" || ctx.intent === "explore";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const { shouldDelegate, reason } = decideDelegation(
      ctx.userText,
      ctx.plan,
      ctx.project.isOpen,
    );

    return {
      block: false,
      contextUpdates: {
        shouldDelegate,
        delegationReason: reason,
      },
      summary: shouldDelegate
        ? `Delegate to subagent: ${reason}`
        : `Handle inline: ${reason}`,
    };
  },
};

/**
 * Decides whether to delegate or handle inline.
 * Pure function — easy to test.
 */
export function decideDelegation(
  userText: string,
  plan: "free" | "estudiante" | "pro",
  hasProjectOpen: boolean,
): { shouldDelegate: boolean; reason: string } {
  const lower = userText.toLowerCase();

  // No project open → always inline (just chat)
  if (!hasProjectOpen) {
    return { shouldDelegate: false, reason: "No project open — chat only" };
  }

  // Free plan cannot use subagents
  if (!canAccess(plan, "sub_agents") && !canAccess(plan, "sdd")) {
    return { shouldDelegate: false, reason: "Plan does not support delegation" };
  }

  // Check for inline patterns (higher priority — don't over-delegate)
  const inlineScore = INLINE_PATTERNS.filter((p) => lower.includes(p)).length;
  if (inlineScore >= 1) {
    return { shouldDelegate: false, reason: `Simple task (${inlineScore} inline indicators)` };
  }

  // Check for delegation patterns
  const delegateScore = DELEGATION_PATTERNS.filter((p) => lower.includes(p)).length;
  if (delegateScore >= 1) {
    return { shouldDelegate: true, reason: `Complex task (${delegateScore} delegation indicators)` };
  }

  // Message length heuristic — very long descriptions suggest complex tasks
  if (lower.length > 200) {
    return { shouldDelegate: true, reason: "Long description suggests complex task" };
  }

  // Default: delegate for paid plans (better results)
  return {
    shouldDelegate: canAccess(plan, "sub_agents"),
    reason: canAccess(plan, "sub_agents") ? "Pro plan default — delegate for best results" : "Student plan — inline by default",
  };
}
