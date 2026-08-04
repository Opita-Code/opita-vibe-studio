/**
 * ThinkParser — unit tests.
 *
 * Cubre el flujo real de MiniMax-M3: bloques <think> que llegan en
 * múltiples chunks SSE. Verifica: acumulación de reasoning, colapso
 * de tags, edge cases (doble cierre, falso positivo, truncamiento).
 */

import { describe, it, expect } from "vitest";
import { ThinkParser, processThinkContent, MAX_THINK_BUFFER } from "../think-parser";

describe("ThinkParser", () => {
  it("acumula <think> en múltiples chunks y emite reasoning + text", () => {
    const parser = new ThinkParser();

    // Simula el stream real de MiniMax (chunks separados).
    const out: Array<{ type: "text" | "reasoning"; content: string }> = [];
    out.push(...processThinkContent(parser, "<think>\nThe user just said \"di EXITO\""));
    out.push(...processThinkContent(parser, " in Spanish). This seems like a very brief"));
    out.push(...processThinkContent(parser, "\n</think>\n\n¡Hola! Soy Aura, tu asistente."));

    const reasoning = out.filter((e) => e.type === "reasoning").map((e) => e.content).join("");
    const text = out.filter((e) => e.type === "text").map((e) => e.content).join("");

    // El reasoning debe incluir TODO el contenido del bloque.
    expect(reasoning).toContain("The user just said");
    expect(reasoning).toContain("This seems like a very brief");
    // El texto final debe estar limpio — SIN tags <think> ni </think>.
    // (los \n\n previos al texto son parte del output real del modelo).
    expect(text).toContain("¡Hola! Soy Aura, tu asistente.");
    expect(text).not.toContain("<think>");
    expect(text).not.toContain("</think>");
    // Ya no estamos dentro de think.
    expect(parser.isThinking).toBe(false);
  });

  it("colapsa </think> doble (basura de MiniMax)", () => {
    const parser = new ThinkParser();
    const out = processThinkContent(parser, "<think>pensando</think></think> respuesta");

    const text = out.filter((e) => e.type === "text").map((e) => e.content).join("");
    const reasoning = out.filter((e) => e.type === "reasoning").map((e) => e.content).join("");

    expect(reasoning).toBe("pensando");
    expect(text).toBe(" respuesta");
    expect(text).not.toContain("</think>");
  });

  it("maneja <think> y </think> en el MISMO chunk", () => {
    const parser = new ThinkParser();
    const out = processThinkContent(parser, "antes <think>razón</think> después");

    const text = out.filter((e) => e.type === "text").map((e) => e.content).join("");
    const reasoning = out.filter((e) => e.type === "reasoning").map((e) => e.content).join("");

    // beforeOpen="antes " + afterClose=" después" — el parser conserva
    // el whitespace literal del modelo (correcto, no reescribe texto).
    expect(text).toBe("antes  después");
    expect(reasoning).toBe("razón");
  });

  it("no activa inThink con '<think' falso positivo (sin >)", () => {
    const parser = new ThinkParser();
    const out = processThinkContent(parser, "comparar <think es una palabra");

    const text = out.filter((e) => e.type === "text").map((e) => e.content).join("");
    expect(text).toBe("comparar <think es una palabra");
    expect(parser.isThinking).toBe(false);
  });

  it("trunca reasoning >50KB y fuerza cierre", () => {
    const parser = new ThinkParser();
    const big = "x".repeat(MAX_THINK_BUFFER + 10_000);

    const out1 = processThinkContent(parser, `<think>${big}`);
    expect(out1.some((e) => e.type === "reasoning")).toBe(false); // aún abierto

    const out2 = processThinkContent(parser, "</think> final");
    const reasoning = out2.filter((e) => e.type === "reasoning").map((e) => e.content).join("");
    const text = out2.filter((e) => e.type === "text").map((e) => e.content).join("");

    expect(reasoning.length).toBeLessThanOrEqual(MAX_THINK_BUFFER + 50);
    expect(reasoning).toContain("razonamiento truncado");
    expect(text).toBe(" final");
    expect(parser.isThinking).toBe(false);
  });

  it("sin tags: todo pasa como text sin mutar", () => {
    const parser = new ThinkParser();
    const out = processThinkContent(parser, "respuesta normal del modelo");

    expect(out).toEqual([{ type: "text", content: "respuesta normal del modelo" }]);
  });

  it("reset() limpia el estado entre streams", () => {
    const parser = new ThinkParser();
    processThinkContent(parser, "<think>a medias");
    expect(parser.isThinking).toBe(true);

    parser.reset();
    expect(parser.isThinking).toBe(false);

    const out = processThinkContent(parser, "nuevo stream sin think");
    expect(out).toEqual([{ type: "text", content: "nuevo stream sin think" }]);
  });
});
