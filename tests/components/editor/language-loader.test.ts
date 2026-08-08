import { describe, it, expect } from "vitest";
import { loadLanguage } from "../../../src/components/editor/language-loader";

describe("loadLanguage", () => {
  it("should load the JavaScript extension", async () => {
    const ext = await loadLanguage("javascript");
    expect(ext).toBeDefined();
  });

  it("should load the JavaScriptReact extension", async () => {
    const ext = await loadLanguage("javascriptreact");
    expect(ext).toBeDefined();
  });

  it("should load the TypeScript extension", async () => {
    const ext = await loadLanguage("typescript");
    expect(ext).toBeDefined();
  });

  it("should load the TypeScriptReact extension", async () => {
    const ext = await loadLanguage("typescriptreact");
    expect(ext).toBeDefined();
  });

  it("should load the HTML extension", async () => {
    const ext = await loadLanguage("html");
    expect(ext).toBeDefined();
  });

  it("should load the CSS, SCSS and Less extensions", async () => {
    expect(await loadLanguage("css")).toBeDefined();
    expect(await loadLanguage("scss")).toBeDefined();
    expect(await loadLanguage("less")).toBeDefined();
  });

  it("should load the JSON extension", async () => {
    expect(await loadLanguage("json")).toBeDefined();
    expect(await loadLanguage("jsonc")).toBeDefined();
  });

  it("should load the XML extension", async () => {
    expect(await loadLanguage("xml")).toBeDefined();
  });

  it("should load the YAML extension", async () => {
    expect(await loadLanguage("yaml")).toBeDefined();
  });

  it("should load the Markdown extension", async () => {
    expect(await loadLanguage("markdown")).toBeDefined();
  });

  it("should load the Python extension", async () => {
    expect(await loadLanguage("python")).toBeDefined();
  });

  it("should return an empty array for plaintext or unsupported languages", async () => {
    expect(await loadLanguage("plaintext")).toEqual([]);
    expect(await loadLanguage("unknown-lang")).toEqual([]);
  });
});
