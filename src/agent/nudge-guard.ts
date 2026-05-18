/**
 * nudge-guard — Lógica pura para decidir si un mensaje debe enrutarse
 * como nudge al agente activo o como un nuevo envío normal.
 *
 * Separado de useAgentHandler para ser testeable sin React.
 */

import type { IntentClass } from "./types";

export interface NudgeGuardContext {
  /** El agente está corriendo (streaming activo) */
  isStreaming: boolean;
  /** El intent de la ejecución activa, o null si no hay ninguna */
  activeIntent: IntentClass | null;
  /** Si hay una grace window activa (el agente aún no arrancó) */
  inGraceWindow?: boolean;
}

/**
 * Devuelve `true` si el mensaje debe enrutarse como nudge
 * en lugar de iniciar una nueva ejecución.
 *
 * Condiciones necesarias (todas deben cumplirse):
 * 1. El agente está corriendo (`isStreaming === true`)
 * 2. El intent activo es "code" (solo `build-agent` drena nudges)
 * 3. NO hay grace window activa (el agente ya empezó a procesar)
 */
export function shouldSendAsNudge(ctx: NudgeGuardContext): boolean {
  if (!ctx.isStreaming) return false;
  if (ctx.activeIntent !== "code") return false;
  if (ctx.inGraceWindow) return false;
  return true;
}
