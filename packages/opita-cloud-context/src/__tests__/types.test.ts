import { describe, it, expect } from "vitest";
import type {
  CloudContext,
  UserPreferences,
  LearningEvent,
  ProjectMetadata,
  SyncOperation,
  OfflineQueueEntry,
  ConsentState,
  UserMetadata,
  StorageBackend,
} from "../types";

describe("CloudContext type", () => {
  it("should create a valid CloudContext object", () => {
    const ctx: CloudContext = {
      userId: "user-123",
      preferences: {
        theme: "dark",
        sidebarWidth: 280,
      },
      learningEvents: [],
      projectMetadata: {
        recentProjects: [],
        lastOpened: "2026-05-10T00:00:00Z",
      },
      updatedAt: "2026-05-10T00:00:00Z",
    };

    expect(ctx.userId).toBe("user-123");
    expect(ctx.preferences.theme).toBe("dark");
    expect(ctx.learningEvents).toHaveLength(0);
    expect(ctx.projectMetadata.recentProjects).toEqual([]);
  });

  it("should allow optional fields in preferences", () => {
    const prefs: UserPreferences = {};
    expect(prefs).toEqual({});
  });

  it("should accept all learning event fields", () => {
    const event: LearningEvent = {
      id: "evt-001",
      type: "tip_shown",
      data: { tipId: "css-grid" },
      timestamp: "2026-05-10T10:00:00Z",
      source: "vibe-studio",
    };

    expect(event.id).toBe("evt-001");
    expect(event.type).toBe("tip_shown");
    expect(event.data).toEqual({ tipId: "css-grid" });
  });

  it("should accept extra keys in project metadata", () => {
    const meta: ProjectMetadata = {
      recentProjects: ["proj-a"],
      lastOpened: "2026-05-10T00:00:00Z",
      customField: "anything",
    };

    expect(meta.recentProjects).toContain("proj-a");
    expect(meta.customField).toBe("anything");
  });
});

describe("SyncOperation type", () => {
  it("should create an upsert operation", () => {
    const op: SyncOperation = {
      key: "theme",
      value: "dark",
      operation: "upsert",
      timestamp: 1715000000000,
    };

    expect(op.key).toBe("theme");
    expect(op.operation).toBe("upsert");
  });

  it("should create a delete operation", () => {
    const op: SyncOperation = {
      key: "obsolete-key",
      operation: "delete",
      timestamp: 1715000000000,
    };

    expect(op.operation).toBe("delete");
  });
});

describe("OfflineQueueEntry type", () => {
  it("should create a queue entry with all fields", () => {
    const entry: OfflineQueueEntry = {
      id: "q-001",
      key: "sidebarWidth",
      value: 300,
      operation: "upsert",
      timestamp: 1715000000000,
      ttl: 604800000,
      priority: "normal",
    };

    expect(entry.id).toBe("q-001");
    expect(entry.priority).toBe("normal");
    expect(entry.ttl).toBe(604800000);
    expect(entry.operation).toBe("upsert");
  });

  it("should support all priority levels", () => {
    const low: OfflineQueueEntry = {
      id: "q-002",
      key: "k",
      value: 1,
      operation: "upsert",
      timestamp: 0,
      ttl: 0,
      priority: "low",
    };
    const high: OfflineQueueEntry = {
      id: "q-003",
      key: "k",
      value: 2,
      operation: "delete",
      timestamp: 0,
      ttl: 0,
      priority: "high",
    };

    expect(low.priority).toBe("low");
    expect(high.priority).toBe("high");
  });
});

describe("ConsentState type", () => {
  it("should create a consent state with all fields", () => {
    const state: ConsentState = {
      analyticsOptIn: true,
      richContextOptIn: false,
      version: "1.0",
      updatedAt: "2026-05-10T00:00:00Z",
    };

    expect(state.analyticsOptIn).toBe(true);
    expect(state.richContextOptIn).toBe(false);
    expect(state.version).toBe("1.0");
  });
});

describe("UserMetadata type", () => {
  it("should create user metadata with nullable avatar", () => {
    const meta: UserMetadata = {
      email: "user@example.com",
      displayName: "Test User",
      avatarUrl: null,
      createdAt: "2026-05-10T00:00:00Z",
    };

    expect(meta.email).toBe("user@example.com");
    expect(meta.avatarUrl).toBeNull();
  });

  it("should accept a string avatar URL", () => {
    const meta: UserMetadata = {
      email: "user@example.com",
      displayName: "Test User",
      avatarUrl: "https://example.com/avatar.png",
      createdAt: "2026-05-10T00:00:00Z",
    };

    expect(meta.avatarUrl).toBe("https://example.com/avatar.png");
  });
});

describe("StorageBackend interface", () => {
  it("should be structurally compatible with a class implementation", () => {
    const storage: StorageBackend = {
      get: async <T>(_key: string): Promise<T | null> => null,
      set: async (_key: string, _value: unknown): Promise<void> => {},
      remove: async (_key: string): Promise<void> => {},
      clear: async (): Promise<void> => {},
      keys: async (_prefix: string): Promise<string[]> => [],
    };

    expect(storage).toBeDefined();
    expect(typeof storage.get).toBe("function");
    expect(typeof storage.set).toBe("function");
    expect(typeof storage.remove).toBe("function");
    expect(typeof storage.clear).toBe("function");
    expect(typeof storage.keys).toBe("function");
  });

  it("should work with typed get operations", async () => {
    const storage: StorageBackend = {
      get: async <T>(key: string): Promise<T | null> => {
        if (key === "theme") return "dark" as unknown as T;
        return null;
      },
      set: async () => {},
      remove: async () => {},
      clear: async () => {},
      keys: async () => [],
    };

    const theme = await storage.get<string>("theme");
    expect(theme).toBe("dark");

    const missing = await storage.get<string>("missing");
    expect(missing).toBeNull();
  });
});
