/**
 * agent/index.ts — barrel export smoke tests.
 *
 * Verifica que el public API de @/agent re-exporta correctamente.
 * Ejecutar: npx vitest run src/agent/__tests__/index.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  useAgentHandler,
  handleMessage,
  classifyIntent,
  getToolLabel,
  PHASE_LABELS,
  getToolsForPhase,
  getToolNamesForPhase,
  createDraftSpec,
  saveSpec,
  loadSpec,
  listSpecs,
  specToMarkdown,
  detectIdea,
  createIdea,
  saveIdea,
  searchIdeas,
  getIdeasByStatus,
  updateIdeaStatus,
  matchCompletedWork,
  formatBacklogSummary,
  IDEA_STATUS_LABELS,
  IDEA_PRIORITY_LABELS,
  buildProjectContext,
  ExecutionRoadmap,
  AgentStepAccordion,
} from "../index";
import type {
  AgentEvent,
  AgentPhase,
  AgentStep,
  ExecutionMode,
  IntentClass,
  RoadmapGoal,
  FileSummary,
  FileAction,
  ProjectContext,
  AgentSkill,
  SpecDocument,
  Idea,
  IdeaStatus,
  IdeaPriority,
  SDDPhase,
} from "../index";

describe("agent/index barrel", () => {
  it("re-exporta funciones primarias", () => {
    expect(typeof useAgentHandler).toBe("function");
    expect(typeof handleMessage).toBe("function");
    expect(typeof classifyIntent).toBe("function");
  });

  it("re-exporta utilidades de prompts y tools", () => {
    expect(typeof getToolLabel).toBe("function");
    expect(getToolLabel("read_file", { path: "a.ts" })).toContain("a.ts");
    expect(PHASE_LABELS.building).toBe("Construyendo...");
    expect(getToolsForPhase("explore")).toBeDefined();
    expect(getToolNamesForPhase("explore")).toBeDefined();
  });

  it("re-exporta spec-writer", async () => {
    expect(typeof createDraftSpec).toBe("function");
    expect(typeof saveSpec).toBe("function");
    expect(typeof loadSpec).toBe("function");
    expect(typeof listSpecs).toBe("function");
    expect(typeof specToMarkdown).toBe("function");
  });

  it("re-exporta idea-backlog", () => {
    expect(typeof detectIdea).toBe("function");
    expect(typeof createIdea).toBe("function");
    expect(typeof saveIdea).toBe("function");
    expect(typeof searchIdeas).toBe("function");
    expect(typeof getIdeasByStatus).toBe("function");
    expect(typeof updateIdeaStatus).toBe("function");
    expect(typeof matchCompletedWork).toBe("function");
    expect(typeof formatBacklogSummary).toBe("function");
    expect(IDEA_STATUS_LABELS).toBeDefined();
    expect(IDEA_PRIORITY_LABELS).toBeDefined();
  });

  it("re-exporta context-loader", () => {
    const ctx = buildProjectContext("proj", {}, ["package.json"]);
    expect(ctx).toBeDefined();
  });

  it("re-exporta componentes", () => {
    expect(ExecutionRoadmap).toBeDefined();
    expect(AgentStepAccordion).toBeDefined();
  });

  it("tipos exportados existen (type-level)", () => {
    const _e: AgentEvent = { type: "done", summary: [] };
    const _p: AgentPhase = "thinking";
    const _s: AgentStep = { id: "1", icon: "x", label: "l", status: "done", timestamp: 0 };
    const _m: ExecutionMode = "auto";
    const _i: IntentClass = "chat";
    const _r: RoadmapGoal = { id: "g", label: "l", status: "pending" };
    const _f: FileSummary = { path: "p", action: "created" };
    const _fa: FileAction = "deleted";
    const _pc: ProjectContext | null = null;
    const _sk: AgentSkill | null = null;
    const _sp: SpecDocument | null = null;
    const _id: Idea | null = null;
    const _is: IdeaStatus = "idea";
    const _ip: IdeaPriority = "media";
    const _ph: SDDPhase = "explore";
    expect(_e.type).toBe("done");
    expect(_p).toBe("thinking");
    expect(_s).toBeTruthy();
    expect(_m).toBe("auto");
    expect(_i).toBe("chat");
    expect(_r).toBeTruthy();
    expect(_f).toBeTruthy();
    expect(_fa).toBe("deleted");
    expect(_pc).toBeNull();
    expect(_sk).toBeNull();
    expect(_sp).toBeNull();
    expect(_id).toBeNull();
    expect(_is).toBe("idea");
    expect(_ip).toBe("media");
    expect(_ph).toBe("explore");
  });
});
