import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import type { FileNode } from "../../src/lib/types";
import type { FileSystemBackend } from "../../src/lib/fs-backend/types";

// ─── Module mocks ────────────────────────────────────────────────

const exportProjectAsZip = vi.fn();
vi.mock("../../src/lib/export", () => ({
  exportProjectAsZip,
}));

const buildAuthHeaders = vi.fn(() => ({ Authorization: "Bearer mock" }));
vi.mock("../../src/lib/auth-fetch", () => ({ buildAuthHeaders }));

const setForcedIntent = vi.fn();
vi.mock("../../src/hooks/usePurchaseIntent", () => ({
  usePurchaseIntentStore: {
    getState: () => ({ setForcedIntent }),
  },
}));

let mockToken: string | null = null;
let mockPlan = "free";
vi.mock("../../src/stores/auth", () => ({
  useAuthStore: {
    getState: () => ({
      session: mockToken ? { token: mockToken } : null,
      plan: mockPlan,
    }),
  },
}));

vi.mock("../../src/lib/tokens", () => ({
  STORAGE_LIMITS: {
    free: 100, // bytes — tiny so we can exceed it in tests
    estudiante: 200,
    pro: 1000,
  } as Record<string, number>,
}));

// ─── Test backend ────────────────────────────────────────────────

class SpyBackend implements FileSystemBackend {
  readonly label = "tauri" as const;
  createDirectory = vi.fn(async () => {});
  writeFile = vi.fn(async () => {});
  readFile = vi.fn(async () => "");
  listDirectory = vi.fn(async () => []);
  deleteEntry = vi.fn(async () => {});
  renameEntry = vi.fn(async () => {});
  selectDirectory = vi.fn(async () => null);
  isAvailable = () => true;
}

// ─── Helpers ─────────────────────────────────────────────────────

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => payload };
}

function textResponse(ok: boolean, status: number) {
  return { ok, status, text: async () => "err" };
}

async function makeZipBlob(entries: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "blob" });
}

function fileNode(name: string, path: string): FileNode {
  return { name, path, type: "file" };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("SyncEngine.pushToCloud", () => {
  let backend: SpyBackend;
  let SyncEngine: typeof import("../../src/lib/sync").SyncEngine;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockToken = "jwt-token";
    mockPlan = "free";
    backend = new SpyBackend();
  });

  const load = async () => {
    SyncEngine = (await import("../../src/lib/sync")).SyncEngine;
  };

  it("should throw when not authenticated", async () => {
    mockToken = null;
    await load();
    await expect(
      SyncEngine.pushToCloud([], "/proj", backend),
    ).rejects.toThrow(/iniciar sesión/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should throw when the zip exceeds the plan storage limit", async () => {
    await load();
    exportProjectAsZip.mockResolvedValue(
      new Blob([new Uint8Array(1024 * 1024)]), // 1MB > 100 bytes
    );
    const progress = vi.fn();

    await expect(
      SyncEngine.pushToCloud([fileNode("a.txt", "/proj/a.txt")], "/proj", backend, progress),
    ).rejects.toThrow(/excede tu límite/);

    expect(progress).toHaveBeenCalledWith("Comprimiendo proyecto...");
    expect(setForcedIntent).toHaveBeenCalledWith("storage_limit");
  });

  it("should push to cloud via pre-signed URL and report progress", async () => {
    await load();
    exportProjectAsZip.mockResolvedValue(new Blob(["zip-bytes"], { type: "application/zip" }));

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ uploadUrl: "https://s3.example/upload" }))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const progress = vi.fn();
    await SyncEngine.pushToCloud([fileNode("a.txt", "/proj/a.txt")], "/proj", backend, progress);

    expect(exportProjectAsZip).toHaveBeenCalledWith(
      [fileNode("a.txt", "/proj/a.txt")],
      "/proj",
      backend,
    );
    // First POST to the storage API to obtain the URL
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.opitacode.com/storage/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "upload", projectId: "proj" }),
      }),
    );
    // Second call PUTs the zip to S3
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://s3.example/upload",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(progress).toHaveBeenCalledWith("Conectando con AWS...");
    expect(progress).toHaveBeenCalledWith("Subiendo a la nube...");
    expect(progress).toHaveBeenCalledWith("Finalizando sincronización...");
  });

  it("should throw when the URL request returns an error status (HTTP errors propagate)", async () => {
    await load();
    exportProjectAsZip.mockResolvedValue(new Blob(["zip"], { type: "application/zip" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));

    // Fix spec 899: un error HTTP real (4xx/5xx) ya no se degrada
    // silenciosamente al fallback de localStorage — se propaga.
    await expect(SyncEngine.pushToCloud([], "/proj", backend)).rejects.toThrow(
      /AWS error al obtener URL: 500/,
    );
    expect(localStorage.getItem("vibe-sync-/proj")).toBeNull();
  });

  it("should throw when no uploadUrl is returned", async () => {
    await load();
    exportProjectAsZip.mockResolvedValue(new Blob(["zip"]));
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(
      SyncEngine.pushToCloud([], "/proj", backend),
    ).rejects.toThrow(/No se pudo obtener la URL/);
  });

  it("should throw when the S3 PUT fails", async () => {
    await load();
    exportProjectAsZip.mockResolvedValue(new Blob(["zip"]));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ uploadUrl: "https://s3.example/upload" }))
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      SyncEngine.pushToCloud([], "/proj", backend),
    ).rejects.toThrow(/Fallo al subir archivo a S3/);
  });

  it("should fall back to localStorage when the URL request fails", async () => {
    await load();
    exportProjectAsZip.mockResolvedValue(new Blob(["zip-bytes"], { type: "application/zip" }));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await SyncEngine.pushToCloud([], "/proj", backend);
    // Allow the FileReader callback to settle (fallback writes async)
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(localStorage.getItem("vibe-sync-/proj")).toContain("data:application/zip;base64,");
  });
});

describe("SyncEngine.pullFromCloud", () => {
  let backend: SpyBackend;
  let SyncEngine: typeof import("../../src/lib/sync").SyncEngine;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockToken = "jwt-token";
    backend = new SpyBackend();
  });

  const load = async () => {
    SyncEngine = (await import("../../src/lib/sync")).SyncEngine;
  };

  it("should throw when not authenticated", async () => {
    mockToken = null;
    await load();
    await expect(
      SyncEngine.pullFromCloud("/proj", backend),
    ).rejects.toThrow(/iniciar sesión/);
  });

  it("should download and extract files from the cloud", async () => {
    await load();
    const zipBlob = await makeZipBlob({
      "src/app.ts": 'export const x = 1;',
      "src/index.ts": "console.log('hi');",
      "readme.md": "# Proj",
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ downloadUrl: "https://s3.example/download" }))
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => zipBlob });

    const progress = vi.fn();
    await SyncEngine.pullFromCloud("/proj", backend, progress);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.opitacode.com/storage/",
      expect.objectContaining({
        body: JSON.stringify({ action: "download", projectId: "proj" }),
      }),
    );
    expect(backend.writeFile).toHaveBeenCalledTimes(3);
    expect(backend.writeFile).toHaveBeenCalledWith("src/app.ts", expect.any(Uint8Array));
    expect(progress).toHaveBeenCalledWith("3 archivos restaurados.");
  });

  it("should re-throw 'no backup' 404 errors", async () => {
    await load();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 404));

    await expect(SyncEngine.pullFromCloud("/proj", backend)).rejects.toThrow(
      /No hay un respaldo/,
    );
  });

  it("should propagate generic HTTP errors (no silent localStorage fallback)", async () => {
    await load();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    localStorage.setItem("vibe-sync-/proj", "data:application/zip;base64,placeholder");

    // Fix spec 899: un error HTTP real (500) se propaga con su mensaje,
    // NO cae silenciosamente al fallback de localStorage.
    await expect(SyncEngine.pullFromCloud("/proj", backend)).rejects.toThrow(
      /AWS error al obtener URL de descarga: 500/,
    );
  });

  it("should throw when no downloadUrl is returned", async () => {
    await load();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(SyncEngine.pullFromCloud("/proj", backend)).rejects.toThrow(
      /No se pudo obtener la URL de descarga/,
    );
  });

  it("should throw when the S3 download fails", async () => {
    await load();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ downloadUrl: "https://s3.example/download" }))
      .mockResolvedValueOnce({ ok: false, status: 500, blob: async () => new Blob() });

    await expect(SyncEngine.pullFromCloud("/proj", backend)).rejects.toThrow(
      /Fallo al descargar desde S3/,
    );
  });

  it("should restore from localStorage fallback when the URL request fails", async () => {
    await load();
    const zipBlob = await makeZipBlob({ "data.txt": "local backup" });

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => zipBlob });

    localStorage.setItem(
      "vibe-sync-/proj",
      "data:application/zip;base64,placeholder",
    );

    const progress = vi.fn();
    await SyncEngine.pullFromCloud("/proj", backend, progress);

    expect(progress).toHaveBeenCalledWith("Extrayendo archivos (modo local)...");
    expect(backend.writeFile).toHaveBeenCalledWith("data.txt", expect.any(Uint8Array));
  });

  it("should throw when there is no local fallback backup", async () => {
    await load();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    localStorage.removeItem("vibe-sync-/proj");

    await expect(SyncEngine.pullFromCloud("/proj", backend)).rejects.toThrow(
      /No hay un respaldo/,
    );
  });
});
