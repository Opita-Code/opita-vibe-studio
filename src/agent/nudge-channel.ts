/**
 * NudgeChannel — Canal de comunicación entre el UI y el agente en ejecución.
 *
 * El UI escribe nudges (mensajes de orientación del usuario).
 * El build-agent los lee entre iteraciones del ReAct loop.
 *
 * Diseño: singleton de módulo (no Zustand) para evitar re-renders
 * innecesarios. El agente lo accede directamente, no a través del store.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface Nudge {
  id: string;
  content: string;
  timestamp: number;
}

// ─── Channel ───────────────────────────────────────────────────

let pendingNudges: Nudge[] = [];
let nudgeIdCounter = 0;

/**
 * Agrega un nudge al canal. Llamado desde useAgentHandler cuando
 * el usuario envía un mensaje mientras el agente está en ejecución.
 */
export function pushNudge(content: string): Nudge {
  nudgeIdCounter += 1;
  const nudge: Nudge = {
    id: `nudge-${Date.now()}-${nudgeIdCounter}`,
    content,
    timestamp: Date.now(),
  };
  pendingNudges.push(nudge);
  return nudge;
}

/**
 * Consume y devuelve todos los nudges pendientes.
 * Llamado por el build-agent entre iteraciones.
 * Limpia el canal después de consumir.
 */
export function drainNudges(): Nudge[] {
  const drained = [...pendingNudges];
  pendingNudges = [];
  return drained;
}

/**
 * Verifica si hay nudges pendientes sin consumirlos.
 */
export function hasNudges(): boolean {
  return pendingNudges.length > 0;
}

/**
 * Limpia todos los nudges (llamar al final de una ejecución).
 */
export function clearNudges(): void {
  pendingNudges = [];
}
