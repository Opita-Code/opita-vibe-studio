/**
 * RoadmapTracker — Roadmap inteligente impulsado por tool calls y nudges.
 *
 * Reemplaza las llamadas manuales a updateRoadmapGoal() en build-agent.ts.
 * Infiere el estado real del agente a partir de qué herramientas está usando,
 * y actualiza el roadmap dinámicamente cuando el usuario envía nudges.
 *
 * Fases:
 *   analyze  → el agente está leyendo/explorando (read_file, list_files, search_code)
 *   build    → el agente está escribiendo/modificando (write_file, apply_diff, delete_file)
 *   verify   → el agente está ejecutando comandos para validar (execute_command)
 *
 * Transiciones:
 *   analyze → build (primera herramienta de escritura)
 *   build   → verify (execute_command estando en build)
 *   NUNCA se regresa a una fase anterior
 */

import type { AgentEvent, RoadmapGoal } from "./types";

// ─── Phase Inference ───────────────────────────────────────────

const ANALYZE_TOOLS = new Set(["read_file", "list_files", "search_code", "memory_search"]);
const BUILD_TOOLS   = new Set(["write_file", "apply_diff", "delete_file"]);
const VERIFY_TOOLS  = new Set(["execute_command"]);

export type ToolPhase = "analyze" | "build" | "verify";

/**
 * Devuelve la fase que implica un tool call, o null si es neutral.
 */
export function inferPhaseFromTool(toolName: string): ToolPhase | null {
  if (ANALYZE_TOOLS.has(toolName)) return "analyze";
  if (BUILD_TOOLS.has(toolName))   return "build";
  if (VERIFY_TOOLS.has(toolName))  return "verify";
  return null;
}

// ─── Nudge Goal Inference ──────────────────────────────────────

export interface NudgeGoal {
  id: string;
  label: string;
}

const NUDGE_PATTERNS: Array<{ patterns: string[]; goal: NudgeGoal }> = [
  {
    patterns: [
      "test", "tests", "prueba", "pruebas", "spec",
      "vitest", "jest", "testing", "verificar", "verificación",
      "corrobora", "comprueba", "comprueba que funcione",
    ],
    goal: { id: "verify", label: "Revisando que todo funcione" },
  },
  {
    patterns: [
      "readme", "documentación", "documentacion", "documenta",
      "documéntalo", "documentalo", "explica", "comenta",
    ],
    goal: { id: "document", label: "Documentando los cambios" },
  },
];

/**
 * Analiza el texto de un nudge y devuelve el nuevo goal que implica,
 * o null si es un nudge genérico que no agrega goals.
 */
export function inferGoalFromNudge(text: string): NudgeGoal | null {
  const lower = text.toLowerCase();
  for (const entry of NUDGE_PATTERNS) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return entry.goal;
    }
  }
  return null;
}

// ─── RoadmapTracker ───────────────────────────────────────────

export class RoadmapTracker {
  private roadmap: RoadmapGoal[];
  private _phase: ToolPhase = "analyze";
  private buildToolCount = 0;

  constructor(roadmap: RoadmapGoal[]) {
    // Trabajamos con una copia — el caller puede leer `getRoadmap()` cuando quiera
    this.roadmap = roadmap.map((g) => ({ ...g }));
  }

  get currentPhase(): ToolPhase {
    return this._phase;
  }

  // ─── Getters ─────────────────────────────────────────────────

  getGoal(id: string): RoadmapGoal | undefined {
    return this.roadmap.find((g) => g.id === id);
  }

  getRoadmap(): RoadmapGoal[] {
    return this.roadmap;
  }

  /**
   * Progreso estimado dentro del goal "build" (0–100).
   * Se basa en cuántos archivos han sido modificados.
   */
  getBuildProgress(): number {
    // Heurística simple: cada archivo = 25%, cap a 90%
    return Math.min(this.buildToolCount * 25, 90);
  }

  // ─── Event Handlers ───────────────────────────────────────────

  /**
   * Llamar cuando el agente inicia una herramienta.
   * Retorna los AgentEvents de roadmap que deben emitirse.
   */
  onToolStart(toolName: string): AgentEvent[] {
    const impliedPhase = inferPhaseFromTool(toolName);
    if (!impliedPhase) return []; // herramienta neutral — sin transición

    const events: AgentEvent[] = [];

    // ── Transición analyze → build ──────────────────────────────
    if (impliedPhase === "build" && this._phase === "analyze") {
      this._phase = "build";

      this.setGoalStatus("analyze", "done");
      events.push({ type: "roadmap_update", goalId: "analyze", status: "done" });

      // Si existe el goal "plan", también completarlo
      if (this.getGoal("plan")) {
        this.setGoalStatus("plan", "done");
        events.push({ type: "roadmap_update", goalId: "plan", status: "done" });
      }

      this.setGoalStatus("build", "active");
      events.push({ type: "roadmap_update", goalId: "build", status: "active" });
    }

    // ── Transición build → verify ────────────────────────────────
    if (impliedPhase === "verify" && this._phase === "build") {
      this._phase = "verify";

      // Asegurar que el goal verify existe
      if (!this.getGoal("verify")) {
        this.roadmap.push({ id: "verify", label: "Revisando que todo funcione", status: "pending" });
        events.push({ type: "roadmap", goals: this.getRoadmap() });
      }

      this.setGoalStatus("verify", "active");
      events.push({ type: "roadmap_update", goalId: "verify", status: "active" });
    }

    // ── Tracking de herramientas de build ─────────────────────────
    if (BUILD_TOOLS.has(toolName)) {
      this.buildToolCount++;
    }

    return events;
  }

  /**
   * Llamar cuando una herramienta finaliza.
   * Por ahora solo se usa para tracking interno, puede emitir progreso.
   */
  onToolDone(toolName: string, _success: boolean): AgentEvent[] {
    // Emitir actualización de progreso durante build
    if (this._phase === "build" && BUILD_TOOLS.has(toolName)) {
      const progress = this.getBuildProgress();
      const buildGoal = this.getGoal("build");
      if (buildGoal) {
        buildGoal.progress = progress;
      }
      return [
        { type: "roadmap_update", goalId: "build", status: "active", progress },
      ];
    }
    return [];
  }

  /**
   * Llamar cuando llega un nudge del usuario.
   * Puede agregar nuevos goals al roadmap si el nudge los implica.
   */
  onNudge(nudgeText: string): AgentEvent[] {
    const newGoal = inferGoalFromNudge(nudgeText);
    if (!newGoal) return [];

    // No duplicar si ya existe
    if (this.getGoal(newGoal.id)) return [];

    // Agregar el nuevo goal al final del roadmap
    this.roadmap.push({
      id: newGoal.id,
      label: newGoal.label,
      status: "pending",
    });

    // Retornar el roadmap completo actualizado
    return [{ type: "roadmap", goals: this.getRoadmap() }];
  }

  /**
   * Llamar al finalizar la ejecución del agente.
   * Marca todos los goals activos como done.
   */
  complete(): AgentEvent[] {
    const events: AgentEvent[] = [];

    for (const goal of this.roadmap) {
      if (goal.status === "active" || goal.status === "pending") {
        goal.status = "done";
        events.push({ type: "roadmap_update", goalId: goal.id, status: "done" });
      }
    }

    return events;
  }

  /**
   * Llamar cuando la ejecución se aborta por un error fatal.
   * Marca los goals activos o pendientes como error.
   */
  fail(): AgentEvent[] {
    const events: AgentEvent[] = [];

    for (const goal of this.roadmap) {
      if (goal.status === "active" || goal.status === "pending") {
        goal.status = "error";
        events.push({ type: "roadmap_update", goalId: goal.id, status: "error" });
      }
    }

    return events;
  }

  // ─── Private ──────────────────────────────────────────────────

  private setGoalStatus(id: string, status: RoadmapGoal["status"]): void {
    const goal = this.getGoal(id);
    if (goal) goal.status = status;
  }
}
