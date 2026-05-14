/**
 * @opita/cloud-context — Cloud-backed context persistence SDK.
 *
 * Provides types, a Supabase-wrapping client, and storage abstractions
 * for persisting user preferences, learning events, and project metadata.
 */

export { CloudContextClient } from "./client";
export type { CloudContextConfig } from "./client";

export type {
  CloudContext,
  UserPreferences,
  LearningEvent,
  ProjectMetadata,
  SyncOperation,
  OfflineQueueEntry,
  ConsentState,
  UserMetadata,
  StorageBackend,
} from "./types";

// ── Storage Adapters ──

export { detectPlatform } from "./storage/platform";
export type { Platform } from "./storage/platform";

export { MemoryStorageAdapter } from "./storage/memory-storage";

export { WebStorageAdapter } from "./storage/web-storage";

export { createStorageBackend } from "./storage/factory";

// ── Sync Engine ──

export { OfflineQueue } from "./sync/offline-queue";
export type { OfflineQueueOptions } from "./sync/offline-queue";

export { SyncEngine } from "./sync/sync-engine";
export type { CloudBridgeClient, SyncEngineOptions } from "./sync/sync-engine";

export { CloudBridge } from "./sync/cloud-bridge";

export { LearningCapture } from "./sync/learning-capture";
export type {
  AppLearningEvent,
  LearningCaptureOptions,
  LearningEventFilter,
  LearningEventHandler,
} from "./sync/learning-capture";

export { migrateGuestData } from "./sync/migration";
export type { CloudBridgeWriter, MigrationOptions, MigrationResult } from "./sync/migration";
