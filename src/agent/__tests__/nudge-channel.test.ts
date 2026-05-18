/**
 * Tests para el NudgeChannel.
 *
 * Ejecutar: npx vitest run src/agent/__tests__/nudge-channel.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  pushNudge,
  drainNudges,
  hasNudges,
  clearNudges,
} from "../nudge-channel";

describe("NudgeChannel", () => {
  beforeEach(() => {
    clearNudges();
  });

  it("push + drain entrega el nudge correcto", () => {
    pushNudge("Usa fondo oscuro");
    const drained = drainNudges();
    expect(drained).toHaveLength(1);
    expect(drained[0].content).toBe("Usa fondo oscuro");
  });

  it("drain limpia el canal (segunda llamada retorna vacío)", () => {
    pushNudge("Nudge 1");
    drainNudges();
    expect(drainNudges()).toHaveLength(0);
  });

  it("múltiples nudges se acumulan en orden", () => {
    pushNudge("Primero");
    pushNudge("Segundo");
    pushNudge("Tercero");
    const drained = drainNudges();
    expect(drained).toHaveLength(3);
    expect(drained[0].content).toBe("Primero");
    expect(drained[2].content).toBe("Tercero");
  });

  it("hasNudges devuelve true cuando hay nudges", () => {
    expect(hasNudges()).toBe(false);
    pushNudge("Algo");
    expect(hasNudges()).toBe(true);
  });

  it("clearNudges elimina todos sin retornar nada", () => {
    pushNudge("A");
    pushNudge("B");
    clearNudges();
    expect(hasNudges()).toBe(false);
    expect(drainNudges()).toHaveLength(0);
  });

  it("cada nudge tiene id único", () => {
    pushNudge("X");
    pushNudge("Y");
    const [a, b] = drainNudges();
    expect(a.id).not.toBe(b.id);
  });
});

describe("NudgeChannel — integración con el loop del agente", () => {
  beforeEach(() => {
    clearNudges();
  });

  it("simula el patrón drain en cada iteración del ReAct loop", () => {
    // Simula: iteración 1 → drain (vacío)
    const iter1 = drainNudges();
    expect(iter1).toHaveLength(0);

    // Usuario envía nudge entre iteraciones
    pushNudge("Asegúrate de usar TypeScript estricto");

    // Iteración 2 → drain (tiene el nudge)
    const iter2 = drainNudges();
    expect(iter2).toHaveLength(1);
    expect(iter2[0].content).toBe("Asegúrate de usar TypeScript estricto");

    // Iteración 3 → drain (vacío otra vez)
    const iter3 = drainNudges();
    expect(iter3).toHaveLength(0);
  });
});
