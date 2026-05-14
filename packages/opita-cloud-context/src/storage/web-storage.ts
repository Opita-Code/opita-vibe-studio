/**
 * WebStorageAdapter
 *
 * IndexedDB-primary, localStorage-fallback StorageBackend for browser and
 * Tauri environments (both run on WebView2 / similar web runtimes).
 *
 * Strategy:
 * 1. On construction, attempt to open an IndexedDB database
 * 2. If IndexedDB is unavailable or throws a QuotaExceededError on write,
 *    fall back to localStorage transparently
 * 3. All operations (get, set, remove, clear) go through IndexedDB when
 *    available, but degrade gracefully
 *
 * Error handling:
 * - QuotaExceededError on set() → transparent fallback to localStorage
 * - IndexedDB unavailable (missing API) → transparent fallback to localStorage
 * - Other IndexedDB errors → re-thrown as they indicate real problems
 */
import type { StorageBackend } from "../types";

const DB_NAME = "opita-cloud-context";
const DB_VERSION = 1;

/**
 * Maximum number of retries when IndexedDB versionchange or blocked events fire.
 */
const DB_OPEN_TIMEOUT_MS = 3000;

export class WebStorageAdapter implements StorageBackend {
  private namespace: string;
  private useIndexedDB: boolean = false;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(namespace: string = "default") {
    this.namespace = namespace;
    this.dbPromise = this.initDB();
  }

  /**
   * Try to open the IndexedDB database.
   * Returns null if IndexedDB is completely unavailable.
   */
  private initDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === "undefined" || !indexedDB) {
      this.useIndexedDB = false;
      return Promise.resolve(null);
    }

    return new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.namespace)) {
          db.createObjectStore(this.namespace);
        }
      };

      request.onsuccess = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.useIndexedDB = true;
        resolve(db);
      };

      request.onerror = () => {
        // IndexedDB unavailable (e.g., private browsing in some browsers)
        this.useIndexedDB = false;
        resolve(null);
      };

      // If blocked by another tab, still resolve after timeout
      request.onblocked = () => {
        // Fall back to localStorage
        this.useIndexedDB = false;
        resolve(null);
      };

      // Safety timeout — if neither success nor error fires within limits
      setTimeout(() => {
        if (this.useIndexedDB === false) {
          resolve(null);
        }
      }, DB_OPEN_TIMEOUT_MS);
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.useIndexedDB) {
      return this.lsGet<T>(key);
    }

    try {
      const db = await this.dbPromise;
      if (!db) {
        this.useIndexedDB = false;
        return this.lsGet<T>(key);
      }

      const transaction = db.transaction(this.namespace, "readonly");
      const store = transaction.objectStore(this.namespace);
      const request = store.get(key);

      return new Promise<T | null>((resolve, reject) => {
        request.onsuccess = () => {
          const value = request.result;
          resolve(value !== undefined ? (value as T) : null);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch {
      // Fall back to localStorage
      this.useIndexedDB = false;
      return this.lsGet<T>(key);
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.useIndexedDB) {
      this.lsSet(key, value);
      return;
    }

    try {
      const db = await this.dbPromise;
      if (!db) {
        this.useIndexedDB = false;
        this.lsSet(key, value);
        return;
      }

      const transaction = db.transaction(this.namespace, "readwrite");
      const store = transaction.objectStore(this.namespace);
      store.put(value, key);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          if (error && error.name === "QuotaExceededError") {
            // Quota exceeded — fall back to localStorage
            this.useIndexedDB = false;
            this.lsSet(key, value);
            resolve();
          } else {
            reject(error);
          }
        };
      });
    } catch (err: unknown) {
      const error = err as DOMException | Error;
      if (error?.name === "QuotaExceededError" || error?.name === "AbortError") {
        this.useIndexedDB = false;
        this.lsSet(key, value);
        return;
      }
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.useIndexedDB) {
      this.lsRemove(key);
      return;
    }

    try {
      const db = await this.dbPromise;
      if (!db) {
        this.useIndexedDB = false;
        this.lsRemove(key);
        return;
      }

      const transaction = db.transaction(this.namespace, "readwrite");
      const store = transaction.objectStore(this.namespace);
      store.delete(key);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      this.useIndexedDB = false;
      this.lsRemove(key);
    }
  }

  async keys(prefix: string): Promise<string[]> {
    if (!this.useIndexedDB) {
      return this.lsKeys(prefix);
    }

    try {
      const db = await this.dbPromise;
      if (!db) {
        this.useIndexedDB = false;
        return this.lsKeys(prefix);
      }

      const transaction = db.transaction(this.namespace, "readonly");
      const store = transaction.objectStore(this.namespace);
      const request = store.getAllKeys();

      return new Promise<string[]>((resolve, reject) => {
        request.onsuccess = () => {
          const allKeys = request.result as string[];
          resolve(allKeys.filter((k) => k.startsWith(prefix)));
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch {
      this.useIndexedDB = false;
      return this.lsKeys(prefix);
    }
  }

  async clear(): Promise<void> {
    if (!this.useIndexedDB) {
      this.lsClear();
      return;
    }

    try {
      const db = await this.dbPromise;
      if (!db) {
        this.useIndexedDB = false;
        this.lsClear();
        return;
      }

      const transaction = db.transaction(this.namespace, "readwrite");
      const store = transaction.objectStore(this.namespace);
      store.clear();

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      this.useIndexedDB = false;
      this.lsClear();
    }
  }

  private lsKeys(prefix: string): string[] {
    try {
      const fullPrefix = `opita-cloud:${this.namespace}:`;
      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          // Strip the prefix to return the logical key
          result.push(k.slice(fullPrefix.length));
        }
      }
      if (prefix) {
        return result.filter((k) => k.startsWith(prefix));
      }
      return result;
    } catch {
      return [];
    }
  }

  // ── localStorage fallback methods ──

  private lsKey(key: string): string {
    return `opita-cloud:${this.namespace}:${key}`;
  }

  private lsGet<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.lsKey(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private lsSet(key: string, value: unknown): void {
    try {
      localStorage.setItem(this.lsKey(key), JSON.stringify(value));
    } catch {
      // localStorage quota exceeded — silently fail
      // (better than crashing the app)
    }
  }

  private lsRemove(key: string): void {
    try {
      localStorage.removeItem(this.lsKey(key));
    } catch {
      // Silently ignore
    }
  }

  private lsClear(): void {
    try {
      // Only clear keys belonging to our namespace
      const prefix = `opita-cloud:${this.namespace}:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Silently ignore
    }
  }
}
