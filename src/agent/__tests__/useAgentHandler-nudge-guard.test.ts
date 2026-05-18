/**
 * Tests para el guard de nudge por intent.
 *
 * El nudge intercept solo debe activarse cuando el agente activo
 * es un build-agent (intent === "code"). En chat/explore, los mensajes
 * durante streaming deben comportarse normalmente (sin nudge).
 *
 * Ejecutar: npx vitest run src/agent/__tests__/useAgentHandler-nudge-guard.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  pushNudge,
  drainNudges,
  clearNudges,
  hasNudges,
} from "../nudge-channel";
import { shouldSendAsNudge } from "../nudge-guard";

describe("shouldSendAsNudge", () => {
  it("devuelve true solo si isStreaming=true e intent=code", () => {
    expect(shouldSendAsNudge({ isStreaming: true, activeIntent: "code" })).toBe(true);
  });

  it("devuelve false si intent=chat aunque isStreaming=true", () => {
    expect(shouldSendAsNudge({ isStreaming: true, activeIntent: "chat" })).toBe(false);
  });

  it("devuelve false si intent=explore aunque isStreaming=true", () => {
    expect(shouldSendAsNudge({ isStreaming: true, activeIntent: "explore" })).toBe(false);
  });

  it("devuelve false si NOT isStreaming aunque intent=code", () => {
    expect(shouldSendAsNudge({ isStreaming: false, activeIntent: "code" })).toBe(false);
  });

  it("devuelve false si activeIntent=null (no hay ejecución activa)", () => {
    expect(shouldSendAsNudge({ isStreaming: true, activeIntent: null })).toBe(false);
  });

  it("devuelve false si hay graceWindow activa (agente no ha arrancado todavía)", () => {
    expect(
      shouldSendAsNudge({ isStreaming: false, activeIntent: "code", inGraceWindow: true })
    ).toBe(false);
  });
});

describe("NudgeChannel no se contamina con mensajes de chat", () => {
  beforeEach(() => {
    clearNudges();
  });

  it("mensaje durante chat (shouldSendAsNudge=false) NO llega al canal", () => {
    // El caller verifica shouldSendAsNudge antes de pushNudge
    const wouldNudge = shouldSendAsNudge({ isStreaming: true, activeIntent: "chat" });
    if (wouldNudge) pushNudge("esto no debería pasar");

    expect(hasNudges()).toBe(false);
    expect(drainNudges()).toHaveLength(0);
  });

  it("mensaje durante code (shouldSendAsNudge=true) SÍ llega al canal", () => {
    const wouldNudge = shouldSendAsNudge({ isStreaming: true, activeIntent: "code" });
    if (wouldNudge) pushNudge("usa TypeScript estricto");

    expect(hasNudges()).toBe(true);
    expect(drainNudges()).toHaveLength(1);
  });
});
