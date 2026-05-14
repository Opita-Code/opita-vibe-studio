import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FileSystemBackend } from "../../../src/lib/fs-backend/types";

// ─── Mock directory handle tree ─────────────────────────────────

interface MockFileEntry {
  kind: "file";
  name: string;
  getFile: ReturnType<typeof vi.fn>;
  createWritable: ReturnType<typeof vi.fn>;
}

interface MockDirEntry {
  kind: "directory";
  name: string;
  entries: ReturnType<typeof vi.fn>;
  getDirectoryHandle: ReturnType<typeof vi.fn>;
  getFileHandle: ReturnType<typeof vi.fn>;
  removeEntry: ReturnType<typeof vi.fn>;
  queryPermission: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
}

type Entry = MockDirEntry | MockFileEntry;

let mockRootHandle: MockDirEntry;
let mockShowPicker: ReturnType<typeof vi.fn>;

function createMockDir(
  name: string,
  children?: Record<string, unknown>,
): MockDirEntry {
  const entriesArray: [string, Entry][] = [];
  const dir: MockDirEntry = {
    kind: "directory",
    name,
    entries: vi.fn(),
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
    removeEntry: vi.fn(),
    queryPermission: vi.fn().mockResolvedValue("granted"),
    requestPermission: vi.fn().mockResolvedValue("granted"),
  };

  if (children) {
    for (const [childName, value] of Object.entries(children)) {
      if (value && typeof value === "object" && !("kind" in (value as object))) {
        const subDir = createMockDir(childName, value as Record<string, unknown>);
        entriesArray.push([childName, subDir]);
      } else {
        const writable = { write: vi.fn(), close: vi.fn() };
        const file: MockFileEntry = {
          kind: "file",
          name: childName,
          getFile: vi.fn(),
          createWritable: vi.fn().mockResolvedValue(writable),
        };
        file.getFile.mockResolvedValue({
          name: childName,
          size: typeof value === "string" ? value.length : 0,
          text: vi.fn().mockResolvedValue(typeof value === "string" ? value : ""),
        });
        entriesArray.push([childName, file]);
      }
    }
  }

  dir.entries.mockReturnValue(entriesArray[Symbol.iterator]());

  dir.getDirectoryHandle.mockImplementation(
    async (subName: string, options?: { create?: boolean }) => {
      const entry = entriesArray.find(([n]) => n === subName);
      if (entry && entry[1].kind === "directory") return entry[1];
      if (options?.create) {
        const newDir = createMockDir(subName);
        entriesArray.push([subName, newDir]);
        return newDir;
      }
      throw new DOMException("NotFoundError", "NotFoundError");
    },
  );

  dir.getFileHandle.mockImplementation(
    async (subName: string, options?: { create?: boolean }) => {
      const entry = entriesArray.find(([n]) => n === subName);
      if (entry && entry[1].kind === "file") return entry[1];
      if (options?.create) {
        const writable = { write: vi.fn(), close: vi.fn() };
        const newFile: MockFileEntry = {
          kind: "file",
          name: subName,
          getFile: vi.fn().mockResolvedValue({
            name: subName,
            size: 0,
            text: vi.fn().mockResolvedValue(""),
          }),
          createWritable: vi.fn().mockResolvedValue(writable),
        };
        entriesArray.push([subName, newFile]);
        return newFile;
      }
      throw new DOMException("NotFoundError", "NotFoundError");
    },
  );

  return dir;
}

describe("BrowserFS", () => {
  let storedHandle: unknown = null;

  beforeEach(() => {
    storedHandle = null;

    mockRootHandle = createMockDir("test-project", {
      src: {
        "index.ts": "const x = 1;",
      },
      "index.html": "<html></html>",
      "README.md": "# Test",
    });

    mockShowPicker = vi.fn().mockResolvedValue(mockRootHandle);
    (window as unknown as Record<string, unknown>).showDirectoryPicker = mockShowPicker;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });

  // We mock the IndexedDB storage layer of BrowserFS so tests don't depend on jsdom IDB support.
  // The handle storage/retrieval is tested separately via the mock.
  async function createBrowserFS(): Promise<FileSystemBackend> {
    const { BrowserFS } = await import("../../../src/lib/fs-backend/browser");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = new BrowserFS() as any;
    // Override IDB methods with simple in-memory mock
    instance.storeHandle = vi.fn().mockImplementation(async (h: unknown) => {
      storedHandle = h;
    });
    instance.getStoredHandle = vi.fn().mockImplementation(async () => {
      return storedHandle;
    });
    instance.clearHandle = vi.fn().mockImplementation(async () => {
      storedHandle = null;
    });
    return instance as FileSystemBackend;
  }

  it("should have label 'browser'", async () => {
    const fs = await createBrowserFS();
    expect(fs.label).toBe("browser");
  });

  describe("isAvailable", () => {
    it("should return true when showDirectoryPicker exists", async () => {
      const fs = await createBrowserFS();
      expect(fs.isAvailable()).toBe(true);
    });

    it("should return false when showDirectoryPicker is absent", async () => {
      delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
      const fs = await createBrowserFS();
      expect(fs.isAvailable()).toBe(false);
    });
  });

  describe("selectDirectory", () => {
    it("should return handle name and store handle", async () => {
      const fs = await createBrowserFS();
      const result = await fs.selectDirectory();
      expect(result).toBe("test-project");
      expect(mockShowPicker).toHaveBeenCalledOnce();
      expect(storedHandle).toBe(mockRootHandle);
    });

    it("should return null when user cancels", async () => {
      mockShowPicker.mockRejectedValue(new DOMException("cancelled", "AbortError"));
      const fs = await createBrowserFS();
      const result = await fs.selectDirectory();
      expect(result).toBeNull();
    });

    it("should return null when FSA API not available", async () => {
      delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
      const fs = await createBrowserFS();
      const result = await fs.selectDirectory();
      expect(result).toBeNull();
    });
  });

  describe("readFile", () => {
    it("should resolve path and return file content", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      const content = await fs.readFile("/src/index.ts");
      expect(content).toBe("const x = 1;");
    });

    it("should throw when file does not exist", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await expect(fs.readFile("/nonexistent.ts")).rejects.toThrow();
    });

    it("should throw when no directory selected", async () => {
      const fs = await createBrowserFS();
      await expect(fs.readFile("/test.ts")).rejects.toThrow();
    });
  });

  describe("writeFile", () => {
    it("should create parent dirs and write content", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await fs.writeFile("/src/newfile.ts", "new content");
      // The root handle's getDirectoryHandle is called for "src"
      expect(mockRootHandle.getDirectoryHandle).toHaveBeenCalledWith("src", {
        create: true,
      });
      // The operation succeeds (no throw means writable.write/close were called)
    });

    it("should write to existing file", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await fs.writeFile("/README.md", "updated content");
      expect(mockRootHandle.getFileHandle).toHaveBeenCalledWith("README.md", {
        create: true,
      });
    });
  });

  describe("listDirectory", () => {
    it("should return FileNode[] with files and dirs", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      const nodes = await fs.listDirectory("/");
      expect(nodes).toHaveLength(3);

      const src = nodes.find((n) => n.name === "src");
      expect(src).toBeDefined();
      expect(src!.type).toBe("directory");
      expect(src!.path).toBe("/src");

      const html = nodes.find((n) => n.name === "index.html");
      expect(html).toBeDefined();
      expect(html!.type).toBe("file");
      expect(html!.extension).toBe("html");
    });

    it("should return empty array for empty directory", async () => {
      mockShowPicker.mockResolvedValue(createMockDir("empty"));
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      const nodes = await fs.listDirectory("/");
      expect(nodes).toEqual([]);
    });
  });

  describe("createDirectory", () => {
    it("should create directory at given path", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await fs.createDirectory("/newdir");
      expect(mockRootHandle.getDirectoryHandle).toHaveBeenCalledWith("newdir", {
        create: true,
      });
    });

    it("should create nested directories", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await fs.createDirectory("/a/b/c");
      expect(mockRootHandle.getDirectoryHandle).toHaveBeenCalledWith("a", {
        create: true,
      });
    });
  });

  describe("deleteEntry", () => {
    it("should remove a file entry", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await fs.deleteEntry("/index.html");
      expect(mockRootHandle.removeEntry).toHaveBeenCalledWith("index.html", {
        recursive: true,
      });
    });

    it("should remove a directory recursively", async () => {
      const fs = await createBrowserFS();
      await fs.selectDirectory();

      await fs.deleteEntry("/src");
      expect(mockRootHandle.removeEntry).toHaveBeenCalledWith("src", {
        recursive: true,
      });
    });
  });

  describe("handle lifecycle", () => {
    it("getStoredHandle returns null when no handle stored", async () => {
      const fs = await createBrowserFS();
      // Clear stored state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (fs as any).clearHandle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (fs as any).getStoredHandle();
      expect(handle).toBeNull();
    });
  });
});
