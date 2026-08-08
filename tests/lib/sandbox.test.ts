import { describe, it, expect, beforeEach } from "vitest";
import {
  isSandboxWorkspace,
  ensureSandbox,
  validateSandboxQuota,
  getUserPlan,
  syncSandboxFileTree,
} from "@/lib/sandbox";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import type { FileNode } from "@/lib/types";

function resetProject() {
  useProjectStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    openTabs: [],
    activeTab: null,
    isDirty: {},
    fileContents: {},
    isLoading: false,
    statusMessage: null,
    diffMode: false,
    diffOriginalContent: "",
    diffModifiedContent: "",
    isSyncing: false,
    lastSyncedAt: null,
    hasUnsyncedChanges: false,
    autoBackupEnabled: false,
    syncError: null,
  });
}

beforeEach(() => {
  resetProject();
  useAuthStore.setState({ plan: "free" });
});

describe("isSandboxWorkspace", () => {
  it("should detect sandbox workspace ids", () => {
    expect(isSandboxWorkspace("sandbox://proyecto-123")).toBe(true);
    expect(isSandboxWorkspace("/real/path")).toBe(false);
    expect(isSandboxWorkspace(null)).toBe(false);
    expect(isSandboxWorkspace(undefined)).toBe(false);
  });
});

describe("ensureSandbox", () => {
  it("should return the active workspace when one exists", () => {
    useProjectStore.setState({
      activeWorkspaceId: "/real",
      workspaces: [{ id: "/real", name: "r", path: "/real", files: [], isGitRepo: false, gitBranch: null }],
    });
    expect(ensureSandbox()).toBe("/real");
  });

  it("should re-activate an existing sandbox", () => {
    useProjectStore.setState({
      workspaces: [{ id: "sandbox://proyecto-1", name: "Mi Proyecto", path: "sandbox://proyecto-1", files: [], isGitRepo: false, gitBranch: null }],
    });
    expect(ensureSandbox()).toBe("sandbox://proyecto-1");
    expect(useProjectStore.getState().activeWorkspaceId).toBe("sandbox://proyecto-1");
  });

  it("should create a new sandbox when none exists", () => {
    const id = ensureSandbox();
    expect(id).toMatch(/^sandbox:\/\/proyecto-/);
    const state = useProjectStore.getState();
    expect(state.activeWorkspaceId).toBe(id);
    expect(state.workspaces).toHaveLength(1);
    expect(state.statusMessage).toBe("Sandbox creado automáticamente");
  });
});

describe("validateSandboxQuota", () => {
  it("should allow writes within the quota", () => {
    expect(() => validateSandboxQuota("free", {}, 100, true)).not.toThrow();
  });

  it("should reject files exceeding the per-file limit", () => {
    expect(() =>
      validateSandboxQuota("free", {}, 200 * 1024 + 1, true),
    ).toThrow(/Archivo demasiado grande/);
  });

  it("should reject new files when the file count limit is reached", () => {
    const contents: Record<string, string> = {};
    for (let i = 0; i < 20; i++) contents[`f${i}`] = "x";
    expect(() => validateSandboxQuota("free", contents, 10, true)).toThrow(
      /Límite de archivos/,
    );
  });

  it("should allow overwrites at the file count limit", () => {
    const contents: Record<string, string> = {};
    for (let i = 0; i < 20; i++) contents[`f${i}`] = "x";
    expect(() =>
      validateSandboxQuota("free", contents, 10, false, "f0"),
    ).not.toThrow();
  });

  it("should reject writes exceeding the total size quota", () => {
    const chunk = "a".repeat(180 * 1024); // < 200KB per-file limit
    const contents: Record<string, string> = {};
    for (let i = 0; i < 12; i++) contents[`f${i}`] = chunk; // ~2.16MB
    expect(() =>
      validateSandboxQuota("free", contents, 180 * 1024, true),
    ).toThrow(/Almacenamiento lleno/);
  });

  it("should subtract the existing size on overwrites", () => {
    // Replace a 200KB file with a 100KB one — projected total stays under the 2MB cap
    const big = "a".repeat(200 * 1024);
    expect(() =>
      validateSandboxQuota("free", { f1: big }, 100 * 1024, false, "f1"),
    ).not.toThrow();
  });

  it("should apply the pro quota", () => {
    expect(() => validateSandboxQuota("pro", {}, 2 * 1024 * 1024 + 1, true)).toThrow(
      /Archivo demasiado grande/,
    );
  });
});

describe("getUserPlan", () => {
  it("should map plans to tiers", () => {
    useAuthStore.setState({ plan: "pro" });
    expect(getUserPlan()).toBe("pro");
    useAuthStore.setState({ plan: "estudiante" });
    expect(getUserPlan()).toBe("student");
    useAuthStore.setState({ plan: "free" });
    expect(getUserPlan()).toBe("free");
  });
});

describe("syncSandboxFileTree", () => {
  const ws = (files: FileNode[]) => ({
    id: "sandbox://p",
    name: "Mi Proyecto",
    path: "sandbox://p",
    files,
    isGitRepo: false,
    gitBranch: null,
  });

  it("should be a no-op when the workspace is missing", () => {
    useProjectStore.setState({ workspaces: [] });
    expect(() => syncSandboxFileTree("sandbox://p", "a.ts")).not.toThrow();
  });

  it("should add a file and create nested directories", () => {
    useProjectStore.setState({ workspaces: [ws([])], activeWorkspaceId: "sandbox://p" });

    syncSandboxFileTree("sandbox://p", "src/utils/helper.ts");

    const files = useProjectStore.getState().workspaces[0].files;
    expect(files).toHaveLength(1);
    const src = files[0] as { type: string; name: string; children: FileNode[] };
    expect(src.type).toBe("directory");
    expect(src.name).toBe("src");
    const utils = src.children[0] as { type: string; name: string; children: FileNode[] };
    expect(utils.name).toBe("utils");
    expect(utils.children[0].name).toBe("helper.ts");
  });

  it("should add a root-level file", () => {
    useProjectStore.setState({ workspaces: [ws([])], activeWorkspaceId: "sandbox://p" });

    syncSandboxFileTree("sandbox://p", "index.html");

    const files = useProjectStore.getState().workspaces[0].files;
    expect(files[0]).toMatchObject({ name: "index.html", type: "file", extension: "html" });
  });

  it("should not duplicate files that already exist in the tree", () => {
    const existing: FileNode = {
      name: "a.ts",
      path: "sandbox://p/a.ts",
      type: "file",
      extension: "ts",
    };
    useProjectStore.setState({ workspaces: [ws([existing])], activeWorkspaceId: "sandbox://p" });

    syncSandboxFileTree("sandbox://p", "a.ts");

    expect(useProjectStore.getState().workspaces[0].files).toHaveLength(1);
  });

  it("should reuse existing directories when adding files", () => {
    const src: FileNode = {
      name: "src",
      path: "sandbox://p/src",
      type: "directory",
      children: [],
    };
    useProjectStore.setState({ workspaces: [ws([src])], activeWorkspaceId: "sandbox://p" });

    syncSandboxFileTree("sandbox://p", "src/app.ts");

    const files = useProjectStore.getState().workspaces[0].files;
    expect(files).toHaveLength(1);
    expect((files[0] as { children: FileNode[] }).children[0].name).toBe("app.ts");
  });
});
