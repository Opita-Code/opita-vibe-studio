import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readFile,
  writeFile,
  listDir,
  createDir,
  deleteEntry,
  renameEntry,
  execShell,
  openFolderDialog,
  validateProject,
} from "../../src/lib/ipc";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  invoke.mockReset();
});

describe("ipc wrappers", () => {
  it("should read a file via invoke", async () => {
    invoke.mockResolvedValueOnce("content");
    await expect(readFile("/a.txt")).resolves.toBe("content");
    expect(invoke).toHaveBeenCalledWith("read_file", { path: "/a.txt" });
  });

  it("should write a file via invoke", async () => {
    invoke.mockResolvedValueOnce(undefined);
    await writeFile("/a.txt", "data");
    expect(invoke).toHaveBeenCalledWith("write_file", { path: "/a.txt", content: "data" });
  });

  it("should list a directory via invoke", async () => {
    invoke.mockResolvedValueOnce([]);
    await expect(listDir("/dir")).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith("list_dir", { path: "/dir" });
  });

  it("should create a directory via invoke", async () => {
    await createDir("/dir");
    expect(invoke).toHaveBeenCalledWith("create_dir", { path: "/dir" });
  });

  it("should delete an entry via invoke", async () => {
    await deleteEntry("/a.txt");
    expect(invoke).toHaveBeenCalledWith("delete_entry", { path: "/a.txt" });
  });

  it("should rename an entry via invoke", async () => {
    await renameEntry("/a.txt", "/b.txt");
    expect(invoke).toHaveBeenCalledWith("rename_entry", { oldPath: "/a.txt", newPath: "/b.txt" });
  });

  it("should exec a shell command via invoke", async () => {
    invoke.mockResolvedValueOnce({ stdout: "ok", stderr: "", exit_code: 0 });
    await expect(execShell("ls", "/cwd")).resolves.toEqual({ stdout: "ok", stderr: "", exit_code: 0 });
    expect(invoke).toHaveBeenCalledWith("exec_shell", { cmd: "ls", cwd: "/cwd" });
  });

  it("should open the folder dialog via invoke", async () => {
    invoke.mockResolvedValueOnce("/selected");
    await expect(openFolderDialog()).resolves.toBe("/selected");
    expect(invoke).toHaveBeenCalledWith("open_folder_dialog");
  });

  it("should validate a project via invoke", async () => {
    invoke.mockResolvedValueOnce({ is_valid: true, name: "n", file_count: 3, has_config: true });
    await expect(validateProject("/proj")).resolves.toEqual({ is_valid: true, name: "n", file_count: 3, has_config: true });
    expect(invoke).toHaveBeenCalledWith("validate_project", { path: "/proj" });
  });
});
