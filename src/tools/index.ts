/**
 * @module tools
 * Sistema de herramientas del agente de código Vibe Studio.
 *
 * Exports principales:
 * - definitions: tipos y lista de herramientas
 * - executor: ejecución de herramientas contra el filesystem
 * - parser: parsing de tool calls del stream del LLM
 * - prompts: generación de system prompts con herramientas
 */

export type { ToolCall, ToolResult, ToolDefinition, ToolParameter } from "./definitions";
export { TOOL_DEFINITIONS, formatToolsForPrompt } from "./definitions";
export { executeTool, getProjectSummary } from "./executor";
export { parseToolCalls, formatToolResult, detectFirstCompleteTool, hasPartialToolTag } from "./parser";
export type { ParseResult, StreamingToolDetection } from "./parser";
export { buildToolSystemPrompt, buildContextWarning } from "./prompts";
export { saveSnapshot, popLastSnapshot, getLastSnapshot, clearSnapshots, restoreLastSnapshot, getAllSnapshots } from "./fileSnapshot";
