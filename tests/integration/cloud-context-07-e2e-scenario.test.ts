/**
 * End-to-End Integration Test: Guest â†’ Learn â†’ Login â†’ Migrate â†’ Sync
 *
 * Simulates the full user journey:
 *   1. User opens app as guest
 *   2. Guest uses the app, triggering learning events
 *   3. Guest email stored in localStorage
 *   4. User logs in with Google OAuth
 *   5. Auth detects email match â†’ sets needsMigration flag
 *   6. Guest data is migrated to cloud via migrateGuestData()
 *   7. Cloud bridge confirms the migrated data
 *   8. SyncEngine pulls cloud data into local storage
 *
 * This test uses real SDK components with mock Supabase/CloudBridge
 * to verify the integration between all layers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrateGuestData, MemoryStorageAdapter } from "@opita/memory-sdk";
import { useAuthStore } from "../../src/stores/auth";
import { useConsentStore } from "../../src/stores/consent";
import { useLearningStore } from "../../src/stores/learning";
import { useUIStore } from "../../src/stores/ui";
import { captureBasicContext, captureRichContext } from "../../src/lib/context-capture";

describe("E2E: Guest â†’ Learn â†’ Login â†’ Migrate â†’ Sync", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null, session: null, plan: "free", authMode: "unauthenticated",
      sessionDetected: false, isLoading: false, supabaseReady: false,
      guestEmail: null, needsMigration: false,
      tokenUsage: {
        promptsUsed: 0, promptsLimit: 30,
        billingPeriodStart: expect.any(String) as unknown as string,
        billingPeriodEnd: expect.any(String) as unknown as string,
      },
    });
    useConsentStore.setState({
      basicConsent: true, richConsent: false,
      dataExportRequested: false, dataDeletionRequested: false,
      deletionConfirmStep: false,
    });
    useUIStore.setState({
      sidebarWidth: 240, statusMessage: "Listo", activeModel: "deepseek-chat",
      connectedProvider: "DeepSeek", tokensRemaining: 0,
      terminalVisible: false, terminalHeight: 200, settingsVisible: false,
      activeView: "preview", explorerVisible: false, chatWidth: 320,
      splitRatio: 0.5, chatPosition: "left", splitOrientation: "vertical",
    });
    useLearningStore.setState({
      shownTips: [], tipQueue: [], learningEvents: [],
      isVisible: false, currentTip: null,
    });
    localStorage.clear();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 1: Guest mode â€” user learns
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should allow basic context capture in guest mode", () => {
    expect(useAuthStore.getState().authMode).toBe("unauthenticated");

    const basic = captureBasicContext();
    expect(basic.authMode).toBe("unauthenticated");
    expect(basic.language).toBe("es");
    expect(basic.theme).toBe("dark");
    expect(basic.skillLevel).toBe("beginner");
    expect(basic.activeView).toBe("preview");

    expect(captureRichContext()).toBeNull();
  });

  it("should capture learning events in guest mode with consent ON", () => {
    useConsentStore.setState({ richConsent: true });

    useLearningStore.getState().addEvent({
      type: "tip_shown",
      concept: "flexbox",
      timestamp: Date.now(),
    });
    useLearningStore.getState().addEvent({
      type: "code_pattern",
      concept: "closures-scope",
      timestamp: Date.now(),
    });

    const rich = captureRichContext()!;
    expect(rich.learningEvents).toHaveLength(2);
    expect(rich.learningEvents[0].type).toBe("tip_shown");
    expect(rich.learningEvents[1].type).toBe("code_pattern");
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 2: Guest email stored
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should store guest email in localStorage during guest mode", () => {
    localStorage.setItem("vibe-guest-email", "maria@ejemplo.com");

    const storedEmail = localStorage.getItem("vibe-guest-email");
    expect(storedEmail).toBe("maria@ejemplo.com");
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 3: OAuth login with matching email
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should detect email match and set needsMigration on login", () => {
    localStorage.setItem("vibe-guest-email", "maria@ejemplo.com");

    useAuthStore.getState().login(
      { id: "google-123", email: "maria@ejemplo.com", name: "María", plan: "free", verified: true },
      { token: "jwt-token", expiresAt: Date.now() + 3600000 },
    );

    expect(useAuthStore.getState().authMode).toBe("authenticated");

    const email = useAuthStore.getState().user!.email;
    const needsMigration = useAuthStore.getState().migrateFromGuest(email);
    expect(needsMigration).toBe(true);
    expect(useAuthStore.getState().needsMigration).toBe(true);
  });

  it("should NOT migrate when OAuth email differs from guest email", () => {
    localStorage.setItem("vibe-guest-email", "maria@ejemplo.com");

    useAuthStore.getState().login(
      { id: "other-id", email: "otro@dominio.com", name: "Another", plan: "free", verified: true },
      { token: "other-token", expiresAt: Date.now() + 3600000 },
    );

    const email = useAuthStore.getState().user!.email;
    expect(useAuthStore.getState().migrateFromGuest(email)).toBe(false);
    expect(useAuthStore.getState().needsMigration).toBe(false);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 4: Guest data migration to cloud
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should migrate all guest data to cloud after OAuth login", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.set("prefs:sidebarWidth", 280);
    await storage.set("prefs:language", "es");
    await storage.set("learning:shownTips", ["tip-flexbox", "tip-hooks"]);
    await storage.set("learning:events", [
      { type: "tip_shown", concept: "flexbox", timestamp: 1000 },
      { type: "code_pattern", concept: "closures", timestamp: 2000 },
    ]);

    const cloudBridge = { writeContext: vi.fn() };

    const result = await migrateGuestData({
      userId: "google-123",
      storage,
      cloudBridge,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(4);

    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "google-123", "sidebarWidth", 280, expect.any(Number),
    );
    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "google-123", "language", "es", expect.any(Number),
    );
    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "google-123", "shownTips", ["tip-flexbox", "tip-hooks"], expect.any(Number),
    );
    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "google-123", "events", expect.any(Array), expect.any(Number),
    );
  });

  it("should preserve learning data structure after migration to cloud", async () => {
    const storage = new MemoryStorageAdapter();
    const learningData = [
      { type: "tip_shown", concept: "flexbox", timestamp: 1000 },
      { type: "code_pattern", concept: "closures", timestamp: 2000 },
      { type: "tip_shown", concept: "typescript", timestamp: 3000 },
    ];
    await storage.set("learning:events", learningData);
    await storage.set("prefs:theme", "dark");

    const cloudBridge = { writeContext: vi.fn() };

    const result = await migrateGuestData({
      userId: "user-abc",
      storage,
      cloudBridge,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(2);

    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "user-abc", "events", learningData, expect.any(Number),
    );
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 5: Migration idempotency
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should not re-migrate if migration was already completed", async () => {
    const storage = new MemoryStorageAdapter();
    const cloudBridge = { writeContext: vi.fn() };

    await storage.set("prefs:theme", "dark");
    const firstResult = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge,
    });
    expect(firstResult.migratedCount).toBe(1);

    const cloudBridge2 = { writeContext: vi.fn() };
    const secondResult = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: cloudBridge2,
    });

    expect(secondResult.alreadyMigrated).toBe(true);
    expect(secondResult.migratedCount).toBe(0);
    expect(cloudBridge2.writeContext).not.toHaveBeenCalled();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 6: Sync context after migration
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should sync migrated context to local storage after cloud migration", async () => {
    const syncStorage = new MemoryStorageAdapter();
    const now = Date.now();

    const cloudStored = new Map<string, { value: unknown; timestamp: number }>();
    cloudStored.set("theme", { value: "dark", timestamp: now });
    cloudStored.set("sidebarWidth", { value: 300, timestamp: now });

    const mockBridge = {
      readContext: vi.fn(async (_uid: string, key: string) => {
        return cloudStored.get(key) ?? null;
      }),
      writeContext: vi.fn(),
      listContextKeys: vi.fn(async () => Array.from(cloudStored.keys())),
    };

    const { SyncEngine } = await import("@opita/memory-sdk");
    const engine = new SyncEngine({ storage: syncStorage, cloudBridge: mockBridge });
    await engine.pull("user-123");

    const themeRaw = await syncStorage.get<string>("sync:theme");
    expect(JSON.parse(themeRaw!).value).toBe("dark");

    const sidebarRaw = await syncStorage.get<string>("sync:sidebarWidth");
    expect(JSON.parse(sidebarRaw!).value).toBe(300);

    const lastPull = await syncStorage.get<number>("sync:lastPull");
    expect(lastPull).not.toBeNull();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Full E2E: All steps together
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should complete the full E2E journey: guest â†’ learn â†’ login â†’ migrate â†’ sync", async () => {
    // â”€â”€ Step 1: Guest uses app â”€â”€
    expect(useAuthStore.getState().authMode).toBe("unauthenticated");
    localStorage.setItem("vibe-guest-email", "maria@ejemplo.com");

    useConsentStore.setState({ richConsent: true });
    useLearningStore.getState().addEvent({
      type: "tip_shown", concept: "flexbox", timestamp: Date.now(),
    });
    useLearningStore.getState().addEvent({
      type: "code_pattern", concept: "closure", timestamp: Date.now(),
    });

    const guestRichData = captureRichContext()!;
    expect(guestRichData.learningEvents).toHaveLength(2);

    // â”€â”€ Step 2: Guest email stored â”€â”€
    expect(localStorage.getItem("vibe-guest-email")).toBe("maria@ejemplo.com");

    // â”€â”€ Step 3: Guest data persisted to local storage â”€â”€
    const localStore = new MemoryStorageAdapter();
    await localStore.set("prefs:theme", "dark");
    await localStore.set("prefs:language", "es");
    await localStore.set("learning:events", [
      { type: "tip_shown", concept: "flexbox", timestamp: Date.now() },
      { type: "code_pattern", concept: "closure", timestamp: Date.now() },
    ]);

    const localTheme = await localStore.get<string>("prefs:theme");
    expect(localTheme).toBe("dark");

    // â”€â”€ Step 4: Login with matching email â”€â”€
    useAuthStore.getState().login(
      { id: "google-uid-456", email: "maria@ejemplo.com", name: "María García", plan: "free", verified: true },
      { token: "google-jwt", expiresAt: Date.now() + 3600000 },
    );

    expect(useAuthStore.getState().authMode).toBe("authenticated");
    expect(useAuthStore.getState().user!.email).toBe("maria@ejemplo.com");

    const willMigrate = useAuthStore.getState().migrateFromGuest("maria@ejemplo.com");
    expect(willMigrate).toBe(true);
    expect(useAuthStore.getState().needsMigration).toBe(true);

    // â”€â”€ Step 5: Migrate data to cloud â”€â”€
    const cloudBridge = { writeContext: vi.fn() };
    const migrationResult = await migrateGuestData({
      userId: "google-uid-456",
      storage: localStore,
      cloudBridge,
    });

    expect(migrationResult.success).toBe(true);
    expect(migrationResult.migratedCount).toBe(3);

    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "google-uid-456", "theme", "dark", expect.any(Number),
    );
    expect(cloudBridge.writeContext).toHaveBeenCalledWith(
      "google-uid-456", "language", "es", expect.any(Number),
    );

    // â”€â”€ Step 6: Migration marker written â”€â”€
    const marker = await localStore.get<{ userId: string }>("migration:completed");
    expect(marker).not.toBeNull();
    expect(marker!.userId).toBe("google-uid-456");

    // â”€â”€ Step 7: Re-migration is idempotent â”€â”€
    const cloudBridge2 = { writeContext: vi.fn() };
    const reMigration = await migrateGuestData({
      userId: "google-uid-456",
      storage: localStore,
      cloudBridge: cloudBridge2,
    });
    expect(reMigration.alreadyMigrated).toBe(true);
    expect(cloudBridge2.writeContext).not.toHaveBeenCalled();

    // â”€â”€ Step 8: Cloud data can be synced back to local â”€â”€
    const now = Date.now();
    const cloudData: Record<string, { value: unknown; timestamp: number }> = {
      theme: { value: "dark", timestamp: now },
      language: { value: "es", timestamp: now },
    };

    const readBridge = {
      readContext: vi.fn(async (_uid: string, key: string) => cloudData[key] ?? null),
      writeContext: vi.fn(),
      listContextKeys: vi.fn(async () => Object.keys(cloudData)),
    };

    const freshLocalStore = new MemoryStorageAdapter();
    const { SyncEngine } = await import("@opita/memory-sdk");
    const engine = new SyncEngine({ storage: freshLocalStore, cloudBridge: readBridge });
    await engine.pull("google-uid-456");

    const syncedTheme = await freshLocalStore.get<string>("sync:theme");
    expect(JSON.parse(syncedTheme!).value).toBe("dark");
  });
});

