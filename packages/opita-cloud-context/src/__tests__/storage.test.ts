/**
 * Tests for platform storage adapters, platform detector, and factory.
 *
 * These tests follow Strict TDD — each component is tested in isolation
 * before the factory integration.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { StorageBackend } from "../types";

// ──────────────────────────────────────────────
// Mock IndexedDB for WebStorageAdapter
// ──────────────────────────────────────────────
function createMockIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  function makeTransaction(namespace: string, _mode: IDBTransactionMode) {
    const store = stores.get(namespace) ?? new Map();
    if (!stores.has(namespace)) stores.set(namespace, store);

    return {
      objectStore: vi.fn(() => ({
        put: vi.fn((value: unknown, key?: IDBValidKey) => {
          store.set(String(key), value);
        }),
        get: vi.fn((key: IDBValidKey) => store.get(String(key)) ?? null),
        delete: vi.fn((key: IDBValidKey) => {
          store.delete(String(key));
        }),
        clear: vi.fn(() => {
          store.clear();
        }),
      })),
      objectStoreNames: { contains: vi.fn(() => true) },
      oncomplete: null as (() => void) | null,
      onerror: null as ((event: Event) => void) | null,
      // Resolve immediately for Promise-based transaction completion
      done: Promise.resolve(),
    };
  }

  return {
    _stores: stores,
    open: vi.fn((_dbName: string, _version: number) => {
      const txn = makeTransaction("opita-cloud", "readwrite");

      const request = {
        result: {
          createObjectStore: vi.fn((_name: string) => ({
            put: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
          })),
          objectStoreNames: { contains: vi.fn(() => true) },
          transaction: vi.fn((name: string, mode: IDBTransactionMode) => {
            if (name === "opita-cloud") return txn;
            return makeTransaction(name as string, mode);
          }),
        },
        onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
        onsuccess:
          null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };

      // Simulate async completion
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: request } as unknown as Event);
        }
      }, 0);

      return request;
    }),
    deleteDatabase: vi.fn(),
  };
}

// ──────────────────────────────────────────────
// Mock localStorage
// ──────────────────────────────────────────────
function createMockLocalStorage() {
  const _data = new Map<string, string>();
  return {
    _data,
    getItem(key: string) { return _data.get(key) ?? null; },
    setItem(key: string, value: string) { _data.set(key, value); },
    removeItem(key: string) { _data.delete(key); },
    clear() { _data.clear(); },
    key(index: number) {
      const keys = Array.from(_data.keys());
      return keys[index] ?? null;
    },
    get length() { return _data.size; },
  };
}

// ──────────────────────────────────────────────
// Platform Detector Tests
// ──────────────────────────────────────────────

describe("Platform Detector", () => {
  beforeEach(() => {
    // Clean up global stubs before each test
    vi.unstubAllGlobals();
    // Ensure index.ts uses dynamic imports to avoid hoisting issues
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return 'tauri' when window.__TAURI__ exists", async () => {
    vi.stubGlobal("window", { __TAURI__: {} });
    const { detectPlatform } = await import("../storage/platform");
    expect(detectPlatform()).toBe("tauri");
  });

  it("should return 'browser' when window exists but __TAURI__ is absent", async () => {
    // Module is already cached from previous import — need fresh eval
    vi.stubGlobal("window", {});
    // Re-import to get fresh detection
    const mod = await import("../storage/platform");
    // Re-evaluate by calling the function (it checks at call-time)
    expect(mod.detectPlatform()).toBe("browser");
  });

  it("should return 'node' when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    const { detectPlatform } = await import("../storage/platform");
    expect(detectPlatform()).toBe("node");
  });
});

// ──────────────────────────────────────────────
// Memory Storage Adapter Tests
// ──────────────────────────────────────────────

describe("MemoryStorageAdapter", () => {
  let storage: StorageBackend;

  beforeEach(async () => {
    const { MemoryStorageAdapter } = await import("../storage/memory-storage");
    storage = new MemoryStorageAdapter();
  });

  it("should store and retrieve a string value", async () => {
    await storage.set("theme", "dark");
    const result = await storage.get<string>("theme");
    expect(result).toBe("dark");
  });

  it("should store and retrieve a number value", async () => {
    await storage.set("sidebarWidth", 280);
    const result = await storage.get<number>("sidebarWidth");
    expect(result).toBe(280);
  });

  it("should store and retrieve an object value", async () => {
    const prefs = { theme: "dark", fontSize: 14 };
    await storage.set("prefs", prefs);
    const result = await storage.get<typeof prefs>("prefs");
    expect(result).toEqual(prefs);
  });

  it("should return null for non-existent keys", async () => {
    const result = await storage.get<string>("nonexistent");
    expect(result).toBeNull();
  });

  it("should overwrite existing values", async () => {
    await storage.set("key", "old");
    await storage.set("key", "new");
    const result = await storage.get<string>("key");
    expect(result).toBe("new");
  });

  it("should remove a key and return null on subsequent get", async () => {
    await storage.set("temp", "value");
    await storage.remove("temp");
    const result = await storage.get<string>("temp");
    expect(result).toBeNull();
  });

  it("should remove a non-existent key without error", async () => {
    await expect(storage.remove("ghost")).resolves.toBeUndefined();
  });

  it("should clear all keys", async () => {
    await storage.set("a", 1);
    await storage.set("b", 2);
    await storage.clear();
    expect(await storage.get("a")).toBeNull();
    expect(await storage.get("b")).toBeNull();
  });

  it("should clear an already-empty store without error", async () => {
    await expect(storage.clear()).resolves.toBeUndefined();
  });

  it("should support array values", async () => {
    const arr = [1, 2, 3];
    await storage.set("arr", arr);
    const result = await storage.get<number[]>("arr");
    expect(result).toEqual([1, 2, 3]);
  });

  it("should support boolean values", async () => {
    await storage.set("flag", true);
    const result = await storage.get<boolean>("flag");
    expect(result).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Web Storage Adapter Tests
// ──────────────────────────────────────────────

describe("WebStorageAdapter", () => {
  let mockDB: ReturnType<typeof createMockIndexedDB>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {});
    mockDB = createMockIndexedDB();
    vi.stubGlobal("indexedDB", mockDB);
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should store and retrieve a value via IndexedDB", async () => {
    const { WebStorageAdapter } = await import("../storage/web-storage");
    const storage = new WebStorageAdapter("test-ns");

    await storage.set("key1", "value1");
    const result = await storage.get<string>("key1");
    expect(result).toBe("value1");
  });

  it("should return null for non-existent key", async () => {
    const { WebStorageAdapter } = await import("../storage/web-storage");
    const storage = new WebStorageAdapter("test-ns");

    const result = await storage.get<string>("ghost");
    expect(result).toBeNull();
  });

  it("should remove a value and confirm it's gone", async () => {
    const { WebStorageAdapter } = await import("../storage/web-storage");
    const storage = new WebStorageAdapter("test-ns");

    await storage.set("temp", "data");
    await storage.remove("temp");
    const result = await storage.get("temp");
    expect(result).toBeNull();
  });

  it("should clear all values", async () => {
    const { WebStorageAdapter } = await import("../storage/web-storage");
    const storage = new WebStorageAdapter("test-ns");

    await storage.set("a", 1);
    await storage.set("b", 2);
    await storage.clear();
    expect(await storage.get("a")).toBeNull();
    expect(await storage.get("b")).toBeNull();
  });

  it("should fall back to localStorage when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const { WebStorageAdapter } = await import("../storage/web-storage");
    const storage = new WebStorageAdapter("test-ns");

    await storage.set("fallback", "ls-value");
    const result = await storage.get<string>("fallback");
    expect(result).toBe("ls-value");
  });

  it("should handle quota errors gracefully and fall back to localStorage", async () => {
    // Simulate a quota error from IndexedDB — override open to throw on put
    const quotaDB = {
      _stores: new Map<string, Map<string, unknown>>(),
      open: vi.fn((_dbName: string, _version: number): IDBOpenDBRequest => {
        const request = {
          result: {
            createObjectStore: vi.fn(),
            objectStoreNames: { contains: vi.fn(() => true) },
            transaction: vi.fn(() => ({
              objectStore: vi.fn(() => ({
                put: vi.fn(() => {
                  const error = new DOMException("Quota exceeded", "QuotaExceededError");
                  throw error;
                }),
                get: vi.fn(() => null),
                delete: vi.fn(),
                clear: vi.fn(),
              })),
              done: Promise.resolve(),
            })),
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
    vi.stubGlobal("indexedDB", quotaDB);

    const { WebStorageAdapter } = await import("../storage/web-storage");
    const storage = new WebStorageAdapter("test-ns");

    await storage.set("quota-key", "quota-value");
    const result = await storage.get<string>("quota-key");
    expect(result).toBe("quota-value");
  });
});

// ──────────────────────────────────────────────
// Storage Factory Tests
// ──────────────────────────────────────────────

describe("Storage Factory", () => {
  it("should return MemoryStorageAdapter for 'node' platform", async () => {
    const { createStorageBackend } = await import("../storage/factory");
    const storage = createStorageBackend("node");
    expect(storage.get).toBeDefined();
    expect(storage.set).toBeDefined();
    expect(storage.remove).toBeDefined();
    expect(storage.clear).toBeDefined();

    // Verify it actually works as a MemoryStorageAdapter
    await storage.set("test", "value");
    expect(await storage.get("test")).toBe("value");
  });

  it("should return WebStorageAdapter for 'browser' platform", async () => {
    // Need indexedDB and window for WebStorageAdapter
    vi.stubGlobal("window", {});
    vi.stubGlobal("indexedDB", createMockIndexedDB());
    vi.stubGlobal("localStorage", createMockLocalStorage());

    const { createStorageBackend } = await import("../storage/factory");
    const storage = createStorageBackend("browser");
    expect(storage.get).toBeDefined();
    expect(storage.set).toBeDefined();

    await storage.set("browser-key", "browser-value");
    expect(await storage.get("browser-key")).toBe("browser-value");

    vi.unstubAllGlobals();
  });

  it("should return WebStorageAdapter for 'tauri' platform (same webview)", async () => {
    vi.stubGlobal("window", { __TAURI__: {} });
    vi.stubGlobal("indexedDB", createMockIndexedDB());
    vi.stubGlobal("localStorage", createMockLocalStorage());

    const { createStorageBackend } = await import("../storage/factory");
    const storage = createStorageBackend("tauri");
    expect(storage.get).toBeDefined();
    expect(storage.set).toBeDefined();

    await storage.set("tauri-key", "tauri-value");
    expect(await storage.get("tauri-key")).toBe("tauri-value");

    vi.unstubAllGlobals();
  });
});
