import { describe, it, expect } from "vitest";
import { parseFileRef } from "@/components/chat/MessageBubble";

// ─── FILE_REF regex + parseFileRef tests ────────────────────────

describe("parseFileRef", () => {
  const mockWorkspaceFiles = new Set([
    "src/utils.ts",
    "src/components/App.tsx",
    "package.json",
    "src/styles/index.css",
    "tests/unit/auth.test.ts",
    "README.md",
    "src/lib/types.ts",
    ".env",
  ]);

  // ─── Positive: should detect file refs ────────────────────

  it("detects a simple file path", () => {
    const result = parseFileRef("src/utils.ts", mockWorkspaceFiles);
    expect(result).toEqual({ path: "src/utils.ts", line: undefined, endLine: undefined });
  });

  it("detects a file path with line number", () => {
    const result = parseFileRef("src/utils.ts:42", mockWorkspaceFiles);
    expect(result).toEqual({ path: "src/utils.ts", line: 42, endLine: undefined });
  });

  it("detects a file path with line range", () => {
    const result = parseFileRef("src/utils.ts:42-58", mockWorkspaceFiles);
    expect(result).toEqual({ path: "src/utils.ts", line: 42, endLine: 58 });
  });

  it("detects nested file paths", () => {
    const result = parseFileRef("src/components/App.tsx", mockWorkspaceFiles);
    expect(result).toEqual({ path: "src/components/App.tsx", line: undefined, endLine: undefined });
  });

  it("detects root-level files", () => {
    const result = parseFileRef("package.json", mockWorkspaceFiles);
    expect(result).toEqual({ path: "package.json", line: undefined, endLine: undefined });
  });

  it("detects markdown files", () => {
    const result = parseFileRef("README.md", mockWorkspaceFiles);
    expect(result).toEqual({ path: "README.md", line: undefined, endLine: undefined });
  });

  it("trims whitespace before matching", () => {
    const result = parseFileRef("  src/utils.ts:10  ", mockWorkspaceFiles);
    expect(result).toEqual({ path: "src/utils.ts", line: 10, endLine: undefined });
  });

  // ─── Negative: should NOT detect non-file refs ────────────

  it("returns null for plain text", () => {
    expect(parseFileRef("hello world", mockWorkspaceFiles)).toBeNull();
  });

  it("returns null for code that looks like a method call", () => {
    expect(parseFileRef("console.log('hi')", mockWorkspaceFiles)).toBeNull();
  });

  it("returns null for valid path but not in workspace", () => {
    expect(parseFileRef("src/nonexistent.ts", mockWorkspaceFiles)).toBeNull();
  });

  it("returns null for path without known extension", () => {
    expect(parseFileRef("Makefile", mockWorkspaceFiles)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseFileRef("", mockWorkspaceFiles)).toBeNull();
  });

  it("returns null for just a number", () => {
    expect(parseFileRef("42", mockWorkspaceFiles)).toBeNull();
  });

  it("returns null for a URL", () => {
    expect(parseFileRef("https://example.com/file.ts", mockWorkspaceFiles)).toBeNull();
  });

  // ─── Partial match (suffix matching) ──────────────────────

  it("matches when AI uses partial path that exists as suffix", () => {
    const result = parseFileRef("types.ts", mockWorkspaceFiles);
    // types.ts matches src/lib/types.ts via suffix
    expect(result).toEqual({ path: "types.ts", line: undefined, endLine: undefined });
  });

  it("matches deep path by suffix", () => {
    const result = parseFileRef("unit/auth.test.ts", mockWorkspaceFiles);
    expect(result).toEqual({ path: "unit/auth.test.ts", line: undefined, endLine: undefined });
  });
});
