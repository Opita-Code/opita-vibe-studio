import { describe, it, expect } from "vitest";
import { detectLanguage } from "../../src/lib/language";

describe("detectLanguage", () => {
  // ─── HTML ──────────────────────────────────────────────────────
  it('should detect .html as "html"', () => {
    expect(detectLanguage("index.html")).toBe("html");
  });

  it('should detect .htm as "html"', () => {
    expect(detectLanguage("page.htm")).toBe("html");
  });

  // ─── CSS / Preprocessors ───────────────────────────────────────
  it('should detect .css as "css"', () => {
    expect(detectLanguage("styles.css")).toBe("css");
  });

  it('should detect .scss as "scss"', () => {
    expect(detectLanguage("theme.scss")).toBe("scss");
  });

  it('should detect .less as "less"', () => {
    expect(detectLanguage("vars.less")).toBe("less");
  });

  // ─── JavaScript ────────────────────────────────────────────────
  it('should detect .js as "javascript"', () => {
    expect(detectLanguage("app.js")).toBe("javascript");
  });

  it('should detect .mjs as "javascript"', () => {
    expect(detectLanguage("module.mjs")).toBe("javascript");
  });

  it('should detect .cjs as "javascript"', () => {
    expect(detectLanguage("config.cjs")).toBe("javascript");
  });

  // ─── JSX → javascriptreact (CRITICAL for syntax coloring) ─────
  it('should detect .jsx as "javascriptreact"', () => {
    expect(detectLanguage("Component.jsx")).toBe("javascriptreact");
  });

  // ─── TypeScript ────────────────────────────────────────────────
  it('should detect .ts as "typescript"', () => {
    expect(detectLanguage("server.ts")).toBe("typescript");
  });

  it('should detect .mts as "typescript"', () => {
    expect(detectLanguage("esm.mts")).toBe("typescript");
  });

  // ─── TSX → typescriptreact (CRITICAL for syntax coloring) ─────
  it('should detect .tsx as "typescriptreact"', () => {
    expect(detectLanguage("App.tsx")).toBe("typescriptreact");
  });

  // ─── Data formats ──────────────────────────────────────────────
  it('should detect .json as "json"', () => {
    expect(detectLanguage("data.json")).toBe("json");
  });

  it('should detect .jsonc as "jsonc"', () => {
    expect(detectLanguage("tsconfig.jsonc")).toBe("jsonc");
  });

  it('should detect .md and .mdx as "markdown"', () => {
    expect(detectLanguage("readme.md")).toBe("markdown");
    expect(detectLanguage("docs.mdx")).toBe("markdown");
  });

  it('should detect .xml and .svg as "xml"', () => {
    expect(detectLanguage("config.xml")).toBe("xml");
    expect(detectLanguage("logo.svg")).toBe("xml");
  });

  it('should detect .yaml/.yml as "yaml"', () => {
    expect(detectLanguage("config.yaml")).toBe("yaml");
    expect(detectLanguage("config.yml")).toBe("yaml");
  });

  // ─── Config ────────────────────────────────────────────────────
  it('should detect .toml as "ini" (closest Monaco language)', () => {
    expect(detectLanguage("Cargo.toml")).toBe("ini");
  });

  it('should detect .ini, .cfg, .conf as "ini"', () => {
    expect(detectLanguage("settings.ini")).toBe("ini");
    expect(detectLanguage("app.cfg")).toBe("ini");
    expect(detectLanguage("nginx.conf")).toBe("ini");
  });

  // ─── Shell ─────────────────────────────────────────────────────
  it('should detect .sh, .bash, .zsh as "shell"', () => {
    expect(detectLanguage("script.sh")).toBe("shell");
    expect(detectLanguage("script.bash")).toBe("shell");
    expect(detectLanguage("script.zsh")).toBe("shell");
  });

  it('should detect .ps1 as "powershell"', () => {
    expect(detectLanguage("deploy.ps1")).toBe("powershell");
  });

  it('should detect .bat as "bat"', () => {
    expect(detectLanguage("build.bat")).toBe("bat");
  });

  // ─── Other languages ───────────────────────────────────────────
  it('should detect .py as "python"', () => {
    expect(detectLanguage("script.py")).toBe("python");
  });

  it('should detect .rs as "rust"', () => {
    expect(detectLanguage("main.rs")).toBe("rust");
  });

  it('should detect .go as "go"', () => {
    expect(detectLanguage("main.go")).toBe("go");
  });

  it('should detect .java as "java"', () => {
    expect(detectLanguage("App.java")).toBe("java");
  });

  it('should detect .kt as "kotlin"', () => {
    expect(detectLanguage("Main.kt")).toBe("kotlin");
  });

  it('should detect .rb as "ruby"', () => {
    expect(detectLanguage("app.rb")).toBe("ruby");
  });

  it('should detect .sql as "sql"', () => {
    expect(detectLanguage("migration.sql")).toBe("sql");
  });

  it('should detect .graphql/.gql as "graphql"', () => {
    expect(detectLanguage("schema.graphql")).toBe("graphql");
    expect(detectLanguage("query.gql")).toBe("graphql");
  });

  // ─── Special filenames ─────────────────────────────────────────
  it('should detect Dockerfile as "dockerfile"', () => {
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("dockerfile")).toBe("dockerfile");
  });

  it('should detect .env as "ini"', () => {
    expect(detectLanguage(".env")).toBe("ini");
    expect(detectLanguage(".env.local")).toBe("ini");
  });

  it('should detect Makefile as "plaintext"', () => {
    expect(detectLanguage("Makefile")).toBe("plaintext");
    expect(detectLanguage("makefile")).toBe("plaintext");
  });

  // ─── Edge cases ────────────────────────────────────────────────
  it('should return "plaintext" for unknown extensions', () => {
    expect(detectLanguage("file.xyz")).toBe("plaintext");
    expect(detectLanguage("file.abc123")).toBe("plaintext");
  });

  it('should return "plaintext" for files without known extension', () => {
    expect(detectLanguage("LICENSE")).toBe("plaintext");
  });

  it("should be case insensitive", () => {
    expect(detectLanguage("INDEX.HTML")).toBe("html");
    expect(detectLanguage("STYLES.CSS")).toBe("css");
    expect(detectLanguage("APP.JS")).toBe("javascript");
  });

  it("should handle paths with multiple dots", () => {
    expect(detectLanguage("component.test.tsx")).toBe("typescriptreact");
    expect(detectLanguage("file.spec.js")).toBe("javascript");
    expect(detectLanguage("style.min.css")).toBe("css");
  });

  it("should handle full file paths", () => {
    expect(detectLanguage("/home/user/project/src/index.html")).toBe("html");
    expect(detectLanguage("C:\\project\\src\\app.ts")).toBe("typescript");
    expect(detectLanguage("src/styles/components/Button.css")).toBe("css");
  });
});
