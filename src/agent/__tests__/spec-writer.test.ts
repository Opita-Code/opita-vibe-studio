import { describe, it, expect } from "vitest";
import {
  specToMarkdown,
  markdownToSpec,
  createDraftSpec,
  _testOnly,
} from "../spec-writer";
import type { Spec } from "../spec-writer";

const { generateSpecId, deriveTitle, formatStatus } = _testOnly;

describe("spec-writer", () => {
  // ─── deriveTitle ────────────────────────────────────────────

  describe("deriveTitle", () => {
    it("should strip common Spanish verbs and articles", () => {
      expect(deriveTitle("Haceme un componente de login")).toBe("Componente de login");
      expect(deriveTitle("Crear una página de configuración")).toBe("Página de configuración");
      expect(deriveTitle("Agrega el botón de cerrar sesión")).toBe("Botón de cerrar sesión");
    });

    it("should capitalize first letter", () => {
      expect(deriveTitle("quiero un dashboard bonito")).toBe("Dashboard bonito");
    });

    it("should truncate long titles at word boundary", () => {
      const longInstruction = "Implementar un sistema completo de autenticación con OAuth 2.0 incluyendo Google y GitHub";
      const title = deriveTitle(longInstruction);
      expect(title.length).toBeLessThanOrEqual(50);
    });

    it("should handle instructions without matching verbs", () => {
      expect(deriveTitle("El sidebar debe colapsar")).toBe("El sidebar debe colapsar");
    });
  });

  // ─── generateSpecId ────────────────────────────────────────

  describe("generateSpecId", () => {
    it("should create slug-based ID", () => {
      const id = generateSpecId("Login con Google");
      expect(id).toMatch(/^login-con-google-[a-z0-9]+-[a-z0-9]+$/);
    });

    it("should remove accents and special chars", () => {
      const id = generateSpecId("Página de configuración");
      expect(id).toMatch(/^pagina-de-configuracion-[a-z0-9]+-[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const id1 = generateSpecId("Test");
      const id2 = generateSpecId("Test");
      expect(id1).not.toBe(id2);
    });
  });

  // ─── formatStatus ──────────────────────────────────────────

  describe("formatStatus", () => {
    it("should return Spanish-friendly status labels", () => {
      expect(formatStatus("borrador")).toContain("Borrador");
      expect(formatStatus("aprobada")).toContain("Aprobada");
      expect(formatStatus("en_progreso")).toContain("En progreso");
      expect(formatStatus("completada")).toContain("Completada");
    });
  });

  // ─── createDraftSpec ───────────────────────────────────────

  describe("createDraftSpec", () => {
    it("should create a draft spec from instruction", () => {
      const spec = createDraftSpec("Haceme un formulario de contacto");

      expect(spec.title).toBe("Formulario de contacto");
      expect(spec.userInstruction).toBe("Haceme un formulario de contacto");
      expect(spec.objective).toBe("Haceme un formulario de contacto");
      expect(spec.status).toBe("borrador");
      expect(spec.scope).toEqual([]);
      expect(spec.openQuestions).toEqual([]);
      expect(spec.id).toBeTruthy();
      expect(spec.createdAt).toBeGreaterThan(0);
    });
  });

  // ─── specToMarkdown ────────────────────────────────────────

  describe("specToMarkdown", () => {
    const baseSpec: Spec = {
      id: "login-google-test",
      title: "Login con Google",
      userInstruction: "Haceme un login con Google",
      objective: "Crear un componente de login que permita iniciar sesión con Google OAuth 2.0.",
      scope: [
        "Botón de iniciar con Google",
        "Flujo OAuth 2.0",
        "Manejo de errores",
      ],
      targetFiles: ["src/components/Login.tsx", "src/lib/auth.ts"],
      openQuestions: ["¿Se debe soportar también GitHub?"],
      options: [],
      decisions: ["Usar Firebase Auth para el flujo OAuth"],
      status: "borrador",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };

    it("should include title as h1", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("# Login con Google");
    });

    it("should include user instruction in blockquote", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain('**Instrucción original:** "Haceme un login con Google"');
    });

    it("should include objective section", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("## Objetivo");
      expect(md).toContain("login que permita iniciar sesión");
    });

    it("should include scope as bullet list", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("## Alcance");
      expect(md).toContain("- Botón de iniciar con Google");
      expect(md).toContain("- Flujo OAuth 2.0");
    });

    it("should include target files with backticks", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("## Archivos");
      expect(md).toContain("- `src/components/Login.tsx`");
    });

    it("should include open questions as checkboxes", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("## Preguntas por resolver");
      expect(md).toContain("- [ ] ¿Se debe soportar también GitHub?");
    });

    it("should include decisions with checkmark", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("## Decisiones tomadas");
      expect(md).toContain("- ✅ Usar Firebase Auth");
    });

    it("should include status emoji", () => {
      const md = specToMarkdown(baseSpec);
      expect(md).toContain("📝 Borrador");
    });
  });

  // ─── markdownToSpec (round-trip) ───────────────────────────

  describe("markdownToSpec", () => {
    it("should recover title from markdown", () => {
      const md = "# Login con Google\n\n> **Instrucción original:** \"Haceme login\"\n\n## Objetivo\n\nCrear login.\n";
      const spec = markdownToSpec(md, "test-id");
      expect(spec.title).toBe("Login con Google");
      expect(spec.userInstruction).toBe("Haceme login");
      expect(spec.objective).toBe("Crear login.");
    });

    it("should recover scope items", () => {
      const md = "# Test\n\n## Alcance\n\n- Item 1\n- Item 2\n\n## Otro\n";
      const spec = markdownToSpec(md, "test-id");
      expect(spec.scope).toEqual(["Item 1", "Item 2"]);
    });

    it("should recover target files without backticks", () => {
      const md = "# Test\n\n## Archivos\n\n- `src/App.tsx`\n- `src/lib/auth.ts`\n";
      const spec = markdownToSpec(md, "test-id");
      expect(spec.targetFiles).toEqual(["src/App.tsx", "src/lib/auth.ts"]);
    });
  });
});
