/**
 * Integration Test: Platform Detection + Storage Factory
 *
 * Verifies that detectPlatform() and createStorageBackend() work together
 * to select the correct storage adapter for each platform:
 *
 * - "tauri"   → WebStorageAdapter (IndexedDB with localStorage fallback)
 * - "browser" → WebStorageAdapter (IndexedDB with localStorage fallback)
 * - "node"    → MemoryStorageAdapter (in-memory Map)
 *
 * Tests mock different environments and verify the factory produces
 * adapters that correctly read/write data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────

function createMockIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();
  return {
    open: vi.fn((_dbName: string, _version: number) => {
      const request = {
        result: {
          createObjectStore: vi.fn(),
          objectStoreNames: { contains: vi.fn(() => true) },
          transaction: vi.fn((name: string, _mode: IDBTransactionMode) => {
            if (!stores.has(name)) stores.set(name, new Map());
            const store = stores.get(name)!;
            return {
              objectStore: vi.fn(() => ({
                put: vi.fn((value: unknown, key?: IDBValidKey) => store.set(String(key), value)),
                get: vi.fn((key: IDBValidKey) => store.get(String(key)) ?? null),
                delete: vi.fn((key: IDBValidKey) => store.delete(String(key))),
                clear: vi.fn(() => store.clear()),
              })),
              done: Promise.resolve(),
            };
          }),
        },
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBOpenDBRequest;

      setTimeout(() => {
        if (request.onsuccess) {
          (request.onsuccess as (event: Event) => void)({ target: request } as unknown as Event);
        }
      }, 0);
      return request;
    }),
    deleteDatabase: vi.fn(),
  };
}

function createMockLocalStorage() {
  const _data = new Map<string, string>();
  return {
    _data,
    getItem(key: string) { return _data.get(key) ?? null; },
    setItem(key: string, value: string) { _data.set(key, value); },
    removeItem(key: string) { _data.delete(key); },
    clear() { _data.clear(); },
    key(index: number) { return Array.from(_data.keys())[index] ?? null; },
    get length() { return _data.size; },
  };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Platform detection + Storage factory integration", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ──────────────────────────────────────────
  // Tauri platform
  // ──────────────────────────────────────────

  it("should detect 'tauri' platform and create WebStorageAdapter", async () => {
    vi.stubGlobal("window", { __TAURI__: {} });
    vi.stubGlobal("indexedDB", createMockIndexedDB());
    vi.stubGlobal("localStorage", createMockLocalStorage());

    const { detectPlatform } = await import("../../packages/opita-cloud-context/src/storage/platform");
    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const platform = detectPlatform();
    expect(platform).toBe("tauri");

    const storage = createStorageBackend(platform, "test-ns");
    await storage.set("theme", "dark");
    const result = await storage.get<string>("theme");
    expect(result).toBe("dark");
  });

  it("should fall back to localStorage for tauri platform when IndexedDB fails", async () => {
    vi.stubGlobal("window", { __TAURI__: {} });
    vi.stubGlobal("indexedDB", undefined);
    const ls = createMockLocalStorage();
    vi.stubGlobal("localStorage", ls);

    const { detectPlatform } = await import("../../packages/opita-cloud-context/src/storage/platform");
    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const platform = detectPlatform();
    expect(platform).toBe("tauri");

    const storage = createStorageBackend(platform, "fallback-ns");
    await storage.set("key", "value");
    const result = await storage.get<string>("key");
    expect(result).toBe("value");
  });

  // ──────────────────────────────────────────
  // Browser platform
  // ──────────────────────────────────────────

  it("should detect 'browser' platform and create WebStorageAdapter", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("indexedDB", createMockIndexedDB());
    vi.stubGlobal("localStorage", createMockLocalStorage());

    const { detectPlatform } = await import("../../packages/opita-cloud-context/src/storage/platform");
    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const platform = detectPlatform();
    expect(platform).toBe("browser");

    const storage = createStorageBackend(platform, "browser-ns");
    await storage.set("sidebarWidth", 300);
    const result = await storage.get<number>("sidebarWidth");
    expect(result).toBe(300);
  });

  it("should support multiple namespaces in browser storage", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("indexedDB", createMockIndexedDB());
    vi.stubGlobal("localStorage", createMockLocalStorage());

    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const ns1 = createStorageBackend("browser", "ns1");
    const ns2 = createStorageBackend("browser", "ns2");

    await ns1.set("key", "value-one");
    await ns2.set("key", "value-two");

    expect(await ns1.get<string>("key")).toBe("value-one");
    expect(await ns2.get<string>("key")).toBe("value-two");
  });

  it("should handle clear per-namespace in browser storage", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("indexedDB", createMockIndexedDB());
    vi.stubGlobal("localStorage", createMockLocalStorage());

    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const storage = createStorageBackend("browser", "clear-ns");
    await storage.set("a", 1);
    await storage.set("b", 2);
    await storage.clear();

    expect(await storage.get("a")).toBeNull();
    expect(await storage.get("b")).toBeNull();
  });

  // ──────────────────────────────────────────
  // Node platform
  // ──────────────────────────────────────────

  it("should detect 'node' platform and create MemoryStorageAdapter", async () => {
    vi.stubGlobal("window", undefined);

    const { detectPlatform } = await import("../../packages/opita-cloud-context/src/storage/platform");
    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const platform = detectPlatform();
    expect(platform).toBe("node");

    const storage = createStorageBackend(platform);
    await storage.set("theme", "dark");
    const result = await storage.get<string>("theme");
    expect(result).toBe("dark");
  });

  it("should support complex values in node storage", async () => {
    vi.stubGlobal("window", undefined);

    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const storage = createStorageBackend("node");

    const complex = { prefs: { theme: "dark" }, events: [{ id: 1, type: "test" }] };
    await storage.set("complex", complex);
    const result = await storage.get<typeof complex>("complex");
    expect(result).toEqual(complex);
  });

  it("should list keys with prefix in node storage", async () => {
    vi.stubGlobal("window", undefined);

    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const storage = createStorageBackend("node");

    await storage.set("prefs:theme", "dark");
    await storage.set("prefs:sidebarWidth", 300);
    await storage.set("sync:lastPull", Date.now());

    const prefsKeys = await storage.keys("prefs:");
    expect(prefsKeys).toHaveLength(2);
    expect(prefsKeys.sort()).toEqual(["prefs:sidebarWidth", "prefs:theme"]);

    const syncKeys = await storage.keys("sync:");
    expect(syncKeys).toHaveLength(1);
    expect(syncKeys[0]).toBe("sync:lastPull");
  });

  it("should support remove and get null in node storage", async () => {
    vi.stubGlobal("window", undefined);

    const { createStorageBackend } = await import("../../packages/opita-cloud-context/src/storage/factory");
    const storage = createStorageBackend("node");

    await storage.set("temp", "value");
    expect(await storage.get("temp")).toBe("value");
    await storage.remove("temp");
    expect(await storage.get("temp")).toBeNull();
  });
});
