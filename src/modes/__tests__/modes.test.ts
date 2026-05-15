/**
 * Test unitario para el sistema de modos de IA simplificado.
 * Ejecutar: npx vitest run src/modes/__tests__/modes.test.ts
 */
import { describe, it, expect } from "vitest";
import { VIBE_MODES, detectMode, stripCommand, getSelectableModes, getToolsForMode, getModeById } from "../index";

describe("AI Modes", () => {
  it("debe tener 5 modos definidos (chat + 4 seleccionables)", () => {
    expect(VIBE_MODES).toHaveLength(5);
  });

  it("cada modo tiene id, name, icon, description", () => {
    for (const mode of VIBE_MODES) {
      expect(mode.id).toBeTruthy();
      expect(mode.name).toBeTruthy();
      expect(mode.icon).toBeTruthy();
      expect(mode.description).toBeTruthy();
    }
  });

  it("getSelectableModes retorna 4 modos (excluye chat)", () => {
    const selectable = getSelectableModes();
    expect(selectable).toHaveLength(4);
    expect(selectable.find((m) => m.id === "chat")).toBeUndefined();
    expect(selectable.map((m) => m.id)).toEqual(["auto", "construir", "planear", "vibe"]);
  });

  it("getModeById encuentra modos correctamente", () => {
    expect(getModeById("auto")?.name).toBe("Auto");
    expect(getModeById("construir")?.name).toBe("Construir");
    expect(getModeById("planear")?.name).toBe("Planear");
    expect(getModeById("vibe")?.name).toBe("Modo Vibe");
    expect(getModeById("chat")?.name).toBe("Chat");
    expect(getModeById("nonexistent" as any)).toBeUndefined();
  });
});

describe("Mode Detection", () => {
  const cases: [string, string][] = [
    // Comandos manuales
    ["/construir un nuevo componente", "construir"],
    ["/planear la nueva feature", "planear"],
    ["/vibe ciclo completo", "vibe"],

    // Detección por keywords → construir (absorbe corregir, optimizar, testear)
    ["Crear un componente Button", "construir"],
    ["Hacer una página de login", "construir"],
    ["Agregar un nuevo endpoint", "construir"],
    ["No funciona el login, hay un bug", "construir"],
    ["Se rompe cuando hago click", "construir"],
    ["Hay un error en el formulario", "construir"],
    ["Optimiza este código", "construir"],
    ["Mejorar el rendimiento de la query", "construir"],
    ["Genera tests para esto", "construir"],
    ["Escribir pruebas unitarias", "construir"],

    // Detección por keywords → planear (absorbe explorar, planificar)
    ["Explícame cómo funciona el auth", "planear"],
    ["Cómo funciona este componente?", "planear"],
    ["Qué hace esta función?", "planear"],
    ["Cuál es la mejor arquitectura?", "planear"],

    // Detección por keywords → vibe
    ["Quiero usar el ciclo completo de creación guiada", "vibe"],
    ["Activar modo vibe para esto", "vibe"],

    // Default en modo auto → construir (no chat)
    ["Dame un resumen", "construir"],

    // Intención conversacional fuerza chat (aunque tenga keywords de otros modos)
    ["Muéstrame cómo crear un componente en React", "chat"],
    ["Escríbeme un componente de login en el chat", "chat"],
    ["Dame un ejemplo de una página con Next.js", "chat"],
    ["Cómo se ve un hook personalizado?", "chat"],
    ["Enséñame cómo se hace un formulario", "chat"],
    ["Cómo sería un componente de tabla?", "chat"],
    ["Qué es un componente en React?", "chat"],
    ["Para qué sirve useEffect?", "chat"],
    ["Mostrarme cómo funciona", "chat"],
    ["Puedes mostrarme un ejemplo?", "chat"],
  ];

  it.each(cases)('"%s" → modo "%s"', (input, expected) => {
    const detected = detectMode(input);
    expect(detected.id).toBe(expected);
  });

  it("comandos manuales tienen prioridad sobre keywords", () => {
    const result = detectMode("/planear cómo crear un componente");
    expect(result.id).toBe("planear");
  });

  it("comandos manuales tienen prioridad sobre intención conversacional", () => {
    const result = detectMode("/construir muéstrame un componente");
    expect(result.id).toBe("construir");
  });

  it("intención conversacional tiene prioridad sobre keywords de modo", () => {
    expect(detectMode("Muéstrame cómo crear un componente").id).toBe("chat");
    expect(detectMode("Dame un ejemplo de cómo generar una página").id).toBe("chat");
    expect(detectMode("Escríbeme un formulario en el chat").id).toBe("chat");
  });

  it("vibe triggers tienen prioridad sobre construir/planear", () => {
    expect(detectMode("Activar el ciclo completo de creación guiada").id).toBe("vibe");
    expect(detectMode("Usar modo vibe para esto").id).toBe("vibe");
  });
});

describe("stripCommand", () => {
  it("elimina el comando del texto", () => {
    expect(stripCommand("/planear cómo funciona")).toBe("cómo funciona");
    expect(stripCommand("/construir un botón")).toBe("un botón");
    expect(stripCommand("/vibe esta tarea")).toBe("esta tarea");
  });

  it("retorna texto original si no hay comando", () => {
    expect(stripCommand("Hola mundo")).toBe("Hola mundo");
  });
});

describe("getToolsForMode", () => {
  it("chat solo tiene herramientas de memoria", () => {
    const chatMode = VIBE_MODES.find((m) => m.id === "chat")!;
    const tools = getToolsForMode(chatMode);
    const names = tools.map((t) => t.name);
    expect(names).toContain("memory_save");
    expect(names).toContain("memory_search");
    expect(names).not.toContain("write_file");
    expect(names).not.toContain("read_file");
    expect(tools.length).toBe(2);
  });

  it("planear solo tiene herramientas de lectura", () => {
    const planMode = VIBE_MODES.find((m) => m.id === "planear")!;
    const tools = getToolsForMode(planMode);
    const names = tools.map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("list_files");
    expect(names).toContain("search_code");
    expect(names).not.toContain("write_file");
    expect(names).not.toContain("apply_diff");
    expect(names).not.toContain("delete_file");
  });

  it("construir tiene todas las herramientas", () => {
    const construirMode = VIBE_MODES.find((m) => m.id === "construir")!;
    const tools = getToolsForMode(construirMode);
    expect(tools.length).toBeGreaterThanOrEqual(6);
  });

  it("vibe tiene todas las herramientas", () => {
    const vibeMode = VIBE_MODES.find((m) => m.id === "vibe")!;
    const tools = getToolsForMode(vibeMode);
    expect(tools.length).toBeGreaterThanOrEqual(6);
  });
});
