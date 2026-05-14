import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FileNode } from "../../../src/lib/types";

// ─── Mock ipc.ts (Tauri IPC module) ─────────────────────────────

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockListDir = vi.fn();
const mockCreateDir = vi.fn();
const mockDeleteEntry = vi.fn();
const mockOpenFolderDialog = vi.fn();

vi.mock("../../../src/lib/ipc", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  listDir: mockListDir,
  createDir: mockCreateDir,
  deleteEntry: mockDeleteEntry,
  openFolderDialog: mockOpenFolderDialog,
}));

describe("TauriFS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have label 'tauri'", async () => {
    const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
    const fs = new TauriFS();
    expect(fs.label).toBe("tauri");
  });

  it("isAvailable should return true", async () => {
    const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
    const fs = new TauriFS();
    expect(fs.isAvailable()).toBe(true);
  });

  describe("readFile", () => {
    it("should delegate to ipc readFile and return content", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      mockReadFile.mockResolvedValue("file content");
      const fs = new TauriFS();
      const result = await fs.readFile("/test/file.ts");
      expect(result).toBe("file content");
      expect(mockReadFile).toHaveBeenCalledWith("/test/file.ts");
    });
  });

  describe("writeFile", () => {
    it("should delegate to ipc writeFile", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      const fs = new TauriFS();
      await fs.writeFile("/test/file.ts", "new content");
      expect(mockWriteFile).toHaveBeenCalledWith("/test/file.ts", "new content");
    });
  });

  describe("listDirectory", () => {
    it("should delegate to ipc listDir and convert FileEntry to FileNode", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      mockListDir.mockResolvedValue([
        { name: "src", path: "/test/src", is_dir: true, size: 0, modified_at: 1000000 },
        { name: "index.html", path: "/test/index.html", is_dir: false, size: 100, modified_at: 1000000 },
      ]);

      const fs = new TauriFS();
      const result: FileNode[] = await fs.listDirectory("/test");

      expect(mockListDir).toHaveBeenCalledWith("/test");
      expect(result).toHaveLength(2);

      // Order matches IPC return (sorted as domain logic in fs.ts, not in backend)
      expect(result[0].name).toBe("src");
      expect(result[0].path).toBe("/test/src");
      expect(result[0].type).toBe("directory");
      expect(result[0].size).toBe(0);
      expect(result[0].modifiedAt).toBe("1970-01-12T13:46:40.000Z");
      expect(result[0].extension).toBeUndefined();

      expect(result[1].name).toBe("index.html");
      expect(result[1].path).toBe("/test/index.html");
      expect(result[1].type).toBe("file");
      expect(result[1].size).toBe(100);
      expect(result[1].modifiedAt).toBe("1970-01-12T13:46:40.000Z");
      expect(result[1].extension).toBe("html");
    });

    it("should return empty array when directory is empty", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      mockListDir.mockResolvedValue([]);

      const fs = new TauriFS();
      const result = await fs.listDirectory("/empty");

      expect(result).toEqual([]);
      expect(mockListDir).toHaveBeenCalledWith("/empty");
    });
  });

  describe("createDirectory", () => {
    it("should delegate to ipc createDir", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      const fs = new TauriFS();
      await fs.createDirectory("/test/newdir");
      expect(mockCreateDir).toHaveBeenCalledWith("/test/newdir");
    });
  });

  describe("deleteEntry", () => {
    it("should delegate to ipc deleteEntry", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      const fs = new TauriFS();
      await fs.deleteEntry("/test/file.ts");
      expect(mockDeleteEntry).toHaveBeenCalledWith("/test/file.ts");
    });
  });

  describe("selectDirectory", () => {
    it("should delegate to ipc openFolderDialog", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      mockOpenFolderDialog.mockResolvedValue("/selected/path");
      const fs = new TauriFS();
      const result = await fs.selectDirectory();
      expect(result).toBe("/selected/path");
      expect(mockOpenFolderDialog).toHaveBeenCalled();
    });

    it("should return null when user cancels folder dialog", async () => {
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");
      mockOpenFolderDialog.mockResolvedValue(null);
      const fs = new TauriFS();
      const result = await fs.selectDirectory();
      expect(result).toBeNull();
      expect(mockOpenFolderDialog).toHaveBeenCalled();
    });
  });
});
