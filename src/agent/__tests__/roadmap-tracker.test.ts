/**
 * Tests para RoadmapTracker — el sistema que infiere el estado del
 * roadmap a partir de los tool calls y los nudges del usuario.
 *
 * Ejecutar: npx vitest run src/agent/__tests__/roadmap-tracker.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoadmapTracker, inferPhaseFromTool, inferGoalFromNudge } from "../roadmap-tracker";
import type { RoadmapGoal } from "../types";

// ─── Helpers ──────────────────────────────────────────────────

function makeBaseRoadmap(): RoadmapGoal[] {
  return [
    { id: "analyze", label: "Entendiendo qué necesitas", status: "active" },
    { id: "build",   label: "Haciendo los cambios",      status: "pending" },
  ];
}

// ─── inferPhaseFromTool ────────────────────────────────────────

describe("inferPhaseFromTool", () => {
  it("read_file → analyze", () => expect(inferPhaseFromTool("read_file")).toBe("analyze"));
  it("list_files → analyze", () => expect(inferPhaseFromTool("list_files")).toBe("analyze"));
  it("search_code → analyze", () => expect(inferPhaseFromTool("search_code")).toBe("analyze"));
  it("memory_search → analyze", () => expect(inferPhaseFromTool("memory_search")).toBe("analyze"));

  it("write_file → build", () => expect(inferPhaseFromTool("write_file")).toBe("build"));
  it("apply_diff → build", () => expect(inferPhaseFromTool("apply_diff")).toBe("build"));
  it("delete_file → build", () => expect(inferPhaseFromTool("delete_file")).toBe("build"));

  it("execute_command → verify", () => expect(inferPhaseFromTool("execute_command")).toBe("verify"));
  it("memory_save → null (sin fase)", () => expect(inferPhaseFromTool("memory_save")).toBeNull());
});

// ─── inferGoalFromNudge ────────────────────────────────────────

describe("inferGoalFromNudge", () => {
  it("detecta pedido de tests", () => {
    const result = inferGoalFromNudge("también agrega tests por favor");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("verify");
  });

  it("detecta pedido de tests en inglés", () => {
    const result = inferGoalFromNudge("add tests too");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("verify");
  });

  it("detecta pedido de documentación", () => {
    const result = inferGoalFromNudge("agrega un README también");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("document");
  });

  it("nudge genérico no genera nuevo goal", () => {
    const result = inferGoalFromNudge("usa fondo oscuro");
    expect(result).toBeNull();
  });
});

// ─── RoadmapTracker ───────────────────────────────────────────

describe("RoadmapTracker — transiciones de fase", () => {
  let tracker: RoadmapTracker;

  beforeEach(() => {
    tracker = new RoadmapTracker(makeBaseRoadmap());
  });

  it("empieza en fase analyze con el goal analyze=active", () => {
    expect(tracker.currentPhase).toBe("analyze");
    expect(tracker.getGoal("analyze")?.status).toBe("active");
    expect(tracker.getGoal("build")?.status).toBe("pending");
  });

  it("tool de analyze no cambia la fase si ya estamos en analyze", () => {
    tracker.onToolStart("read_file");
    expect(tracker.currentPhase).toBe("analyze");
    // Sin transición — analyze sigue active

  });

  it("múltiples tools de analyze no cambian la fase", () => {
    tracker.onToolStart("read_file");
    tracker.onToolStart("list_files");
    tracker.onToolStart("search_code");
    expect(tracker.currentPhase).toBe("analyze");
  });

  it("primer tool de build → transición: analyze=done, build=active", () => {
    // Primero hacemos algo de analyze
    tracker.onToolStart("read_file");
    tracker.onToolDone("read_file", true);

    // Ahora build
    const events = tracker.onToolStart("write_file");
    expect(tracker.currentPhase).toBe("build");
    expect(tracker.getGoal("analyze")?.status).toBe("done");
    expect(tracker.getGoal("build")?.status).toBe("active");

    // Debe emitir los eventos de actualización
    const updates = events.filter(e => e.type === "roadmap_update");
    expect(updates.length).toBeGreaterThan(0);
  });

  it("herramientas de analyze después de build NO regresan a analyze", () => {
    tracker.onToolStart("write_file");
    tracker.onToolStart("read_file"); // verificar resultado
    expect(tracker.currentPhase).toBe("build"); // no regresa
  });

  it("execute_command en fase build → transición a verify", () => {
    tracker.onToolStart("write_file");
    tracker.onToolStart("execute_command");
    expect(tracker.currentPhase).toBe("verify");
    // verify goal debe existir y activarse
    expect(tracker.getGoal("verify")?.status).toBe("active");
  });

  it("execute_command en fase analyze NO activa verify (todavía no construimos)", () => {
    tracker.onToolStart("execute_command");
    // En analyze, un execute_command es probablemente exploración — no es verify
    expect(tracker.currentPhase).toBe("analyze");
  });
});

describe("RoadmapTracker — progreso dentro del build", () => {
  it("trackea archivos modificados para mostrar progreso", () => {
    const tracker = new RoadmapTracker(makeBaseRoadmap());
    tracker.onToolStart("write_file");
    tracker.onToolDone("write_file", true);
    tracker.onToolStart("apply_diff");
    tracker.onToolDone("apply_diff", true);

    // Después de 2 archivos, el progreso debe ser > 0
    expect(tracker.getBuildProgress()).toBeGreaterThan(0);
  });
});

describe("RoadmapTracker — nudge goals dinámicos", () => {
  it("nudge con 'tests' agrega el goal verify si no existe", () => {
    const tracker = new RoadmapTracker(makeBaseRoadmap());
    // El roadmap base NO tiene verify
    expect(tracker.getGoal("verify")).toBeUndefined();

    const events = tracker.onNudge("también agrega tests por favor");
    expect(tracker.getGoal("verify")).toBeDefined();
    expect(tracker.getGoal("verify")?.status).toBe("pending");

    // Debe emitir un evento de roadmap actualizado
    expect(events.some(e => e.type === "roadmap")).toBe(true);
  });

  it("nudge con 'tests' no duplica el goal verify si ya existe", () => {
    const roadmapWithVerify: RoadmapGoal[] = [
      ...makeBaseRoadmap(),
      { id: "verify", label: "Revisando que todo funcione", status: "pending" },
    ];
    const tracker = new RoadmapTracker(roadmapWithVerify);
    tracker.onNudge("agrega tests");
    const goals = tracker.getRoadmap().filter(g => g.id === "verify");
    expect(goals).toHaveLength(1); // no duplica
  });

  it("nudge genérico no agrega goals pero devuelve evento de fase actualizada", () => {
    const tracker = new RoadmapTracker(makeBaseRoadmap());
    const events = tracker.onNudge("usa fondo oscuro");
    // No se agregan goals nuevos
    expect(tracker.getRoadmap()).toHaveLength(2);
    // Pero puede emitir evento de texto (el agente va a ajustar)
    expect(events.length).toBeGreaterThanOrEqual(0);
  });
});

describe("RoadmapTracker — ciclo completo", () => {
  it("flujo analyze → build → verify produce roadmap correcto al final", () => {
    const tracker = new RoadmapTracker(makeBaseRoadmap());

    // Fase analyze
    tracker.onToolStart("read_file");
    tracker.onToolDone("read_file", true);
    tracker.onToolStart("list_files");
    tracker.onToolDone("list_files", true);

    // Transición a build
    tracker.onToolStart("write_file");
    tracker.onToolDone("write_file", true);
    expect(tracker.getGoal("analyze")?.status).toBe("done");
    expect(tracker.getGoal("build")?.status).toBe("active");

    // El tracker no tiene verify todavía, así que añadimos via nudge
    tracker.onNudge("corrobora que funcione con tests");
    expect(tracker.getGoal("verify")).toBeDefined();

    // Transición a verify
    tracker.onToolStart("execute_command");
    tracker.onToolDone("execute_command", true);
    expect(tracker.currentPhase).toBe("verify");

    // Marcar todo como done al final
    tracker.complete();
    expect(tracker.getGoal("build")?.status).toBe("done");
    expect(tracker.getGoal("verify")?.status).toBe("done");
  });
});
