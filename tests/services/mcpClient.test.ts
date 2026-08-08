import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleMcpToolRequest } from "@/services/mcpClient";

// ─── Mocks ───────────────────────────────────────────────────────

let mockWorkspaceId: string | null = "/proj";
vi.mock("@/stores/project", () => ({
  useProjectStore: {
    getState: () => ({ activeWorkspaceId: mockWorkspaceId }),
  },
}));

const readFileMock = vi.fn(async () => "file contents");
const writeFileMock = vi.fn(async () => {});
const listDirMock = vi.fn(async () => [{ name: "a.ts", path: "/proj/a.ts", type: "file" }]);
const execShellMock = vi.fn(async () => ({ stdout: "ok", stderr: "" }));
vi.mock("@/lib/ipc", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  listDir: listDirMock,
  execShell: execShellMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function okResponse() {
  return { ok: true, status: 200 };
}

function setTauri(on: boolean) {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI__ = {};
  else delete w.__TAURI__;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(okResponse());
  mockWorkspaceId = "/proj";
  setTauri(false);
});

afterEach(() => {
  setTauri(false);
});

describe("handleMcpToolRequest", () => {
  it("should send an error when no project is opened", async () => {
    mockWorkspaceId = null;

    await handleMcpToolRequest("read_local_file", { path: "a.ts" }, "token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opitacode.com/chat/mcp",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"error":"No project opened"'),
      }),
    );
  });

  it("should refuse to run tools in browser mode (no Tauri)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await handleMcpToolRequest("read_local_file", { path: "a.ts" }, "token");

    expect(warnSpy).toHaveBeenCalled();
    expect(readFileMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("Tauri IPC not available"),
      }),
    );
    warnSpy.mockRestore();
  });

  it("should read a file and send the result", async () => {
    setTauri(true);
    readFileMock.mockResolvedValueOnce("contenido");

    await handleMcpToolRequest("read_local_file", { path: "src/a.ts" }, "token");

    expect(readFileMock).toHaveBeenCalledWith("/proj/src/a.ts");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"success":true'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"result":"contenido"'),
      }),
    );
  });

  it("should write a file and send a confirmation", async () => {
    setTauri(true);

    await handleMcpToolRequest("write_local_file", { path: "src/b.ts", content: "code" }, "token");

    expect(writeFileMock).toHaveBeenCalledWith("/proj/src/b.ts", "code");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("Archivo escrito exitosamente."),
      }),
    );
  });

  it("should list a directory and send the entries", async () => {
    setTauri(true);
    listDirMock.mockResolvedValueOnce([{ name: "x.ts", path: "/proj/x.ts", type: "file" }]);

    await handleMcpToolRequest("list_local_dir", { path: "src" }, "token");

    expect(listDirMock).toHaveBeenCalledWith("/proj/src");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"name":"x.ts"'),
      }),
    );
  });

  it("should run allowed test commands", async () => {
    setTauri(true);

    await handleMcpToolRequest("execute_test_command", { command: "npx vitest run" }, "token");

    expect(execShellMock).toHaveBeenCalledWith("npx vitest run", "/proj");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"success":true'),
      }),
    );
  });

  it("should block disallowed shell commands", async () => {
    setTauri(true);

    await handleMcpToolRequest("execute_test_command", { command: "rm -rf /" }, "token");

    expect(execShellMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("bloqueado por seguridad"),
      }),
    );
  });

  it("should send an error for unknown tools", async () => {
    setTauri(true);

    await handleMcpToolRequest("hack_everything", {}, "token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("Tool no reconocida"),
      }),
    );
  });

  it("should block path traversal segments", async () => {
    setTauri(true);

    await handleMcpToolRequest("read_local_file", { path: "../../etc/passwd" }, "token");

    expect(readFileMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("path traversal"),
      }),
    );
  });

  it("should block absolute paths", async () => {
    setTauri(true);

    await handleMcpToolRequest("read_local_file", { path: "C:/Users/me/secrets.txt" }, "token");

    expect(readFileMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("Absolute paths are forbidden"),
      }),
    );
  });

  it("should send failures when the IPC command throws", async () => {
    setTauri(true);
    readFileMock.mockRejectedValueOnce(new Error("permission denied"));

    await handleMcpToolRequest("read_local_file", { path: "src/a.ts" }, "token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"success":false'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("permission denied"),
      }),
    );
  });

  it("should not throw when the result POST fails", async () => {
    setTauri(true);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleMcpToolRequest("read_local_file", { path: "a.ts" }, "token"),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
