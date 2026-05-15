import { describe, it, expect } from "vitest";
import {
  detectIdea,
  createIdea,
  formatBacklogSummary,
  STATUS_LABELS,
  PRIORITY_LABELS,
  _testOnly,
} from "../idea-backlog";
import type { Idea, IdeaStatus } from "../idea-backlog";

const { deriveIdeaTitle, deriveIdeaTags, extractKeywords } = _testOnly;

describe("idea-backlog", () => {
  // ─── Idea Detection ─────────────────────────────────────────

  describe("detectIdea", () => {
    describe("should detect casual ideas", () => {
      it("conditional/subjunctive patterns", () => {
        expect(detectIdea("Sería bueno tener dark mode")).toBe(true);
        expect(detectIdea("Estaría genial si tuviéramos notificaciones push")).toBe(true);
        expect(detectIdea("Sería interesante agregar búsqueda global")).toBe(true);
      });

      it("hypothetical future patterns", () => {
        expect(detectIdea("Algún día podríamos implementar drag and drop")).toBe(true);
        expect(detectIdea("En el futuro podríamos agregar un marketplace")).toBe(true);
        expect(detectIdea("Más adelante sería bueno tener templates")).toBe(true);
      });

      it("explicit idea patterns", () => {
        expect(detectIdea("Una idea sería agregar un dashboard de métricas")).toBe(true);
        expect(detectIdea("Se me ocurre que podemos usar WebSockets para real-time")).toBe(true);
        expect(detectIdea("Qué tal si agregamos un modo offline")).toBe(true);
      });

      it("wish/desire patterns", () => {
        expect(detectIdea("Imaginá que pudiéramos hacer pair programming en vivo")).toBe(true);
      });
    });

    describe("should NOT detect active requests", () => {
      it("direct commands", () => {
        expect(detectIdea("Haceme un componente de login")).toBe(false);
        expect(detectIdea("Crea un archivo nuevo en src/")).toBe(false);
        expect(detectIdea("Agrega un botón de submit")).toBe(false);
      });

      it("fix/change requests", () => {
        expect(detectIdea("Arregla el bug del sidebar")).toBe(false);
        expect(detectIdea("Cambia el color del header")).toBe(false);
      });

      it("urgent requests", () => {
        expect(detectIdea("Necesito esto ahora mismo")).toBe(false);
      });

      it("short messages", () => {
        expect(detectIdea("hola")).toBe(false);
        expect(detectIdea("ok")).toBe(false);
        expect(detectIdea("sí, dale")).toBe(false);
      });
    });
  });

  // ─── Idea Title Derivation ──────────────────────────────────

  describe("deriveIdeaTitle", () => {
    it("should strip conditional intro phrases", () => {
      expect(deriveIdeaTitle("Sería bueno tener dark mode")).toBe("Dark mode");
      expect(deriveIdeaTitle("Estaría genial agregar notificaciones")).toBe("Notificaciones");
    });

    it("should strip hypothetical phrases", () => {
      expect(deriveIdeaTitle("Algún día drag and drop")).toBe("Drag and drop");
    });

    it("should strip 'qué tal si' pattern", () => {
      expect(deriveIdeaTitle("Qué tal si agregamos un modo offline")).toBe("Agregamos un modo offline");
    });

    it("should capitalize first letter", () => {
      const title = deriveIdeaTitle("Sería bueno tener algo genial");
      expect(title.charAt(0)).toBe(title.charAt(0).toUpperCase());
    });

    it("should truncate long titles at word boundary", () => {
      const longIdea = "Sería bueno tener un sistema completo de gestión de proyectos con kanban boards, sprints, estimaciones, burndown charts y reportes automáticos";
      const title = deriveIdeaTitle(longIdea);
      expect(title.length).toBeLessThanOrEqual(60);
    });
  });

  // ─── Idea Tags ──────────────────────────────────────────────

  describe("deriveIdeaTags", () => {
    it("should detect UI-related tags", () => {
      const tags = deriveIdeaTags("Agregar un botón de cerrar en el modal");
      expect(tags).toContain("ui");
    });

    it("should detect auth tags", () => {
      const tags = deriveIdeaTags("Implementar login con OAuth");
      expect(tags).toContain("auth");
    });

    it("should detect multiple tags", () => {
      const tags = deriveIdeaTags("Agregar un botón de login con seguridad de token");
      expect(tags).toContain("ui");
      expect(tags).toContain("auth");
      expect(tags).toContain("seguridad");
    });

    it("should detect backend tags", () => {
      const tags = deriveIdeaTags("Crear un endpoint API para la base de datos");
      expect(tags).toContain("backend");
    });

    it("should return empty for generic text", () => {
      const tags = deriveIdeaTags("Hacer algo interesante");
      expect(tags).toEqual([]);
    });
  });

  // ─── Idea Creation ─────────────────────────────────────────

  describe("createIdea", () => {
    it("should create a well-structured idea", () => {
      const idea = createIdea("Sería bueno tener dark mode");

      expect(idea.id).toMatch(/^idea-/);
      expect(idea.title).toBe("Dark mode");
      expect(idea.originalText).toBe("Sería bueno tener dark mode");
      expect(idea.status).toBe("idea");
      expect(idea.priority).toBe("sin_definir");
      expect(idea.createdAt).toBeGreaterThan(0);
    });

    it("should auto-tag the idea", () => {
      const idea = createIdea("Sería genial agregar un botón responsive");
      expect(idea.tags).toContain("ui");
    });

    it("should preserve session ID", () => {
      const idea = createIdea("Una idea para después", "session-123");
      expect(idea.sessionId).toBe("session-123");
    });
  });

  // ─── Keyword Extraction ────────────────────────────────────

  describe("extractKeywords", () => {
    it("should remove stop words", () => {
      const keywords = extractKeywords("el usuario puede hacer login con su cuenta");
      expect(keywords).not.toContain("el");
      expect(keywords).not.toContain("con");
      expect(keywords).toContain("usuario");
      expect(keywords).toContain("login");
      expect(keywords).toContain("cuenta");
    });

    it("should normalize accents", () => {
      const keywords = extractKeywords("autenticación con función");
      expect(keywords).toContain("autenticacion");
      expect(keywords).toContain("funcion");
    });

    it("should skip short words", () => {
      const keywords = extractKeywords("un ojo de la cara");
      expect(keywords).not.toContain("un");
      expect(keywords).not.toContain("de");
      expect(keywords).toContain("ojo");
      expect(keywords).toContain("cara");
    });
  });

  // ─── Backlog Formatting ────────────────────────────────────

  describe("formatBacklogSummary", () => {
    it("should show empty message for no ideas", () => {
      const summary = formatBacklogSummary([]);
      expect(summary).toContain("No tienes ideas guardadas");
    });

    it("should group ideas by status", () => {
      const ideas: Idea[] = [
        createIdea("Idea 1"),
        { ...createIdea("Idea 2"), status: "implementada" as IdeaStatus },
      ];

      const summary = formatBacklogSummary(ideas);
      expect(summary).toContain("💡 Idea");
      expect(summary).toContain("✅ Implementada");
      expect(summary).toContain("Backlog de Ideas (2)");
    });

    it("should show priority and tags inline", () => {
      const idea = createIdea("Sería genial agregar un botón responsive");
      idea.priority = "alta";

      const summary = formatBacklogSummary([idea]);
      expect(summary).toContain("🔴 Alta");
      expect(summary).toContain("`ui`");
    });
  });

  // ─── Status Labels ─────────────────────────────────────────

  describe("status labels", () => {
    it("should have all statuses defined", () => {
      const statuses: IdeaStatus[] = [
        "idea", "evaluada", "planificada", "en_progreso",
        "implementada", "descartada",
      ];
      for (const s of statuses) {
        expect(STATUS_LABELS[s]).toBeDefined();
      }
    });

    it("should have all priorities defined", () => {
      expect(PRIORITY_LABELS.alta).toContain("Alta");
      expect(PRIORITY_LABELS.media).toContain("Media");
      expect(PRIORITY_LABELS.baja).toContain("Baja");
      expect(PRIORITY_LABELS.sin_definir).toContain("Sin definir");
    });
  });
});
