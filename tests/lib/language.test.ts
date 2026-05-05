import { describe, it, expect } from "vitest";
import { detectLanguage } from "../../src/lib/language";

describe("detectLanguage", () => {
  // ─── HTML ──────────────────────────────────────────────────────
  it('should detect .html as "html"', () => {
    expect(detectLanguage("index.html")).toBe("html");
  });

  // ─── CSS ───────────────────────────────────────────────────────
  it('should detect .css as "css"', () => {
    expect(detectLanguage("styles.css")).toBe("css");
  });

  // ─── JavaScript ────────────────────────────────────────────────
  it('should detect .js as "javascript"', () => {
    expect(detectLanguage("app.js")).toBe("javascript");
  });

  it('should detect .jsx as "javascript"', () => {
    expect(detectLanguage("Component.jsx")).toBe("javascript");
  });

  // ─── TypeScript ────────────────────────────────────────────────
  it('should detect .ts as "typescript"', () => {
    expect(detectLanguage("server.ts")).toBe("typescript");
  });

  it('should detect .tsx as "typescript"', () => {
    expect(detectLanguage("App.tsx")).toBe("typescript");
  });

  // ─── Data formats ──────────────────────────────────────────────
  it('should detect .json as "json"', () => {
    expect(detectLanguage("data.json")).toBe("json");
  });

  it('should detect .md and .mdx as "markdown"', () => {
    expect(detectLanguage("readme.md")).toBe("markdown");
    expect(detectLanguage("docs.mdx")).toBe("markdown");
  });

  it('should detect .xml as "xml"', () => {
    expect(detectLanguage("config.xml")).toBe("xml");
  });

  it('should detect .yaml/.yml as "yaml"', () => {
    expect(detectLanguage("config.yaml")).toBe("yaml");
    expect(detectLanguage("config.yml")).toBe("yaml");
  });

  // ─── Shell ─────────────────────────────────────────────────────
  it('should detect .sh and .bash as "shell"', () => {
    expect(detectLanguage("script.sh")).toBe("shell");
    expect(detectLanguage("script.bash")).toBe("shell");
  });

  // ─── Other languages ───────────────────────────────────────────
  it('should detect .py as "python"', () => {
    expect(detectLanguage("script.py")).toBe("python");
  });

  it('should detect .rs as "rust"', () => {
    expect(detectLanguage("main.rs")).toBe("rust");
  });

  it('should detect .toml as "plaintext"', () => {
    expect(detectLanguage("Cargo.toml")).toBe("plaintext");
  });

  // ─── Edge cases ────────────────────────────────────────────────
  it('should return "plaintext" for unknown extensions', () => {
    expect(detectLanguage("file.xyz")).toBe("plaintext");
    expect(detectLanguage("file.abc123")).toBe("plaintext");
  });

  it('should return "plaintext" for files without extension', () => {
    expect(detectLanguage("Makefile")).toBe("plaintext");
    expect(detectLanguage("LICENSE")).toBe("plaintext");
    expect(detectLanguage("Dockerfile")).toBe("plaintext");
  });

  it("should be case insensitive", () => {
    expect(detectLanguage("INDEX.HTML")).toBe("html");
    expect(detectLanguage("STYLES.CSS")).toBe("css");
    expect(detectLanguage("APP.JS")).toBe("javascript");
  });

  it("should handle paths with multiple dots", () => {
    expect(detectLanguage("component.test.tsx")).toBe("typescript");
    expect(detectLanguage("file.spec.js")).toBe("javascript");
    expect(detectLanguage("style.min.css")).toBe("css");
  });

  it("should handle full file paths", () => {
    expect(detectLanguage("/home/user/project/src/index.html")).toBe("html");
    expect(detectLanguage("C:\\project\\src\\app.ts")).toBe("typescript");
    expect(detectLanguage("src/styles/components/Button.css")).toBe("css");
  });
});
