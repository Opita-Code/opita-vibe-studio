import { describe, it, expect } from "vitest";
import { decideTDD, decideDelivery } from "../orchestrator";

describe("orchestrator decisions", () => {
  // ─── TDD Decision ─────────────────────────────────────────

  describe("decideTDD", () => {
    it("should return false when no test runner is available", () => {
      expect(decideTDD("crear un componente de login", null)).toBe(false);
    });

    it("should return true for feature creation with test runner", () => {
      expect(decideTDD("crear un nuevo servicio de autenticación", "vitest")).toBe(true);
      expect(decideTDD("implementar la función de búsqueda", "vitest")).toBe(true);
      expect(decideTDD("agregar un hook para manejar formularios", "jest")).toBe(true);
    });

    it("should return true for bug fixes with test runner", () => {
      expect(decideTDD("arreglar el bug en el login", "vitest")).toBe(true);
      expect(decideTDD("corregir el error de validación", "vitest")).toBe(true);
    });

    it("should return false for styling changes even with test runner", () => {
      expect(decideTDD("cambiar los colores del sidebar", "vitest")).toBe(false);
      expect(decideTDD("actualizar el estilo del header", "vitest")).toBe(false);
      expect(decideTDD("arreglar el css del modal", "vitest")).toBe(false);
    });

    it("should return false for documentation changes", () => {
      expect(decideTDD("actualizar el readme con las instrucciones", "vitest")).toBe(false);
      expect(decideTDD("agregar documentación del API", "vitest")).toBe(false);
    });

    it("should return false for config changes", () => {
      expect(decideTDD("actualizar la configuración del linter", "vitest")).toBe(false);
      expect(decideTDD("cambiar las variables de .env", "vitest")).toBe(false);
    });

    it("should return false when user explicitly opts out", () => {
      expect(decideTDD("crear un componente sin tests", "vitest")).toBe(false);
      expect(decideTDD("agregar la función sin pruebas", "vitest")).toBe(false);
      expect(decideTDD("implementar el servicio, no test por ahora", "vitest")).toBe(false);
    });

    it("should return false for ambiguous requests (conservative)", () => {
      expect(decideTDD("quiero que se vea más profesional", "vitest")).toBe(false);
    });
  });

  // ─── Delivery Decision ────────────────────────────────────

  describe("decideDelivery", () => {
    it("should return 'direct' when no git", () => {
      expect(decideDelivery("crear un componente grande", false)).toBe("direct");
    });

    it("should return 'direct' for simple changes with git", () => {
      expect(decideDelivery("arreglar el botón de login", true)).toBe("direct");
      expect(decideDelivery("cambiar el color del header", true)).toBe("direct");
    });

    it("should return 'pr' when user explicitly requests it", () => {
      expect(decideDelivery("hacer un pull request para este cambio", true)).toBe("pr");
      expect(decideDelivery("preparar esto como pr para review", true)).toBe("pr");
    });

    it("should return 'feature-branch' for large-scope changes", () => {
      expect(decideDelivery("migrar la autenticación a JWT", true)).toBe("feature-branch");
      expect(decideDelivery("reescribir el módulo de pagos completo", true)).toBe("feature-branch");
      expect(decideDelivery("cambiar la arquitectura del frontend", true)).toBe("feature-branch");
    });

    it("should return 'feature-branch' for system-level changes", () => {
      expect(decideDelivery("crear un sistema de notificaciones", true)).toBe("feature-branch");
    });
  });
});
