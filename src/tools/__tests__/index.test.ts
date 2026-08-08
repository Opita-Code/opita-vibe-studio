/**
 * tools/index.ts — barrel export smoke tests.
 *
 * Verifica que todos los re-exports del barrel funcionan sin romper.
 * Ejecutar: npx vitest run src/tools/__tests__/index.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  TOOL_DEFINITIONS,
  formatToolsForPrompt,
  executeTool,
  getProjectSummary,
  parseToolCalls,
  formatToolResult,
  detectFirstCompleteTool,
  hasPartialToolTag,
  buildToolSystemPrompt,
  buildContextWarning,
  saveSnapshot,
  popLastSnapshot,
  getLastSnapshot,
  clearSnapshots,
  restoreLastSnapshot,
  getAllSnapshots,
} from "../index";
import type { ToolCall, ToolResult, ToolDefinition, ToolParameter, ParseResult, StreamingToolDetection } from "../index";

describe("tools/index barrel", () => {
  it("re-exporta TOOL_DEFINITIONS y formatToolsForPrompt", () => {
    expect(TOOL_DEFINITIONS).toBeInstanceOf(Array);
    expect(formatToolsForPrompt()).toContain("read_file");
  });

  it("re-exporta executeTool y getProjectSummary", async () => {
    expect(typeof executeTool).toBe("function");
    const r = await executeTool({ name: "unknown", args: {} });
    expect(r.success).toBe(false);
    expect(getProjectSummary()).toBeNull();
  });

  it("re-exporta parser functions", () => {
    expect(parseToolCalls("hola")).toBeDefined();
    expect(formatToolResult("read_file", true, "ok")).toContain("read_file");
    expect(detectFirstCompleteTool("sin tools")).toBeNull();
    expect(hasPartialToolTag("sin tags")).toBe(false);
  });

  it("re-exporta prompts", async () => {
    expect(typeof buildToolSystemPrompt).toBe("function");
    const warning = buildContextWarning(9_000, 10_000);
    expect(warning).not.toBeNull();
  });

  it("re-exporta snapshots", () => {
    clearSnapshots();
    saveSnapshot("a.ts", "x", "write");
    expect(getAllSnapshots()).toHaveLength(1);
    expect(getLastSnapshot("a.ts")).not.toBeNull();
    const popped = popLastSnapshot();
    expect(popped).not.toBeNull();
    expect(typeof restoreLastSnapshot).toBe("function");
  });

  it("tipos exportados existen", () => {
    // type-level only; verificar que no rompen al importar
    const call: ToolCall = { name: "read_file", args: { path: "a" } };
    const def: ToolDefinition = TOOL_DEFINITIONS[0];
    const param: ToolParameter = def.parameters[0];
    expect(call.name).toBe("read_file");
    expect(param.name).toBeTruthy();
    const _res: ToolResult = { name: "x", success: true };
    const _pr: ParseResult | null = null;
    const _sd: StreamingToolDetection | null = null;
    expect(_res).toBeDefined();
    expect(_pr).toBeNull();
    expect(_sd).toBeNull();
  });
});
