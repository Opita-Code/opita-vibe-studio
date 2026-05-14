# cloud-context-memory Specification

## Purpose

Cloud-backed persistence layer for user preferences, learning state, and project metadata. Sync engine between local Zustand stores and Supabase PostgreSQL. Implicit feature — no user-facing "sync" toggle.

## Requirements

### Requirement: Cloud Context Persistence

The system MUST persist user context data (preferences, learning events, metadata) to Supabase PostgreSQL `cloud_context` table keyed by `user_id`. Guest users MUST NOT trigger cloud writes. Offline changes SHALL queue locally and sync on reconnect.

#### Scenario: Authenticated user writes to cloud

- GIVEN user is authenticated via Supabase Auth
- WHEN UI preferences, learning events, or metadata change
- THEN changes are written to `cloud_context` table with `user_id = auth.uid()`

#### Scenario: Guest user stays local-only

- GIVEN guest mode (no Supabase Auth session)
- WHEN preferences or state change
- THEN changes persist ONLY to localStorage — no cloud write attempted

#### Scenario: Offline queue and sync

- GIVEN authenticated user without network connectivity
- WHEN preferences change
- THEN changes are queued locally and synced to Supabase when connectivity returns

### Requirement: Bidirectional Sync

The sync engine MUST merge local Zustand state with cloud state on authentication start and on a periodic interval. Last-write-wins SHALL be the merge strategy.

#### Scenario: Initial sync on login

- GIVEN user logs in with existing cloud context data
- WHEN Supabase Auth session starts
- THEN cloud state is fetched and merged into local Zustand stores, overwriting local with newer cloud timestamps

#### Scenario: Periodic sync

- GIVEN authenticated session with local state changes
- WHEN the sync interval elapses (5 minutes)
- THEN local state diffs since last sync are pushed to Supabase

### Requirement: Context Enrichment

On session start, the system SHALL load the user's cloud context and inject it into the AI prompt for richer cross-session awareness.

#### Scenario: AI context enriched on mount

- GIVEN authenticated user with cloud context data (preferences, skill level, recent projects)
- WHEN the app mounts and AI chat initializes
- THEN the system prompt includes user preferences, learning progress, and recent activity from cloud

## ADDED Requirements (Platform-Aware Storage Strategies)

### Requirement: Platform-Aware Storage Backend

The system MUST select the appropriate local storage backend based on runtime platform. Desktop (Tauri) SHALL use the app data filesystem directory as primary storage with cloud sync in background. Web SHALL use IndexedDB as primary with localStorage as fallback-cache. Mobile (future) SHALL use SQLite/native storage with deferred sync queue.

#### Scenario: Desktop filesystem-first with background sync

- GIVEN Tauri runtime on Windows
- WHEN context data changes (preferences, learning events)
- THEN data persists to app data directory immediately AND syncs to Supabase in background when network available

#### Scenario: Web IndexedDB with localStorage fallback

- GIVEN browser runtime
- WHEN context data changes
- THEN data persists to IndexedDB AND a minimal snapshot caches to localStorage AND syncs to cloud when online

#### Scenario: Offline survival across platforms

- GIVEN any platform without network connectivity
- WHEN context data changes
- THEN local storage persists the data AND app functions fully offline AND data survives app restart

### Requirement: Intelligent Offline Queue

The offline queue MUST deduplicate redundant writes (same key, same value) before sync. Context data SHALL respect a configurable TTL and expire after the configured duration. The queue MUST NOT exceed device storage quotas — oldest or lowest-priority data SHALL be evicted when near quota. Pending operations SHALL dispatch to cloud on reconnect using last-write-wins conflict resolution.

#### Scenario: Deduplication of redundant writes

- GIVEN offline with pending write for key "theme:dark"
- WHEN the same key "theme:dark" is written again with identical value
- THEN only one write is queued for sync — duplicate is discarded

#### Scenario: TTL-based expiration

- GIVEN context data with TTL of 7 days stored locally
- WHEN 8 days have passed and sync triggers
- THEN expired data is NOT written to cloud AND is removed from local queue

#### Scenario: Quota-aware eviction

- GIVEN IndexedDB usage at 90% of browser quota
- WHEN new context data is written
- THEN oldest or lowest-priority context entries are evicted before writing new data

### Requirement: Progressive Context Capture

The system SHALL always capture basic context data (preferences, skill level identifier) regardless of consent. Rich context data (detailed learning events, full project metadata, behavioral analytics) SHALL only be captured when the user has explicitly opted in via the privacy consent toggle.

#### Scenario: Basic context always captured

- GIVEN any user (authenticated or guest)
- WHEN preferences or skill level change
- THEN basic context is captured to local storage AND synced to cloud if authenticated

#### Scenario: Rich context blocked without consent

- GIVEN authenticated user with privacy consent toggle OFF
- WHEN detailed learning events or project metadata are generated
- THEN rich context is NOT captured to cloud — only basic context is stored

#### Scenario: Rich context captured with consent

- GIVEN authenticated user with privacy consent toggle ON
- WHEN learning events occur (code completions, feature usage patterns)
- THEN rich context IS captured and synced to Supabase alongside basic context
