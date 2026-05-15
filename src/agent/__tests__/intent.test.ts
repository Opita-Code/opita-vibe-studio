import { describe, it, expect } from "vitest";
import { classifyIntent, _testOnly } from "../intent";

describe("classifyIntent", () => {
  // ─── Chat Intent ────────────────────────────────────────────

  describe("chat intent", () => {
    it("should classify very short messages as chat", () => {
      expect(classifyIntent("hola", false)).toBe("chat");
      expect(classifyIntent("gracias", true)).toBe("chat");
    });

    it("should classify conversational signals as chat", () => {
      expect(classifyIntent("muéstrame cómo se usa useEffect", true)).toBe("chat");
      expect(classifyIntent("dame un ejemplo de un componente", true)).toBe("chat");
      expect(classifyIntent("escríbeme un hook personalizado aquí en el chat", true)).toBe("chat");
    });

    it("should classify concept questions without project as chat", () => {
      expect(classifyIntent("qué es un hook en React y para qué sirve", false)).toBe("chat");
      expect(classifyIntent("cómo funciona useEffect en React", false)).toBe("chat");
    });

    it("should classify all messages without project as chat (except explore)", () => {
      expect(classifyIntent("crear un componente nuevo de login", false)).toBe("chat");
    });
  });

  // ─── Explore Intent ─────────────────────────────────────────

  describe("explore intent", () => {
    it("should classify analysis requests with project as explore", () => {
      expect(classifyIntent("explícame cómo funciona la autenticación", true)).toBe("explore");
      expect(classifyIntent("analiza la estructura del proyecto actual", true)).toBe("explore");
    });

    it("should classify planning requests as explore", () => {
      expect(classifyIntent("propuesta para mejorar la arquitectura del frontend", true)).toBe("explore");
      expect(classifyIntent("compara las opciones de diseño para el dashboard", true)).toBe("explore");
    });

    it("should classify analysis requests with project as explore", () => {
      expect(classifyIntent("analiza la estructura del proyecto actual", true)).toBe("explore");
      expect(classifyIntent("revisar cómo está organizado el código del backend", true)).toBe("explore");
    });
  });

  // ─── Code Intent ────────────────────────────────────────────

  describe("code intent", () => {
    it("should classify creation requests as code", () => {
      expect(classifyIntent("crear un componente de login con email y contraseña", true)).toBe("code");
      expect(classifyIntent("hacer una nueva página de configuración", true)).toBe("code");
    });

    it("should classify bug fix requests as code", () => {
      expect(classifyIntent("arreglar el botón de login que crashea al hacer click", true)).toBe("code");
      expect(classifyIntent("hay un bug en el formulario que se rompe al enviar", true)).toBe("code");
    });

    it("should classify optimization requests as code", () => {
      expect(classifyIntent("optimizar el rendimiento de la lista de productos", true)).toBe("code");
      expect(classifyIntent("refactorizar el componente para que sea más eficiente", true)).toBe("code");
    });

    it("should classify test requests as code", () => {
      expect(classifyIntent("agregar tests unitarios para el servicio de autenticación", true)).toBe("code");
      expect(classifyIntent("crear pruebas e2e para el flujo de checkout", true)).toBe("code");
    });

    it("should default to code when project is open and no other signals match", () => {
      expect(classifyIntent("necesito que el sidebar se colapse correctamente", true)).toBe("code");
    });
  });

  // ─── Priority ───────────────────────────────────────────────

  describe("priority", () => {
    it("should prioritize chat over code when conversational signals present", () => {
      // "muéstrame" is a chat signal, even though "crear" is a code signal
      expect(classifyIntent("muéstrame cómo crear un componente", true)).toBe("chat");
    });

    it("should prioritize chat over explore for educational queries", () => {
      expect(classifyIntent("enséñame cómo funciona la arquitectura", true)).toBe("chat");
    });
  });

  // ─── Keyword Coverage ──────────────────────────────────────

  describe("keyword coverage", () => {
    it("should have chat signals defined", () => {
      expect(_testOnly.CHAT_SIGNALS.length).toBeGreaterThan(10);
    });

    it("should have code signals defined", () => {
      expect(_testOnly.CODE_SIGNALS.length).toBeGreaterThan(10);
    });

    it("should have explore signals defined", () => {
      expect(_testOnly.EXPLORE_SIGNALS.length).toBeGreaterThan(5);
    });
  });
});
