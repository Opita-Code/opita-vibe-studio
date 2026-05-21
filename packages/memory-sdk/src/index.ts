/**
 * @opita/memory-sdk — AWS-backed context persistence and memory SDK.
 *
 * Provides types, an API Gateway-connected client, and storage abstractions
 * for persisting user preferences, learning events, and project metadata.
 */

export { MemoryClient, CloudContextClient } from "./client";
export type { MemoryClientConfig, CloudContextConfig } from "./client";

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
export type { CloudBridgeConfig } from "./sync/cloud-bridge";

export { ContextDecayEngine } from "./sync/context-decay";
export type { DecayOptions } from "./sync/context-decay";

export { LearningCapture } from "./sync/learning-capture";
export type {
  AppLearningEvent,
  LearningCaptureOptions,
  LearningEventFilter,
  LearningEventHandler,
} from "./sync/learning-capture";

export { migrateGuestData } from "./sync/migration";
export type { CloudBridgeWriter, MigrationOptions, MigrationResult } from "./sync/migration";
