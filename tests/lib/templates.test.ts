import { describe, it, expect } from "vitest";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "../../src/lib/templates";

describe("PROJECT_TEMPLATES", () => {
  it("should expose the expected number of templates", () => {
    expect(PROJECT_TEMPLATES.length).toBe(3);
  });

  it("should have unique template ids", () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should expose every registered template", () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("react-landing");
    expect(ids).toContain("portfolio");
    expect(ids).toContain("todo-app");
  });
});

describe("ProjectTemplate shape", () => {
  const VALID_CATEGORIES = ["web", "mobile", "landing", "fullstack"];

  it.each(PROJECT_TEMPLATES.map((t) => [t.id, t]))(
    "%s should satisfy the ProjectTemplate contract",
    (_id, template: ProjectTemplate) => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(VALID_CATEGORIES).toContain(template.category);
      expect(template.icon).toBeTruthy();
      expect(template.gradient).toHaveLength(2);
      expect(typeof template.gradient[0]).toBe("string");
      expect(typeof template.gradient[1]).toBe("string");
      expect(Object.keys(template.files).length).toBeGreaterThan(0);
    },
  );
});

describe("Template files", () => {
  it.each(PROJECT_TEMPLATES.map((t) => [t.id, t]))(
    "%s should have non-empty file contents",
    (_id, template: ProjectTemplate) => {
      for (const [relativePath, content] of Object.entries(template.files)) {
        expect(relativePath).toBeTruthy();
        expect(content.length).toBeGreaterThan(0);
      }
    },
  );

  it("react-landing should scaffold a React app with App, styles and entry", () => {
    const t = PROJECT_TEMPLATES.find((x) => x.id === "react-landing")!;
    expect(t.files).toHaveProperty("src/App.tsx");
    expect(t.files).toHaveProperty("src/styles.css");
    expect(t.files).toHaveProperty("src/index.tsx");
    expect(t.files["src/App.tsx"]).toContain("Vibe Studio");
  });

  it("portfolio should scaffold an HTML/CSS/JS site", () => {
    const t = PROJECT_TEMPLATES.find((x) => x.id === "portfolio")!;
    expect(t.files).toHaveProperty("index.html");
    expect(t.files).toHaveProperty("styles.css");
    expect(t.files).toHaveProperty("script.js");
    expect(t.files["index.html"]).toContain("Mi Portfolio");
  });

  it("todo-app should scaffold a React todo app", () => {
    const t = PROJECT_TEMPLATES.find((x) => x.id === "todo-app")!;
    expect(t.files).toHaveProperty("src/App.tsx");
    expect(t.files).toHaveProperty("src/styles.css");
    expect(t.files).toHaveProperty("src/index.tsx");
    expect(t.files["src/App.tsx"]).toContain("Mis Tareas");
  });
});

describe("Template metadata", () => {
  it("react-landing should be a web category with cyan→violet gradient", () => {
    const t = PROJECT_TEMPLATES.find((x) => x.id === "react-landing")!;
    expect(t.category).toBe("web");
    expect(t.icon).toBe("Rocket");
    expect(t.gradient).toEqual(["#06b6d4", "#8b5cf6"]);
  });

  it("portfolio should be a landing category with violet→pink gradient", () => {
    const t = PROJECT_TEMPLATES.find((x) => x.id === "portfolio")!;
    expect(t.category).toBe("landing");
    expect(t.icon).toBe("User");
    expect(t.gradient).toEqual(["#8b5cf6", "#ec4899"]);
  });

  it("todo-app should be a web category with green→cyan gradient", () => {
    const t = PROJECT_TEMPLATES.find((x) => x.id === "todo-app")!;
    expect(t.category).toBe("web");
    expect(t.icon).toBe("CheckSquare");
    expect(t.gradient).toEqual(["#10b981", "#06b6d4"]);
  });
});
