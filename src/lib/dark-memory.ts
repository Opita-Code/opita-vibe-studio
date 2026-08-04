/**
 * Dark Memory Integration — Singleton bridge para el harness Aura.
 *
 * Inicializa DarkMemoryBridge, lo inyecta en los harnesses que lo
 * consumen (engram, session-summary, skill-registry, context, persist),
 * y gestiona el session lifecycle por proyecto.
 *
 * Degradación elegante: si dark-memory no está disponible (offline,
 * web sin sidecar), el bridge usa MemoryTransport y los harnesses
 * operan sin bloqueo (comportamiento previo).
 */

import { DarkMemoryBridge } from "@opita/dark-memory-bridge";
import { setEngramBridge } from "@/agent/harnesses/phases/engram-memory";
import { setSessionBridge } from "@/agent/harnesses/infrastructure/session-summary";
import { setSkillBridge } from "@/agent/harnesses/skills/skill-registry";
import { setDarkMemoryContextBridge } from "@/agent/harnesses/infrastructure/dark-memory-context";
import { setDarkMemoryPersistBridge } from "@/agent/harnesses/infrastructure/dark-memory-persist";
import { useAuthStore } from "@/stores/auth";

const OPERATOR = "aura";

let bridge: DarkMemoryBridge | null = null;
let activeProjectId: string | null = null;
let initialized = false;

/**
 * Devuelve el bridge singleton (o null si no inicializado).
 * NUNCA lanza — los callers deben tratar null como "sin dark-memory".
 */
export function getDarkMemoryBridge(): DarkMemoryBridge | null {
  return bridge;
}

/**
 * Inicializa el bridge y lo inyecta en todos los harnesses.
 * Idempotente. Usa el email del usuario como projectId scoped
 * (INV-7: cada usuario = proyecto aislado).
 *
 * @param projectId — id del proyecto activo (opcional, default "default").
 */
export async function initDarkMemory(projectId: string = "default"): Promise<DarkMemoryBridge | null> {
  const auth = useAuthStore.getState();
  const email = auth.user?.email;
  // Scoping por usuario: dark-memory aísla por project_id.
  const scopedProject = email ? `vibe:${email.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}` : projectId;

  if (!bridge) {
    bridge = new DarkMemoryBridge({
      operator: OPERATOR,
      projectId: scopedProject,
      transport: "auto",
    });
  }

  // Inyectar en todos los harnesses.
  setEngramBridge(bridge);
  setSessionBridge(bridge);
  setSkillBridge(bridge);
  setDarkMemoryContextBridge(bridge);
  setDarkMemoryPersistBridge(bridge);

  initialized = true;
  activeProjectId = scopedProject;
  return bridge;
}

/**
 * Inicia la sesión de dark-memory para el proyecto activo.
 * Si el bridge no está disponible, no-op (degradación elegante).
 */
export async function startDarkMemorySession(): Promise<void> {
  if (!bridge) return;
  try {
    await bridge.sessionStart();
  } catch (err: unknown) {
    console.warn("[dark-memory] sessionStart falló:", err);
  }
}

/**
 * Cierra la sesión de dark-memory (al cerrar proyecto/app).
 */
export async function closeDarkMemorySession(): Promise<void> {
  if (!bridge) return;
  try {
    await bridge.sessionClose();
  } catch (err: unknown) {
    console.warn("[dark-memory] sessionClose falló:", err);
  }
}

/**
 * Recupera memories relevantes para enriquecer el system prompt.
 * Devuelve markdown listo para inyectar, o "" si no hay nada.
 */
export async function buildMemoryContextBlock(
  userText: string,
  limit: number = 5,
): Promise<string> {
  if (!bridge) return "";
  try {
    const hits = await bridge.recall({
      query: userText,
      operator: bridge.operator,
      limit,
    });
    if (hits.length === 0) return "";

    const lines = hits.map(
      (h) => `- **[${h.kind}] ${h.title}** (${h.tags || "sin tags"}): ${h.content.slice(0, 200)}`,
    );

    return `## Memoria de sesiones anteriores\n\n${lines.join("\n")}\n`;
  } catch (err: unknown) {
    console.warn("[dark-memory] buildMemoryContextBlock falló:", err);
    return "";
  }
}

/** Estado de inicialización (para debug/UI). */
export function darkMemoryStatus(): {
  initialized: boolean;
  projectId: string | null;
} {
  return {
    initialized,
    projectId: activeProjectId,
  };
}

/** @internal — solo tests: resetea el singleton. */
export function _resetDarkMemoryForTests(): void {
  setEngramBridge(null);
  setSessionBridge(null);
  setSkillBridge(null);
  setDarkMemoryContextBridge(null);
  setDarkMemoryPersistBridge(null);
  bridge = null;
  activeProjectId = null;
  initialized = false;
}
