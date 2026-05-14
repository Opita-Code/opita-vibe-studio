import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";
import { MockFileSystemBackend } from "./fs-backend/MockFileSystemBackend";
import type { FileNode } from "../../src/lib/types";
import type { FileSystemBackend } from "../../src/lib/fs-backend/types";

// ─── Mock ipc.ts to prevent Tauri import errors ─────
vi.mock("../../src/lib/ipc", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  listDir: vi.fn(),
  createDir: vi.fn(),
  deleteEntry: vi.fn(),
  openFolderDialog: vi.fn(),
  execShell: vi.fn(),
}));

/** Creates a simple file node. */
function fileNode(name: string, path: string): FileNode {
  return { name, path, type: "file" };
}

/** Creates a directory node with optional children. */
function dirNode(
  name: string,
  path: string,
  children: FileNode[] = [],
): FileNode {
  return { name, path, type: "directory", children };
}

/** Parses a Blob as a JSZip and returns its entries. */
async function parseZip(blob: Blob): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(blob);
  const entries: Record<string, string> = {};
  for (const [relPath, file] of Object.entries(zip.files)) {
    if (!file.dir) {
      entries[relPath] = await file.async("string");
    }
  }
  return entries;
}

describe("exportProjectAsZip", () => {
  let backend: MockFileSystemBackend;
  const rootPath = "/test-project";

  beforeEach(() => {
    backend = new MockFileSystemBackend();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a ZIP with correct relative paths for all files", async () => {
    const files: FileNode[] = [
      dirNode("src", "/test-project/src", [
        fileNode("index.ts", "/test-project/src/index.ts"),
      ]),
      fileNode("readme.md", "/test-project/readme.md"),
    ];

    backend.files.set("/test-project/src/index.ts", 'console.log("hi");');
    backend.files.set("/test-project/readme.md", "# Test Project");

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    const entries = await parseZip(blob);
    expect(entries).toHaveProperty("src/index.ts");
    expect(entries).toHaveProperty("readme.md");
    expect(entries["src/index.ts"]).toBe('console.log("hi");');
    expect(entries["readme.md"]).toBe("# Test Project");
  });

  it("should exclude node_modules directory and its contents", async () => {
    const files: FileNode[] = [
      dirNode("src", "/test-project/src", [
        fileNode("app.ts", "/test-project/src/app.ts"),
      ]),
      dirNode("node_modules", "/test-project/node_modules", [
        fileNode("lodash", "/test-project/node_modules/lodash"),
      ]),
      fileNode("package.json", "/test-project/package.json"),
    ];

    backend.files.set("/test-project/src/app.ts", 'const x = 1;');
    backend.files.set("/test-project/node_modules/lodash", "module.exports = {};");
    backend.files.set("/test-project/package.json", '{"name": "test"}');

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    const entries = await parseZip(blob);
    expect(entries).toHaveProperty("src/app.ts");
    expect(entries).toHaveProperty("package.json");
    expect(entries).not.toHaveProperty("node_modules/lodash");
  });

  it("should exclude .git and other build artifact directories", async () => {
    const files: FileNode[] = [
      dirNode(".git", "/test-project/.git", [
        fileNode("HEAD", "/test-project/.git/HEAD"),
      ]),
      dirNode("dist", "/test-project/dist", [
        fileNode("bundle.js", "/test-project/dist/bundle.js"),
      ]),
      dirNode("coverage", "/test-project/coverage", [
        fileNode("lcov.info", "/test-project/coverage/lcov.info"),
      ]),
      dirNode("target", "/test-project/target", [
        fileNode("debug", "/test-project/target/debug"),
      ]),
      fileNode("index.html", "/test-project/index.html"),
    ];

    backend.files.set("/test-project/.git/HEAD", "ref: main");
    backend.files.set("/test-project/dist/bundle.js", "console.log");
    backend.files.set("/test-project/coverage/lcov.info", "SF:");
    backend.files.set("/test-project/target/debug", "");
    backend.files.set("/test-project/index.html", "<html></html>");

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    const entries = await parseZip(blob);
    expect(entries).toHaveProperty("index.html");
    expect(entries).not.toHaveProperty(".git/HEAD");
    expect(entries).not.toHaveProperty("dist/bundle.js");
    expect(entries).not.toHaveProperty("coverage/lcov.info");
    expect(entries).not.toHaveProperty("target/debug");
  });

  it("should skip files that fail to read and continue with remaining", async () => {
    const files: FileNode[] = [
      fileNode("good.ts", "/test-project/good.ts"),
      fileNode("bad.ts", "/test-project/bad.ts"),
      fileNode("also-good.ts", "/test-project/also-good.ts"),
    ];

    backend.files.set("/test-project/good.ts", 'export const a = 1;');
    // Do NOT set bad.ts — it will throw "File not found"
    backend.files.set("/test-project/also-good.ts", 'export const b = 2;');

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    const entries = await parseZip(blob);
    expect(entries).toHaveProperty("good.ts");
    expect(entries).not.toHaveProperty("bad.ts");
    expect(entries).toHaveProperty("also-good.ts");
  });

  it("should call onProgress callback with current/total counts", async () => {
    const files: FileNode[] = [
      fileNode("a.ts", "/test-project/a.ts"),
      fileNode("b.ts", "/test-project/b.ts"),
      fileNode("c.ts", "/test-project/c.ts"),
    ];

    backend.files.set("/test-project/a.ts", "a");
    backend.files.set("/test-project/b.ts", "b");
    backend.files.set("/test-project/c.ts", "c");

    const onProgress = vi.fn();

    const { exportProjectAsZip } = await import("../../src/lib/export");
    await exportProjectAsZip(files, rootPath, backend, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, { current: 1, total: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { current: 2, total: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(3, { current: 3, total: 3 });
  });

  it("should produce a valid Blob with correct MIME type", async () => {
    const files: FileNode[] = [
      fileNode("test.txt", "/test-project/test.txt"),
    ];

    backend.files.set("/test-project/test.txt", "hello");

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/zip");
  });

  it("should handle empty project (no files)", async () => {
    const files: FileNode[] = [];

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    const entries = await parseZip(blob);
    expect(Object.keys(entries)).toHaveLength(0);
  });

  it("should preserve directory structure in ZIP paths", async () => {
    const files: FileNode[] = [
      dirNode("a", "/test-project/a", [
        dirNode("b", "/test-project/a/b", [
          fileNode("c.ts", "/test-project/a/b/c.ts"),
          fileNode("d.ts", "/test-project/a/b/d.ts"),
        ]),
        fileNode("e.ts", "/test-project/a/e.ts"),
      ]),
    ];

    backend.files.set("/test-project/a/b/c.ts", "c");
    backend.files.set("/test-project/a/b/d.ts", "d");
    backend.files.set("/test-project/a/e.ts", "e");

    const { exportProjectAsZip } = await import("../../src/lib/export");
    const blob = await exportProjectAsZip(files, rootPath, backend);

    const entries = await parseZip(blob);
    expect(entries).toHaveProperty("a/b/c.ts");
    expect(entries).toHaveProperty("a/b/d.ts");
    expect(entries).toHaveProperty("a/e.ts");
    expect(entries["a/b/c.ts"]).toBe("c");
  });
});
