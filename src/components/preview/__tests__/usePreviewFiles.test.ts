/**
 * Tests para usePreviewFiles — VibeLens file mapping.
 * Ejecutar: npx vitest run src/components/preview/__tests__/usePreviewFiles.test.ts
 */
import { describe, it, expect } from "vitest";
import { isPreviewableFile, detectTemplate } from "../usePreviewFiles";

// ─── isPreviewableFile ─────────────────────────────────────────

describe("isPreviewableFile", () => {
  it("acepta archivos web estándar", () => {
    expect(isPreviewableFile("src/App.tsx")).toBe(true);
    expect(isPreviewableFile("src/index.ts")).toBe(true);
    expect(isPreviewableFile("src/styles.css")).toBe(true);
    expect(isPreviewableFile("index.html")).toBe(true);
    expect(isPreviewableFile("package.json")).toBe(true);
  });

  it("acepta archivos JSX", () => {
    expect(isPreviewableFile("components/Button.jsx")).toBe(true);
    expect(isPreviewableFile("pages/Home.tsx")).toBe(true);
  });

  it("rechaza node_modules", () => {
    expect(isPreviewableFile("node_modules/react/index.js")).toBe(false);
    expect(isPreviewableFile("node_modules/@types/react/index.d.ts")).toBe(false);
  });

  it("rechaza dist/build", () => {
    expect(isPreviewableFile("dist/bundle.js")).toBe(false);
    expect(isPreviewableFile("build/index.html")).toBe(false);
  });

  it("rechaza archivos de test", () => {
    expect(isPreviewableFile("src/App.test.tsx")).toBe(false);
    expect(isPreviewableFile("src/utils.spec.ts")).toBe(false);
    expect(isPreviewableFile("__tests__/helper.ts")).toBe(false);
  });

  it("rechaza archivos de config", () => {
    expect(isPreviewableFile("vite.config.ts")).toBe(false);
    expect(isPreviewableFile("tsconfig.json")).toBe(false);
    expect(isPreviewableFile(".eslintrc.js")).toBe(false);
  });

  it("rechaza archivos de declaración", () => {
    expect(isPreviewableFile("src/types.d.ts")).toBe(false);
    expect(isPreviewableFile("env.d.ts")).toBe(false);
  });

  it("rechaza stories", () => {
    expect(isPreviewableFile("Button.stories.tsx")).toBe(false);
  });

  it("rechaza binarios y no-web", () => {
    expect(isPreviewableFile("image.png")).toBe(false);
    expect(isPreviewableFile("font.woff2")).toBe(false);
    expect(isPreviewableFile("data.csv")).toBe(false);
  });

  it("maneja paths con backslashes (Windows)", () => {
    expect(isPreviewableFile("src\\components\\App.tsx")).toBe(true);
    expect(isPreviewableFile("node_modules\\react\\index.js")).toBe(false);
  });

  it("rechaza .git", () => {
    expect(isPreviewableFile(".git/config")).toBe(false);
  });
});

// ─── detectTemplate ────────────────────────────────────────────

describe("detectTemplate", () => {
  it("detecta react-ts cuando hay .tsx", () => {
    expect(detectTemplate(["src/App.tsx", "src/index.ts"])).toBe("react-ts");
  });

  it("detecta react cuando hay .jsx", () => {
    expect(detectTemplate(["src/App.jsx", "src/index.js"])).toBe("react");
  });

  it("detecta react-ts sobre react cuando hay ambos", () => {
    expect(detectTemplate(["src/App.tsx", "src/legacy.jsx"])).toBe("react-ts");
  });

  it("detecta static cuando solo hay html/css (sin JS)", () => {
    expect(detectTemplate(["index.html", "styles.css"])).toBe("static");
  });

  it("detecta static cuando hay html con js en la raíz (sin carpeta src/)", () => {
    // Classic multi-file static site: JS loaded via <script> tags, not a bundled entry point.
    // detectTemplate correctly returns "static" — Sandpack serves files as-is.
    expect(detectTemplate(["index.html", "styles.css", "script.js"])).toBe("static");
  });

  it("detecta vanilla-ts cuando hay .ts sin React", () => {
    expect(detectTemplate(["src/main.ts", "src/utils.ts"])).toBe("vanilla-ts");
  });

  it("detecta vanilla como fallback", () => {
    expect(detectTemplate(["src/main.js"])).toBe("vanilla");
  });

  it("retorna vanilla con array vacío", () => {
    expect(detectTemplate([])).toBe("vanilla");
  });
});
