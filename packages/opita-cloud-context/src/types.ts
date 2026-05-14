/**
 * Core type definitions for @opita/cloud-context.
 *
 * These types define the data structures for cloud-backed persistence of
 * user preferences, learning events, project metadata, and sync operations.
 */

// ──────────────────────────────────────────────
// Storage Backend Interface
// ──────────────────────────────────────────────

/**
 * Platform-agnostic storage backend interface.
 * Implementations can target Tauri FS, IndexedDB, localStorage, or SQLite.
 */
export interface StorageBackend {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  /** List all keys that start with the given prefix */
  keys(prefix: string): Promise<string[]>;
}

// ──────────────────────────────────────────────
// User Preferences
// ──────────────────────────────────────────────

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  sidebarWidth?: number;
  activeView?: string;
  chatPosition?: "left" | "right";
  skillLevel?: "beginner" | "intermediate" | "advanced";
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Learning Events
// ──────────────────────────────────────────────

export interface LearningEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  source: string;
}

// ──────────────────────────────────────────────
// Project Metadata
// ──────────────────────────────────────────────

export interface ProjectMetadata {
  recentProjects: string[];
  lastOpened: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Cloud Context (top-level container)
// ──────────────────────────────────────────────

export interface CloudContext {
  userId: string;
  preferences: UserPreferences;
  learningEvents: LearningEvent[];
  projectMetadata: ProjectMetadata;
  updatedAt: string;
}

// ──────────────────────────────────────────────
// User Metadata (auth profile)
// ──────────────────────────────────────────────

export interface UserMetadata {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Privacy Consent
// ──────────────────────────────────────────────

export interface ConsentState {
  analyticsOptIn: boolean;
  richContextOptIn: boolean;
  version: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────
// Sync / Queue
// ──────────────────────────────────────────────

export interface SyncOperation {
  key: string;
  value?: unknown;
  operation: "upsert" | "delete";
  timestamp: number;
}

export interface OfflineQueueEntry {
  id: string;
  key: string;
  value: unknown;
  operation: "upsert" | "delete";
  timestamp: number;
  ttl: number;
  priority: "low" | "normal" | "high";
}
