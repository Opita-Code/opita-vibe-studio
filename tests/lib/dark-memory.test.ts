import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────

const { mockBridge, mockBridgeCtor, setEngramBridge, setSessionBridge, setSkillBridge, setDarkMemoryContextBridge, setDarkMemoryPersistBridge } = vi.hoisted(() => {
  const setEngramBridge = vi.fn();
  const setSessionBridge = vi.fn();
  const setSkillBridge = vi.fn();
  const setDarkMemoryContextBridge = vi.fn();
  const setDarkMemoryPersistBridge = vi.fn();

  class MockDarkMemoryBridge {
    operator = "aura";
    projectId = "";
    sessionStart = vi.fn(async () => {});
    sessionClose = vi.fn(async () => {});
    recall = vi.fn(async () => []);
    constructor(opts: { operator: string; projectId: string; transport?: string }) {
      this.operator = opts.operator;
      this.projectId = opts.projectId;
    }
  }

  const mockBridgeCtor = vi.fn((opts: ConstructorParameters<typeof MockDarkMemoryBridge>[0]) => new MockDarkMemoryBridge(opts));

  return { mockBridge: MockDarkMemoryBridge, mockBridgeCtor, setEngramBridge, setSessionBridge, setSkillBridge, setDarkMemoryContextBridge, setDarkMemoryPersistBridge };
});

vi.mock("@opita/dark-memory-bridge", () => ({
  DarkMemoryBridge: mockBridgeCtor,
}));

vi.mock("@/agent/harnesses/phases/engram-memory", () => ({ setEngramBridge }));
vi.mock("@/agent/harnesses/infrastructure/session-summary", () => ({ setSessionBridge }));
vi.mock("@/agent/harnesses/skills/skill-registry", () => ({ setSkillBridge }));
vi.mock("@/agent/harnesses/infrastructure/dark-memory-context", () => ({ setDarkMemoryContextBridge }));
vi.mock("@/agent/harnesses/infrastructure/dark-memory-persist", () => ({ setDarkMemoryPersistBridge }));

import { useAuthStore } from "@/stores/auth";
import {
  getDarkMemoryBridge,
  initDarkMemory,
  startDarkMemorySession,
  closeDarkMemorySession,
  buildMemoryContextBlock,
  darkMemoryStatus,
  _resetDarkMemoryForTests,
} from "@/lib/dark-memory";

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null });
  _resetDarkMemoryForTests();
});

describe("dark-memory singleton", () => {
  it("should return null before initialization", () => {
    expect(getDarkMemoryBridge()).toBeNull();
    expect(darkMemoryStatus()).toEqual({ initialized: false, projectId: null });
  });

  it("should init the bridge scoped to the user email", async () => {
    useAuthStore.setState({
      user: { id: "u", email: "MiCorreo@Opita.Co", name: "N", plan: "free", verified: true },
    });

    const bridge = await initDarkMemory();

    expect(bridge).toBeInstanceOf(mockBridge);
    expect(bridge?.operator).toBe("aura");
    expect(bridge?.projectId).toBe("vibe:micorreo-opita-co");
    expect(setEngramBridge).toHaveBeenCalledWith(bridge);
    expect(setSessionBridge).toHaveBeenCalledWith(bridge);
    expect(setSkillBridge).toHaveBeenCalledWith(bridge);
    expect(setDarkMemoryContextBridge).toHaveBeenCalledWith(bridge);
    expect(setDarkMemoryPersistBridge).toHaveBeenCalledWith(bridge);
    expect(darkMemoryStatus()).toEqual({ initialized: true, projectId: "vibe:micorreo-opita-co" });
  });

  it("should use the default projectId when the user has no email", async () => {
    await initDarkMemory("my-project");
    expect(getDarkMemoryBridge()?.projectId).toBe("my-project");
  });

  it("should be idempotent and not recreate the bridge", async () => {
    const first = await initDarkMemory("project-a");
    const second = await initDarkMemory("project-b");
    expect(first).toBe(second);
    expect(mockBridgeCtor).toHaveBeenCalledTimes(1);
  });

  it("should reset the singleton for tests", () => {
    _resetDarkMemoryForTests();
    expect(getDarkMemoryBridge()).toBeNull();
    expect(setEngramBridge).toHaveBeenCalledWith(null);
    expect(darkMemoryStatus().initialized).toBe(false);
  });
});

describe("session lifecycle", () => {
  it("should be a no-op without a bridge", async () => {
    await expect(startDarkMemorySession()).resolves.toBeUndefined();
    await expect(closeDarkMemorySession()).resolves.toBeUndefined();
  });

  it("should start and close the session on the bridge", async () => {
    await initDarkMemory();
    await startDarkMemorySession();
    expect(getDarkMemoryBridge()!.sessionStart).toHaveBeenCalled();

    await closeDarkMemorySession();
    expect(getDarkMemoryBridge()!.sessionClose).toHaveBeenCalled();
  });

  it("should warn when sessionStart throws", async () => {
    await initDarkMemory();
    (getDarkMemoryBridge()!.sessionStart as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("sidecar down"),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await startDarkMemorySession();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should warn when sessionClose throws", async () => {
    await initDarkMemory();
    (getDarkMemoryBridge()!.sessionClose as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("sidecar down"),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await closeDarkMemorySession();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("buildMemoryContextBlock", () => {
  it("should return empty without a bridge", async () => {
    await expect(buildMemoryContextBlock("hola")).resolves.toBe("");
  });

  it("should return empty when there are no hits", async () => {
    await initDarkMemory();
    await expect(buildMemoryContextBlock("hola")).resolves.toBe("");
  });

  it("should render a markdown block from recalled memories", async () => {
    await initDarkMemory();
    (getDarkMemoryBridge()!.recall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { kind: "finding", title: "Decisión X", tags: "sdd,backlog", content: "Contenido largo ".repeat(50) },
    ]);

    const block = await buildMemoryContextBlock("hola", 3);

    expect(block).toContain("## Memoria de sesiones anteriores");
    expect(block).toContain("[finding] Decisión X");
    expect(block).toContain("sdd,backlog");
    expect(getDarkMemoryBridge()!.recall).toHaveBeenCalledWith({
      query: "hola",
      operator: "aura",
      limit: 3,
    });
  });

  it("should warn and return empty when recall throws", async () => {
    await initDarkMemory();
    (getDarkMemoryBridge()!.recall as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("recall failed"),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(buildMemoryContextBlock("hola")).resolves.toBe("");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
