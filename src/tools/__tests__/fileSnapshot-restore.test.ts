/**
 * fileSnapshot — restoreLastSnapshot + getAllSnapshots coverage.
 *
 * Ejecutar: npx vitest run src/tools/__tests__/fileSnapshot-restore.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveSnapshot,
  getAllSnapshots,
  restoreLastSnapshot,
  clearSnapshots,
} from "../fileSnapshot";
import { useProjectStore } from "@/stores/project";

const mockSaveFileContent = vi.fn();
vi.mock("@/lib/fs", () => ({
  saveFileContent: (...a: unknown[]) => mockSaveFileContent(...a),
}));

describe("getAllSnapshots", () => {
  beforeEach(() => clearSnapshots());

  it("retorna arreglo vacío sin snapshots", () => {
    expect(getAllSnapshots()).toHaveLength(0);
  });

  it("retorna snapshots guardados (readonly)", () => {
    saveSnapshot("a.ts", "aa", "write");
    saveSnapshot("b.ts", "bb", "diff");
    const all = getAllSnapshots();
    expect(all).toHaveLength(2);
    expect(all[0].path).toBe("a.ts");
  });
});

describe("restoreLastSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshots();
  });

  it("retorna null sin snapshots", async () => {
    expect(await restoreLastSnapshot()).toBeNull();
  });

  it("restaura el snapshot más reciente y actualiza el editor", async () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/proj", name: "proj", path: "/proj", files: [], isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: "/proj",
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });
    mockSaveFileContent.mockResolvedValue(undefined);
    const openFileSpy = vi.spyOn(useProjectStore.getState(), "openFile").mockResolvedValue(undefined);
    const setFileContentSpy = vi.spyOn(useProjectStore.getState(), "setFileContent");

    saveSnapshot("src/a.ts", "contenido original", "write");

    const restored = await restoreLastSnapshot();
    expect(restored).not.toBeNull();
    expect(restored!.content).toBe("contenido original");
    expect(mockSaveFileContent).toHaveBeenCalledWith("/proj/src/a.ts", "contenido original");
    expect(setFileContentSpy).toHaveBeenCalled();
    expect(openFileSpy).toHaveBeenCalled();
    openFileSpy.mockRestore();
  });

  it("devuelve snapshot aunque falle la escritura", async () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/proj", name: "proj", path: "/proj", files: [], isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: "/proj",
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });
    mockSaveFileContent.mockRejectedValue(new Error("disk error"));

    saveSnapshot("src/a.ts", "original", "diff");

    const restored = await restoreLastSnapshot();
    expect(restored).not.toBeNull();
    expect(restored!.content).toBe("original");
  });

  it("devuelve snapshot sin workspace activo", async () => {
    useProjectStore.setState({ workspaces: [], activeWorkspaceId: null });
    saveSnapshot("a.ts", "x", "write");
    const restored = await restoreLastSnapshot();
    expect(restored).not.toBeNull();
    expect(mockSaveFileContent).not.toHaveBeenCalled();
  });
});
