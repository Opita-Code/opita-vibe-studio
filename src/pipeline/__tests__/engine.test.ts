/**
 * Test unitario para el pipeline engine.
 * Ejecutar: npx vitest run src/pipeline/__tests__/engine.test.ts
 */
import { describe, it, expect } from "vitest";
import { detectCodeRequest } from "../engine";

describe("detectCodeRequest", () => {
  // ─── Should activate pipeline ────────────────────────────────

  const activateCases: [string, string][] = [
    ["Crear un componente de login", "action(crear) + object(componente)"],
    ["Hacer una página de contacto", "action(hacer) + object(página)"],
    ["Construir un formulario de registro", "action(construir) + object(formulario)"],
    ["Modificar el header del sitio", "action(modificar) + object(header)"],
    ["Agregar un botón de envío", "action(agregar) + object(botón)"],
    ["Diseñar un modal de confirmación", "action(diseñar) + object(modal)"],
    ["Implementar la navegación del sidebar", "action(implementar) + object(sidebar)"],
    ["Generar un componente para la tabla", "action(generar) + object(componente+tabla)"],
    ["Cambiar el estilo del footer", "action(cambiar) + object(estilo+footer)"],
    ["Desarrollar la landing page", "action(desarrollar) + object(landing)"],
  ];

  it.each(activateCases)(
    '"%s" DEBE activar pipeline (%s)',
    (input, _reason) => {
      expect(detectCodeRequest(input, true)).toBe(true);
    },
  );

  // ─── Should NOT activate pipeline ────────────────────────────

  const noActivateCases: [string, string][] = [
    // Preguntas puras
    ["¿Qué es una función en JavaScript?", "pregunta sobre conceptos"],
    ["Cómo funciona el event loop?", "pregunta explicativa"],
    ["Explica qué hace este hook", "pregunta con 'explica'"],
    ["¿Por qué falla este código?", "pregunta con 'por qué'"],
    ["¿Cuál es la diferencia entre let y const?", "pregunta comparativa"],
    ["¿Dónde se define la variable?", "pregunta con 'dónde'"],

    // Sin proyecto abierto (handled by hasProjectOpen=false in the test below)

    // Solo acción sin objeto
    ["Crear algo genial", "acción sin objeto de código reconocido"],
    ["Hacer algo rápido", "acción genérica sin objeto"],

    // Solo objeto sin acción
    ["El componente tiene un bug", "objeto sin acción de creación"],
    ["La página está lenta", "objeto sin acción"],

    // Mensajes muy cortos
    ["Hola", "demasiado corto"],
    ["ok gracias", "demasiado corto"],
    ["sí", "demasiado corto"],

    // Conversacional
    ["Gracias por la ayuda, estuvo genial", "conversacional"],
    ["Me gustó cómo quedó el diseño", "feedback sin acción"],
  ];

  it.each(noActivateCases)(
    '"%s" NO debe activar pipeline (%s)',
    (input, _reason) => {
      expect(detectCodeRequest(input, true)).toBe(false);
    },
  );

  it("retorna false si no hay proyecto abierto", () => {
    expect(detectCodeRequest("Crear un componente de login", false)).toBe(false);
  });

  it("es case-insensitive", () => {
    expect(detectCodeRequest("CREAR UN COMPONENTE GRANDE", true)).toBe(true);
    expect(detectCodeRequest("Crear un Componente de Login", true)).toBe(true);
  });

  // ─── Conversational intent bypasses pipeline ─────────────────

  const conversationalCases: [string, string][] = [
    ["Escríbeme un componente de login en el chat", "dice 'en el chat'"],
    ["Muéstrame cómo crear una página bonita", "dice 'muéstrame'"],
    ["Dame un ejemplo de un componente React", "dice 'ejemplo de'"],
    ["Cómo se ve un formulario en React?", "dice 'cómo se ve'"],
    ["Enséñame cómo hacer un modal", "dice 'enséñame'"],
    ["Escríbeme un header con navegación", "dice 'escríbeme'"],
    ["Cómo sería un componente de sidebar?", "dice 'cómo sería'"],
    ["Cómo se hace una página de landing?", "dice 'cómo se hace'"],
  ];

  it.each(conversationalCases)(
    '"%s" NO activa pipeline (intención conversacional: %s)',
    (input) => {
      expect(detectCodeRequest(input, true)).toBe(false);
    },
  );
});
