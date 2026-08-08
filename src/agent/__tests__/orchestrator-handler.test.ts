/**
 * orchestrator — handleMessage routing coverage.
 *
 * Cubre el routing de intents (chat/explore/code), bloqueo por plan,
 * memoria del harness, y decisiones TDD/delivery.
 *
 * Ejecutar: npx vitest run src/agent/__tests__/orchestrator-handler.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";
import { handleMessage, type OrchestratorConfig } from "../orchestrator";
import { useProjectStore } from "@/stores/project";

const streamSSEMock = vi.hoisted(() => vi.fn());
const executeToolMock = vi.hoisted(() => vi.fn());

vi.mock("../stream-client", () => ({ streamSSE: streamSSEMock }));
vi.mock("@/tools/executor", () => ({ executeTool: executeToolMock, getProjectSummary: () => "Proyecto: Demo" }));

const history: Message[] = [
  { id: "u1", role: "user", content: "hola", timestamp: 0 },
];

function config(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    providerId: "deepseek",
    plan: "pro",
    executionMode: "auto",
    hasProjectOpen: false,
    ...overrides,
  };
}

async function collect(text: string, cfg: OrchestratorConfig = config()) {
  const events: { type: string; [k: string]: unknown }[] = [];
  for await (const e of handleMessage(text, history, cfg)) {
    events.push(e as unknown as { type: string });
  }
  return events;
}

describe("handleMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamSSEMock.mockReset();
    executeToolMock.mockReset();
    useProjectStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  it("routea intent chat → runChatAgent", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "hola!" };
      yield { type: "done" };
    });

    const events = await collect("hola como estas");
    expect(events[0]).toMatchObject({ type: "phase", phase: "chatting" });
    expect(events.some((e) => e.type === "text" && e.content === "hola!")).toBe(true);
  });

  it("routea intent explore → runExploreAgent", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "investigación" };
      yield { type: "done" };
    });

    const events = await collect("analiza la arquitectura del proyecto", config({ hasProjectOpen: true }));
    expect(events[0]).toMatchObject({ type: "phase", phase: "thinking" });
    expect(streamSSEMock).toHaveBeenCalled();
  });

  it("routea intent code → runBuildAgent", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "voy a crear" };
      yield { type: "done" };
    });
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });

    const events = await collect("crear un componente login", config({ hasProjectOpen: true, testRunner: "vitest", hasGit: true }));
    expect(events[0]).toMatchObject({ type: "phase", phase: "planning" });
    expect(streamSSEMock).toHaveBeenCalled();
  });

  it("respeta el modo UI explícito (construir → code)", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "x" };
      yield { type: "done" };
    });
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });

    const events = await collect("haz lo que quieras", config({ hasProjectOpen: false, activeMode: "construir" }));
    expect(events[0]).toMatchObject({ type: "phase", phase: "planning" });
  });

  it("intent code con projectSummary y memories del harness", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "x" };
      yield { type: "done" };
    });
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });

    useProjectStore.setState({
      workspaces: [{
        id: "/proj", name: "p", path: "/proj", files: [], isGitRepo: true, gitBranch: "main",
      }],
      activeWorkspaceId: "/proj",
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });

    const events = await collect("crear login", config({ hasProjectOpen: true, testRunner: "vitest", hasGit: true }));
    expect(events.length).toBeGreaterThan(0);
  });
});
