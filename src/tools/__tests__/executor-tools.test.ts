/**
 * Executor — full tool handler coverage (filesystem + virtual + OSINT).
 *
 * Covers the tool implementations dispatched by executeTool():
 * read_file, write_file, apply_diff, list_files, search_code,
 * delete_file, preview_component, refresh_preview, and the OSINT
 * research tools (docs_search, docs_fetch, code_search, cve_check,
 * synthesis). Mocks the fs/sandbox/memory/preview deps.
 *
 * Ejecutar: npx vitest run src/tools/__tests__/executor-tools.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeTool, getProjectSummary } from "../executor";
import type { ToolCall } from "../definitions";
import { useProjectStore } from "@/stores/project";
import { clearSnapshots } from "../fileSnapshot";

// ─── Module mocks ──────────────────────────────────────────────

const mockReadFileContent = vi.fn();
const mockSaveFileContent = vi.fn();
const mockLoadProject = vi.fn();
const mockDeleteEntry = vi.fn();

vi.mock("@/lib/fs", () => ({
  readFileContent: (...a: unknown[]) => mockReadFileContent(...a),
  saveFileContent: (...a: unknown[]) => mockSaveFileContent(...a),
  loadProject: (...a: unknown[]) => mockLoadProject(...a),
  deleteEntry: (...a: unknown[]) => mockDeleteEntry(...a),
}));

const mockEnsureSandbox = vi.fn();
const mockValidateSandboxQuota = vi.fn();
const mockGetUserPlan = vi.fn();
const mockSyncSandboxFileTree = vi.fn();

vi.mock("@/lib/sandbox", () => ({
  isSandboxWorkspace: (id: string | null) =>
    typeof id === "string" && id.startsWith("sandbox://"),
  ensureSandbox: (...a: unknown[]) => mockEnsureSandbox(...a),
  validateSandboxQuota: (...a: unknown[]) => mockValidateSandboxQuota(...a),
  getUserPlan: (...a: unknown[]) => mockGetUserPlan(...a),
  syncSandboxFileTree: (...a: unknown[]) => mockSyncSandboxFileTree(...a),
}));

const mockSaveMemory = vi.fn();
const mockSearchMemories = vi.fn();

vi.mock("@/lib/memory", () => ({
  saveMemory: (...a: unknown[]) => mockSaveMemory(...a),
  searchMemories: (...a: unknown[]) => mockSearchMemories(...a),
}));

const mockTriggerPreviewRefresh = vi.fn();
vi.mock("@/lib/preview-refresh", () => ({
  triggerPreviewRefresh: (...a: unknown[]) => mockTriggerPreviewRefresh(...a),
}));

const mockSearchDocs = vi.fn((..._args: unknown[]): unknown => undefined);
const mockFetchDoc = vi.fn((..._args: unknown[]): unknown => undefined);
const mockSearchCode = vi.fn((..._args: unknown[]): unknown => undefined);
const mockCheckCve = vi.fn((..._args: unknown[]): unknown => undefined);
const mockFormatSearchResults = vi.fn((r: unknown[]) => r.map((x: any) => `${x.title}: ${x.url}`).join("\n"));
const mockFormatCveResults = vi.fn((r: unknown[]) => r.map((x: any) => `${x.id}: ${x.severity}`).join("\n"));
const mockFormatCodeSearchResults = vi.fn((r: unknown[]) => r.map((x: any) => `${x.name}: ${x.url}`).join("\n"));

vi.mock("../research-bridge", () => ({
  searchDocs: (...a: unknown[]) => mockSearchDocs(...a),
  fetchDoc: (...a: unknown[]) => mockFetchDoc(...a),
  searchCode: (...a: unknown[]) => mockSearchCode(...a),
  checkCve: (...a: unknown[]) => mockCheckCve(...a),
  formatSearchResults: (...a: unknown[]) => mockFormatSearchResults(a[0] as unknown[]),
  formatCveResults: (...a: unknown[]) => mockFormatCveResults(a[0] as unknown[]),
  formatCodeSearchResults: (...a: unknown[]) => mockFormatCodeSearchResults(a[0] as unknown[]),
}));

const mockGetDarkMemoryBridge = vi.fn();
vi.mock("@/lib/dark-memory", () => ({
  getDarkMemoryBridge: (...a: unknown[]) => mockGetDarkMemoryBridge(...a),
}));

const mockSetPreviewTarget = vi.fn();
const mockSetVibeLensEnabled = vi.fn();
vi.mock("@/stores/ui", () => ({
  useUIStore: { getState: () => ({ setPreviewTarget: mockSetPreviewTarget, setVibeLensEnabled: mockSetVibeLensEnabled }) },
}));

const mockIsTauri = vi.fn();
vi.mock("@/lib/platform", () => ({
  isTauri: (...a: unknown[]) => mockIsTauri(...a),
}));

const mockExecShell = vi.fn();
vi.mock("@/lib/ipc", () => ({
  execShell: (...a: unknown[]) => mockExecShell(...a),
}));

// ─── Helpers ──────────────────────────────────────────────────

const VIRTUAL_WS_ID = "template://portfolio";

function setVirtualWorkspace(fileContents: Record<string, string>) {
  useProjectStore.setState({
    workspaces: [{
      id: VIRTUAL_WS_ID,
      name: "Portfolio",
      path: VIRTUAL_WS_ID,
      files: [
        { name: "src", path: `${VIRTUAL_WS_ID}/src`, type: "directory", children: [
          { name: "App.tsx", path: `${VIRTUAL_WS_ID}/src/App.tsx`, type: "file", extension: "tsx" },
        ] },
        { name: "README.md", path: `${VIRTUAL_WS_ID}/README.md`, type: "file", extension: "md" },
        { name: "node_modules", path: `${VIRTUAL_WS_ID}/node_modules`, type: "directory", children: [] },
      ],
      isGitRepo: false,
      gitBranch: null,
    }],
    activeWorkspaceId: VIRTUAL_WS_ID,
    fileContents,
    openTabs: [],
    activeTab: null,
  });
}

function setRealWorkspace() {
  useProjectStore.setState({
    workspaces: [{
      id: "/proj",
      name: "proj",
      path: "/proj",
      files: [],
      isGitRepo: false,
      gitBranch: null,
    }],
    activeWorkspaceId: "/proj",
    fileContents: {},
    openTabs: [],
    activeTab: null,
  });
}

function tool(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { name, args };
}

// ─── read_file ─────────────────────────────────────────────────

describe("executeTool — read_file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDarkMemoryBridge.mockReturnValue(null);
  });

  it("requiere path", async () => {
    const r = await executeTool(tool("read_file", {}));
    expect(r.success).toBe(false);
    expect(r.error).toContain("path");
  });

  it("lee archivo en workspace virtual", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/src/App.tsx`]: "const App = 1;" });
    const r = await executeTool(tool("read_file", { path: "src/App.tsx" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("const App = 1;");
    expect(String(r.result)).toContain("1 líneas");
  });

  it("archivo virtual no encontrado → error", async () => {
    setVirtualWorkspace({});
    const r = await executeTool(tool("read_file", { path: "missing.ts" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("no encontrado");
  });

  it("lee archivo en filesystem real", async () => {
    setRealWorkspace();
    mockReadFileContent.mockResolvedValue("line1\nline2\nline3");
    const r = await executeTool(tool("read_file", { path: "index.ts" }));
    expect(r.success).toBe(true);
    expect(mockReadFileContent).toHaveBeenCalledWith("/proj/index.ts");
    expect(String(r.result)).toContain("line1");
  });

  it("trunca archivos grandes (>500 líneas)", async () => {
    setRealWorkspace();
    const big = Array.from({ length: 600 }, (_, i) => `line${i}`).join("\n");
    mockReadFileContent.mockResolvedValue(big);
    const r = await executeTool(tool("read_file", { path: "big.ts" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("líneas más");
  });

  it("errores del filesystem → error controlado", async () => {
    setRealWorkspace();
    mockReadFileContent.mockRejectedValue(new Error("EACCES"));
    const r = await executeTool(tool("read_file", { path: "secret.ts" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("EACCES");
  });
});

// ─── write_file ────────────────────────────────────────────────

describe("executeTool — write_file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDarkMemoryBridge.mockReturnValue(null);
  });

  it("requiere path", async () => {
    const r = await executeTool(tool("write_file", { content: "x" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("path");
  });

  it("escribe en workspace virtual (archivo nuevo, sin snapshot)", async () => {
    setVirtualWorkspace({});
    const r = await executeTool(tool("write_file", { path: "nuevo.ts", content: "export {}" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("nuevo.ts");
    const state = useProjectStore.getState();
    expect(state.fileContents[`${VIRTUAL_WS_ID}/nuevo.ts`]).toBe("export {}");
  });

  it("escribe sobre archivo virtual existente (snapshot previo)", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/a.ts`]: "old" });
    const r = await executeTool(tool("write_file", { path: "a.ts", content: "new" }));
    expect(r.success).toBe(true);
    expect(useProjectStore.getState().fileContents[`${VIRTUAL_WS_ID}/a.ts`]).toBe("new");
  });

  it("escribe en sandbox:// con validación de cuota", async () => {
    useProjectStore.setState({
      workspaces: [{
        id: "sandbox://s1", name: "s", path: "sandbox://s1", files: [], isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: "sandbox://s1",
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });
    mockGetUserPlan.mockReturnValue("free");
    mockValidateSandboxQuota.mockImplementation(() => {});
    const r = await executeTool(tool("write_file", { path: "x.txt", content: "hi" }));
    expect(r.success).toBe(true);
    expect(mockValidateSandboxQuota).toHaveBeenCalled();
  });

  it("escribe en filesystem real + abre editor", async () => {
    setRealWorkspace();
    mockReadFileContent.mockRejectedValue(new Error("ENOENT"));
    mockSaveFileContent.mockResolvedValue(undefined);
    const openFileSpy = vi.spyOn(useProjectStore.getState(), "openFile").mockResolvedValue(undefined);
    const setFileContentSpy = vi.spyOn(useProjectStore.getState(), "setFileContent");

    const r = await executeTool(tool("write_file", { path: "nuevo.ts", content: "const x = 1;" }));
    expect(r.success).toBe(true);
    expect(mockSaveFileContent).toHaveBeenCalledWith("/proj/nuevo.ts", "const x = 1;");
    expect(setFileContentSpy).toHaveBeenCalledWith("/proj/nuevo.ts", "const x = 1;");
    expect(openFileSpy).toHaveBeenCalledWith("/proj/nuevo.ts");
    openFileSpy.mockRestore();
  });

  it("escribe sobre archivo real existente con snapshot", async () => {
    setRealWorkspace();
    mockReadFileContent.mockResolvedValue("old content");
    mockSaveFileContent.mockResolvedValue(undefined);
    const openFileSpy = vi.spyOn(useProjectStore.getState(), "openFile").mockResolvedValue(undefined);

    await executeTool(tool("write_file", { path: "a.ts", content: "new content" }));
    expect(mockReadFileContent).toHaveBeenCalledWith("/proj/a.ts");

    openFileSpy.mockRestore();
  });

  it("errores → error controlado", async () => {
    setRealWorkspace();
    mockSaveFileContent.mockRejectedValue(new Error("disk full"));
    const r = await executeTool(tool("write_file", { path: "a.ts", content: "x" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("disk full");
  });
});

// ─── apply_diff ────────────────────────────────────────────────

describe("executeTool — apply_diff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshots();
  });

  it("requiere path y search", async () => {
    expect((await executeTool(tool("apply_diff", { search: "a" }))).success).toBe(false);
    expect((await executeTool(tool("apply_diff", { path: "a.ts" }))).success).toBe(false);
  });

  it("archivo virtual no encontrado → error", async () => {
    setVirtualWorkspace({});
    const r = await executeTool(tool("apply_diff", { path: "nope.ts", search: "x", replace: "y" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("no encontrado");
  });

  it("aplica diff con 1 ocurrencia en virtual", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/f.ts`]: "hello world" });
    const r = await executeTool(tool("apply_diff", { path: "f.ts", search: "hello", replace: "hola" }));
    expect(r.success).toBe(true);
    expect(useProjectStore.getState().fileContents[`${VIRTUAL_WS_ID}/f.ts`]).toBe("hola world");
  });

  it("fallback whitespace normalizado (0 ocurrencias exactas)", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/f.ts`]: "const a = 1;\nconst b = 2;\n" });
    const r = await executeTool(tool("apply_diff", {
      path: "f.ts",
      search: "const a = 1;\nconst b = 2;",
      replace: "const a = 10;\nconst b = 20;",
    }));
    expect(r.success).toBe(true);
    expect(useProjectStore.getState().fileContents[`${VIRTUAL_WS_ID}/f.ts`]).toContain("const a = 10;");
  });

  it("0 ocurrencias y sin match normalizado → error", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/f.ts`]: "totally different" });
    const r = await executeTool(tool("apply_diff", { path: "f.ts", search: "zzz", replace: "yyy" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("No se encontró");
  });

  it("múltiples ocurrencias → error por ambigüedad", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/f.ts`]: "aaa bbb aaa" });
    const r = await executeTool(tool("apply_diff", { path: "f.ts", search: "aaa", replace: "zzz" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("coincidencias");
  });

  it("aplica diff en filesystem real y actualiza editor", async () => {
    setRealWorkspace();
    mockReadFileContent.mockResolvedValue("foo bar baz");
    mockSaveFileContent.mockResolvedValue(undefined);
    const openFileSpy = vi.spyOn(useProjectStore.getState(), "openFile").mockResolvedValue(undefined);

    const r = await executeTool(tool("apply_diff", { path: "f.ts", search: "bar", replace: "B" }));
    expect(r.success).toBe(true);
    expect(mockSaveFileContent).toHaveBeenCalledWith("/proj/f.ts", "foo B baz");
    openFileSpy.mockRestore();
  });

  it("errores → error controlado", async () => {
    setRealWorkspace();
    mockReadFileContent.mockRejectedValue(new Error("boom"));
    const r = await executeTool(tool("apply_diff", { path: "f.ts", search: "a", replace: "b" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("boom");
  });
});

// ─── list_files ────────────────────────────────────────────────

describe("executeTool — list_files", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("lista workspace virtual", async () => {
    setVirtualWorkspace({});
    const r = await executeTool(tool("list_files", {}));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("src");
    expect(String(r.result)).toContain("README.md");
  });

  it("trunca listados largos (>3000 chars)", async () => {
    useProjectStore.setState({
      workspaces: [{
        id: VIRTUAL_WS_ID, name: "P", path: VIRTUAL_WS_ID,
        files: Array.from({ length: 150 }, (_, i) => ({
          name: `archivo-muy-largo-con-nombre-extenso-${i}.tsx`, path: `${VIRTUAL_WS_ID}/archivo-${i}.tsx`, type: "file" as const,
        })),
        isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: VIRTUAL_WS_ID,
      fileContents: {},
      openTabs: [], activeTab: null,
    });
    const r = await executeTool(tool("list_files", {}));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("truncado");
  });

  it("workspace virtual no encontrado → error", async () => {
    useProjectStore.setState({ workspaces: [], activeWorkspaceId: "template://ghost", fileContents: {}, openTabs: [], activeTab: null });
    const r = await executeTool(tool("list_files", {}));
    expect(r.success).toBe(false);
    expect(r.error).toContain("Workspace no encontrado");
  });

  it("lista filesystem real (sin subdirectorio)", async () => {
    setRealWorkspace();
    mockLoadProject.mockResolvedValue([
      { name: "node_modules", path: "/proj/node_modules", type: "directory", children: [] },
      { name: "index.ts", path: "/proj/index.ts", type: "file", extension: "ts" },
    ]);
    const r = await executeTool(tool("list_files", {}));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("index.ts");
    expect(String(r.result)).not.toContain("node_modules"); // filtrado
  });

  it("lista filesystem real con subdirectorio", async () => {
    setRealWorkspace();
    mockLoadProject.mockResolvedValue([
      { name: "a.ts", path: "/proj/src/a.ts", type: "file", extension: "ts" },
    ]);
    const r = await executeTool(tool("list_files", { path: "src" }));
    expect(r.success).toBe(true);
    expect(mockLoadProject).toHaveBeenCalledWith("/proj/src");
  });

  it("errores → error controlado", async () => {
    setRealWorkspace();
    mockLoadProject.mockRejectedValue(new Error("nope"));
    const r = await executeTool(tool("list_files", {}));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("nope");
  });
});

// ─── search_code ───────────────────────────────────────────────

describe("executeTool — search_code", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("requiere query", async () => {
    const r = await executeTool(tool("search_code", {}));
    expect(r.success).toBe(false);
    expect(r.error).toContain("query");
  });

  it("workspace no encontrado → error", async () => {
    useProjectStore.setState({ workspaces: [], activeWorkspaceId: "template://ghost", fileContents: {}, openTabs: [], activeTab: null });
    const r = await executeTool(tool("search_code", { query: "foo" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("Workspace no encontrado");
  });

  it("encuentra coincidencias en workspace virtual", async () => {
    setVirtualWorkspace({
      [`${VIRTUAL_WS_ID}/src/App.tsx`]: "const TODO = 'hola';\n// TODO: fix\n",
      [`${VIRTUAL_WS_ID}/README.md`]: "sin match",
    });
    const r = await executeTool(tool("search_code", { query: "TODO" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("App.tsx");
    expect(String(r.result)).toContain("coincidencias");
  });

  it("sin coincidencias → mensaje vacío", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/a.ts`]: "nothing here" });
    const r = await executeTool(tool("search_code", { query: "zzz" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("No se encontraron");
  });

  it("filtra por path relativo", async () => {
    useProjectStore.setState({
      workspaces: [{
        id: VIRTUAL_WS_ID, name: "P", path: VIRTUAL_WS_ID,
        files: [
          { name: "src", path: `${VIRTUAL_WS_ID}/src`, type: "directory", children: [
            { name: "a.ts", path: `${VIRTUAL_WS_ID}/src/a.ts`, type: "file", extension: "ts" },
          ] },
          { name: "other.ts", path: `${VIRTUAL_WS_ID}/other.ts`, type: "file", extension: "ts" },
        ],
        isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: VIRTUAL_WS_ID,
      fileContents: {
        [`${VIRTUAL_WS_ID}/src/a.ts`]: "needle",
        [`${VIRTUAL_WS_ID}/other.ts`]: "needle",
      },
      openTabs: [],
      activeTab: null,
    });
    const r = await executeTool(tool("search_code", { query: "needle", path: "src" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("a.ts");
    expect(String(r.result)).not.toContain("other.ts");
  });

  it("lee archivos del filesystem real", async () => {
    setRealWorkspace();
    useProjectStore.setState({
      workspaces: [{
        id: "/proj", name: "proj", path: "/proj",
        files: [{ name: "x.ts", path: "/proj/x.ts", type: "file", extension: "ts" }],
        isGitRepo: false, gitBranch: null,
      }],
    });
    mockReadFileContent.mockResolvedValue("match here\n");
    const r = await executeTool(tool("search_code", { query: "match" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("x.ts");
  });

  it("errores → error controlado", async () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/proj", name: "proj", path: "/proj",
        files: undefined as never,
        isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: "/proj",
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });
    const r = await executeTool(tool("search_code", { query: "x", path: "src" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("Error buscando");
  });
});

// ─── delete_file ───────────────────────────────────────────────

describe("executeTool — delete_file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshots();
  });

  it("requiere path", async () => {
    const r = await executeTool(tool("delete_file", {}));
    expect(r.success).toBe(false);
    expect(r.error).toContain("path");
  });

  it("elimina archivo virtual (con snapshot)", async () => {
    setVirtualWorkspace({ [`${VIRTUAL_WS_ID}/borrar.ts`]: "content" });
    const r = await executeTool(tool("delete_file", { path: "borrar.ts" }));
    expect(r.success).toBe(true);
    expect(useProjectStore.getState().fileContents[`${VIRTUAL_WS_ID}/borrar.ts`]).toBeUndefined();
  });

  it("elimina en filesystem real + cierra tab", async () => {
    setRealWorkspace();
    mockReadFileContent.mockResolvedValue("x");
    mockDeleteEntry.mockResolvedValue(undefined);
    const closeTabSpy = vi.spyOn(useProjectStore.getState(), "closeTab");
    useProjectStore.setState({ openTabs: ["/proj/a.ts"], activeTab: "/proj/a.ts" });

    const r = await executeTool(tool("delete_file", { path: "a.ts" }));
    expect(r.success).toBe(true);
    expect(mockDeleteEntry).toHaveBeenCalledWith("/proj/a.ts");
    expect(closeTabSpy).toHaveBeenCalledWith("/proj/a.ts");
  });

  it("errores → error controlado", async () => {
    setRealWorkspace();
    mockDeleteEntry.mockRejectedValue(new Error("denied"));
    const r = await executeTool(tool("delete_file", { path: "a.ts" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("denied");
  });
});

// ─── preview / refresh ─────────────────────────────────────────

describe("executeTool — preview_component & refresh_preview", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("preview_component requiere component", async () => {
    const r = await executeTool(tool("preview_component", {}));
    expect(r.success).toBe(false);
  });

  it("preview_component aísla componente", async () => {
    const r = await executeTool(tool("preview_component", { component: "Card" }));
    expect(r.success).toBe(true);
    expect(mockSetPreviewTarget).toHaveBeenCalledWith("Card");
    expect(mockSetVibeLensEnabled).toHaveBeenCalledWith(true);
  });

  it("preview_component con props", async () => {
    const r = await executeTool(tool("preview_component", { component: "Card", props: '{title:"x"}' }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("props");
  });

  it("preview_component errores → error controlado", async () => {
    mockSetPreviewTarget.mockImplementation(() => { throw new Error("ui boom"); });
    const r = await executeTool(tool("preview_component", { component: "Card" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("ui boom");
  });

  it("refresh_preview montado → success", async () => {
    mockTriggerPreviewRefresh.mockReturnValue(true);
    const r = await executeTool(tool("refresh_preview", {}));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("actualizado");
  });

  it("refresh_preview no montado", async () => {
    mockTriggerPreviewRefresh.mockReturnValue(false);
    const r = await executeTool(tool("refresh_preview", {}));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("no montado");
  });

  it("refresh_preview errores → error controlado", async () => {
    mockTriggerPreviewRefresh.mockImplementation(() => { throw new Error("preview boom"); });
    const r = await executeTool(tool("refresh_preview", {}));
    expect(r.success).toBe(false);
  });
});

// ─── OSINT tools ───────────────────────────────────────────────

describe("executeTool — docs_search / docs_fetch / code_search / cve_check / synthesis", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("docs_search requiere query", async () => {
    expect((await executeTool(tool("docs_search", {}))).success).toBe(false);
  });

  it("docs_search sin resultados", async () => {
    mockSearchDocs.mockResolvedValue([]);
    const r = await executeTool(tool("docs_search", { query: "nothing" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("No se encontraron");
  });

  it("docs_search con resultados", async () => {
    mockSearchDocs.mockResolvedValue([{ title: "React", url: "https://react.dev", snippet: "x" }]);
    const r = await executeTool(tool("docs_search", { query: "react", limit: 3 }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("React");
    expect(mockSearchDocs).toHaveBeenCalledWith("react", 3);
  });

  it("docs_search errores → error controlado", async () => {
    mockSearchDocs.mockRejectedValue(new Error("net"));
    const r = await executeTool(tool("docs_search", { query: "x" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("net");
  });

  it("docs_fetch requiere url", async () => {
    expect((await executeTool(tool("docs_fetch", {}))).success).toBe(false);
  });

  it("docs_fetch con contenido", async () => {
    mockFetchDoc.mockResolvedValue({ title: "Docs", content: "contenido", byteCount: 10, warnings: ["a"] });
    const r = await executeTool(tool("docs_fetch", { url: "https://react.dev" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("contenido");
    expect(String(r.result)).toContain("Avisos: a");
  });

  it("docs_fetch sin contenido legible", async () => {
    mockFetchDoc.mockResolvedValue({ title: "", content: "   ", byteCount: 0 });
    const r = await executeTool(tool("docs_fetch", { url: "https://x.dev" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("no devolvió contenido");
  });

  it("docs_fetch errores → error controlado", async () => {
    mockFetchDoc.mockRejectedValue(new Error("404"));
    const r = await executeTool(tool("docs_fetch", { url: "https://x.dev" }));
    expect(r.success).toBe(false);
  });

  it("code_search requiere query", async () => {
    expect((await executeTool(tool("code_search", {}))).success).toBe(false);
  });

  it("code_search sin resultados", async () => {
    mockSearchCode.mockResolvedValue([]);
    const r = await executeTool(tool("code_search", { query: "zzz" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("No se encontraron");
  });

  it("code_search con resultados", async () => {
    mockSearchCode.mockResolvedValue([{ name: "lodash", url: "https://npmjs.com/lodash", description: "lib" }]);
    const r = await executeTool(tool("code_search", { query: "lodash" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("lodash");
  });

  it("code_search errores → error controlado", async () => {
    mockSearchCode.mockRejectedValue(new Error("gh down"));
    const r = await executeTool(tool("code_search", { query: "x" }));
    expect(r.success).toBe(false);
  });

  it("cve_check requiere package", async () => {
    expect((await executeTool(tool("cve_check", {}))).success).toBe(false);
  });

  it("cve_check sin vulnerabilidades", async () => {
    mockCheckCve.mockResolvedValue([]);
    const r = await executeTool(tool("cve_check", { package: "lodash" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("No se encontraron vulnerabilidades");
  });

  it("cve_check con vulnerabilidades", async () => {
    mockCheckCve.mockResolvedValue([{ id: "CVE-2024-1", severity: "HIGH" }]);
    const r = await executeTool(tool("cve_check", { package: "lodash" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("CVE-2024-1");
  });

  it("cve_check errores → error controlado", async () => {
    mockCheckCve.mockRejectedValue(new Error("osv down"));
    const r = await executeTool(tool("cve_check", { package: "x" }));
    expect(r.success).toBe(false);
  });

  it("synthesis requiere topic y decision", async () => {
    expect((await executeTool(tool("synthesis", { decision: "x" }))).success).toBe(false);
    expect((await executeTool(tool("synthesis", { topic: "x" }))).success).toBe(false);
  });

  it("synthesis exitosa", async () => {
    const r = await executeTool(tool("synthesis", { topic: "Auth", decision: "Usar OCAIS" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("Auth");
  });
});

// ─── execute_command ───────────────────────────────────────────

describe("executeTool — execute_command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRealWorkspace();
  });

  it("requiere command", async () => {
    const r = await executeTool(tool("execute_command", {}));
    expect(r.success).toBe(false);
    expect(r.error).toContain("command");
  });

  it("solo disponible en desktop", async () => {
    mockIsTauri.mockReturnValue(false);
    const r = await executeTool(tool("execute_command", { command: "ls" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("escritorio");
  });

  it("bloquea comandos peligrosos", async () => {
    mockIsTauri.mockReturnValue(true);
    const r = await executeTool(tool("execute_command", { command: "shutdown /s" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("bloqueado");
  });

  it("sin proyecto abierto → error", async () => {
    mockIsTauri.mockReturnValue(true);
    useProjectStore.setState({ activeWorkspaceId: null });
    const r = await executeTool(tool("execute_command", { command: "ls" }));
    expect(r.success).toBe(false);
    expect(r.error).toContain("proyecto abierto");
  });

  it("cwd que escapa del proyecto → error", async () => {
    mockIsTauri.mockReturnValue(true);
    const r = await executeTool(tool("execute_command", { command: "ls", cwd: "../../etc" }));
    expect(r.success).toBe(false);
  });

  it("ejecuta con éxito", async () => {
    mockIsTauri.mockReturnValue(true);
    mockExecShell.mockResolvedValue({ stdout: "out", stderr: "", exit_code: 0 });
    const r = await executeTool(tool("execute_command", { command: "npm test" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("out");
    expect(mockExecShell).toHaveBeenCalled();
  });

  it("formatea stderr y exit code != 0", async () => {
    mockIsTauri.mockReturnValue(true);
    mockExecShell.mockResolvedValue({ stdout: "o", stderr: "e", exit_code: 2 });
    const r = await executeTool(tool("execute_command", { command: "npm test" }));
    expect(r.success).toBe(false);
    expect(String(r.result)).toContain("[stderr]");
    expect(String(r.result)).toContain("[exit code: 2]");
  });

  it("trunca salida larga", async () => {
    mockIsTauri.mockReturnValue(true);
    mockExecShell.mockResolvedValue({ stdout: "x".repeat(6000), stderr: "", exit_code: 0 });
    const r = await executeTool(tool("execute_command", { command: "npm test" }));
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain("omitidos");
  });

  it("errores → error controlado", async () => {
    mockIsTauri.mockReturnValue(true);
    mockExecShell.mockRejectedValue(new Error("shell exploded"));
    const r = await executeTool(tool("execute_command", { command: "ls" }));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("shell exploded");
  });
});

// ─── executeTool dispatch ──────────────────────────────────────

describe("executeTool — dispatch", () => {
  it("tool desconocida → error", async () => {
    const r = await executeTool(tool("no_existe", {}));
    expect(r.success).toBe(false);
    expect(String(r.error)).toContain("Herramienta desconocida");
  });

  it("captura errores internos", async () => {
    const r = await executeTool(tool("synthesis", { topic: 42 as unknown as string }));
    expect(r).toBeDefined();
  });
});

// ─── getProjectSummary ─────────────────────────────────────────

describe("getProjectSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshots();
  });

  it("null sin workspace activo", () => {
    useProjectStore.setState({ workspaces: [], activeWorkspaceId: null });
    expect(getProjectSummary()).toBeNull();
  });

  it("null si workspace sin archivos", () => {
    useProjectStore.setState({
      workspaces: [{
        id: "template://t", name: "t", path: "template://t", files: [], isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: "template://t",
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });
    expect(getProjectSummary()).toBeNull();
  });

  it("resume estructura con archivo activo corto", () => {
    setVirtualWorkspace({
      [`${VIRTUAL_WS_ID}/src/App.tsx`]: "const a = 1;",
    });
    useProjectStore.setState({ activeTab: `${VIRTUAL_WS_ID}/src/App.tsx` });
    const summary = getProjectSummary();
    expect(summary).toContain("Portfolio");
    expect(summary).toContain("Archivo activo en el editor");
  });

  it("resume archivo activo grande sin incluir contenido", () => {
    setVirtualWorkspace({});
    useProjectStore.setState({
      activeTab: `${VIRTUAL_WS_ID}/README.md`,
      fileContents: { [`${VIRTUAL_WS_ID}/README.md`]: Array.from({ length: 400 }, (_, i) => `l${i}`).join("\n") },
    });
    const summary = getProjectSummary();
    expect(summary).toContain("Archivo activo");
    expect(summary).not.toContain("Archivo activo en el editor");
  });

  it("trunca árbol >2000 chars", () => {
    useProjectStore.setState({
      workspaces: [{
        id: VIRTUAL_WS_ID, name: "Largo", path: VIRTUAL_WS_ID,
        files: Array.from({ length: 200 }, (_, i) => ({
          name: `un-archivo-con-nombre-muy-largo-${i}.tsx`, path: `${VIRTUAL_WS_ID}/f${i}.tsx`, type: "file" as const,
        })),
        isGitRepo: false, gitBranch: null,
      }],
      activeWorkspaceId: VIRTUAL_WS_ID,
      fileContents: {},
      openTabs: [],
      activeTab: null,
    });
    const summary = getProjectSummary();
    expect(summary).toContain("árbol truncado");
  });
});

afterEach(() => {
  clearSnapshots();
  vi.restoreAllMocks();
});
