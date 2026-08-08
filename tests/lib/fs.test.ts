import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectLanguage } from "../../src/lib/language";

import { setFileSystemBackend } from "../../src/lib/fs-backend/factory";

// Mock backend functions
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockListDir = vi.fn();
const mockCreateDir = vi.fn();
const mockDeleteEntry = vi.fn();
const mockRename = vi.fn();
const mockExecShell = vi.fn();

describe("fs helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFileSystemBackend({
      isAvailable: () => true,
      readFile: mockReadFile,
      writeFile: mockWriteFile,
      listDirectory: mockListDir,
      createDirectory: mockCreateDir,
      deleteEntry: mockDeleteEntry,
      renameEntry: mockRename,
      execShell: mockExecShell,
      selectDirectory: vi.fn(),
      openInExternalTerminal: vi.fn(),
      startWatcher: vi.fn(),
      stopWatcher: vi.fn(),
      onFileChange: vi.fn(),
    } as any);
  });

  it("should detect language from file extension", () => {
    expect(detectLanguage("index.html")).toBe("html");
    expect(detectLanguage("styles.css")).toBe("css");
    expect(detectLanguage("app.js")).toBe("javascript");
    expect(detectLanguage("app.ts")).toBe("typescript");
    expect(detectLanguage("app.tsx")).toBe("typescriptreact");
    expect(detectLanguage("data.json")).toBe("json");
    expect(detectLanguage("readme.md")).toBe("markdown");
    expect(detectLanguage("script.py")).toBe("python");
    expect(detectLanguage("main.rs")).toBe("rust");
    expect(detectLanguage("unknown.xyz")).toBe("plaintext");
  });

  it("should load project recursively with directories first", async () => {
    const { loadProject } = await import("../../src/lib/fs");

    // First call: root with src dir + index.html
    mockListDir.mockResolvedValueOnce([
      { name: "src", path: "/test/src", type: "directory" },
      { name: "index.html", path: "/test/index.html", type: "file", extension: "html" },
    ]);
    // Second call: src directory (empty)
    mockListDir.mockResolvedValueOnce([]);

    const result = await loadProject("/test");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("src"); // directories first
    expect(result[0].type).toBe("directory");
    expect(result[1].name).toBe("index.html");
    expect(result[1].type).toBe("file");
    expect(result[1].extension).toBe("html");
    expect(mockListDir).toHaveBeenCalledTimes(2);
  });

  it("isGitRepo should return true if .git directory exists", async () => {
    const { isGitRepo } = await import("../../src/lib/fs");

    mockListDir.mockResolvedValue([
      { name: ".git", path: "/test/.git", type: "directory" },
    ]);

    const result = await isGitRepo("/test");
    expect(result).toBe(true);
  });

  it("isGitRepo should return false if no .git directory", async () => {
    const { isGitRepo } = await import("../../src/lib/fs");

    mockListDir.mockResolvedValue([
      { name: "index.html", path: "/test/index.html", type: "file" },
    ]);

    const result = await isGitRepo("/test");
    expect(result).toBe(false);
  });

  it("readFileContent should delegate to IPC readFile", async () => {
    const { readFileContent } = await import("../../src/lib/fs");

    mockReadFile.mockResolvedValue("file content");

    const result = await readFileContent("/test/file.ts");
    expect(result).toBe("file content");
    expect(mockReadFile).toHaveBeenCalledWith("/test/file.ts");
  });

  it("saveFileContent should delegate to IPC writeFile", async () => {
    const { saveFileContent } = await import("../../src/lib/fs");

    await saveFileContent("/test/file.ts", "new content");
    expect(mockWriteFile).toHaveBeenCalledWith("/test/file.ts", "new content");
  });

  it("createFileItem should write an empty file", async () => {
    const { createFileItem } = await import("../../src/lib/fs");
    await createFileItem("/test/new.ts");
    expect(mockWriteFile).toHaveBeenCalledWith("/test/new.ts", "");
  });

  it("createDir should delegate to backend createDirectory", async () => {
    const { createDir } = await import("../../src/lib/fs");
    await createDir("/test/newdir");
    expect(mockCreateDir).toHaveBeenCalledWith("/test/newdir");
  });

  it("deleteEntry should delegate to backend deleteEntry", async () => {
    const { deleteEntry } = await import("../../src/lib/fs");
    await deleteEntry("/test/file.ts");
    expect(mockDeleteEntry).toHaveBeenCalledWith("/test/file.ts");
  });

  it("renameEntry should delegate to backend renameEntry", async () => {
    const { renameEntry } = await import("../../src/lib/fs");
    mockRename.mockResolvedValue(undefined);
    await renameEntry("/test/a.ts", "/test/b.ts");
    expect(mockRename).toHaveBeenCalledWith("/test/a.ts", "/test/b.ts");
  });

  it("loadProject should treat unreadable directories as empty", async () => {
    const { loadProject } = await import("../../src/lib/fs");

    mockListDir
      .mockResolvedValueOnce([
        { name: "secret", path: "/test/secret", type: "directory" },
      ])
      .mockRejectedValueOnce(new Error("permission denied"));

    const result = await loadProject("/test");
    expect(result[0].type).toBe("directory");
    expect(result[0].children).toEqual([]);
  });

  it("isGitRepo should return false when listing fails", async () => {
    const { isGitRepo } = await import("../../src/lib/fs");
    mockListDir.mockRejectedValue(new Error("boom"));
    await expect(isGitRepo("/test")).resolves.toBe(false);
  });
});
