# Tasks: Cloud Context Memory (Fase 1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,200–1,600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 6 stacked PRs to main |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | SDK Core: types, client, package scaffold | PR 1 | base=main |
| 2 | Platform storage adapters (strategy pattern) | PR 2 | base=main (parallel to PR 1) |
| 3 | Auth migration: Supabase OAuth + guest migration | PR 3 | base=main (parallel to 1+2) |
| 4 | Sync engine: OfflineQueue, LWW merge, bridge | PR 4 | depends on PR 1+2 |
| 5 | Privacy consent UI + context capture hooks | PR 5 | depends on PR 3 |
| 6 | Tests: unit + integration for all domains | PR 6 | depends on PR 1–5 |

## Phase 1: Foundation — SDK Core (PR 1)

- [x] 1.1 Create `packages/opita-cloud-context/package.json` as private npm workspace (`@opita/cloud-context`)
- [x] 1.2 Create `packages/opita-cloud-context/tsconfig.json` extending root
- [x] 1.3 Create `src/types.ts` — `CloudContext`, `SyncQueueEntry`, `UserMetadata`, `ConsentState`
- [x] 1.4 Create `src/client.ts` — `CloudContextClient` class wrapping `@supabase/supabase-js`
- [x] 1.5 Create `src/index.ts` barrel export
- [x] 1.6 Update root `package.json` with `workspaces` + dependency on `@opita/cloud-context`
- [x] 1.7 Update root `tsconfig.json` path mapping for `@opita/cloud-context`

## Phase 2: Platform Storage Adapters (PR 2) ✅

- [x] 2.1 Create `src/storage/platform.ts` — Platform detector (`detectPlatform()` returns `tauri | browser | node`)
- [x] 2.2 Create `src/storage/memory-storage.ts` — `MemoryStorageAdapter` (in-memory Map)
- [x] 2.3 Create `src/storage/web-storage.ts` — `WebStorageAdapter` (IndexedDB primary, localStorage fallback)
- [x] 2.4 Create `src/storage/factory.ts` — `createStorageBackend(platform)` returns the right adapter
- [x] 2.5 Create `src/__tests__/storage.test.ts` — 23 unit tests covering all adapters, detector, factory

## Phase 3: Auth Migration (PR 3) ✅

- [x] 3.1 Create `src/auth/cloudAuth.ts` — CloudAuth wraps CloudContextClient. Singleton reads Supabase env vars.
- [x] 3.2 Rewrite `src/auth/sso.ts` — Supabase OAuth + Google + mock fallback
- [x] 3.3 Modify `src/stores/auth.ts` — supabaseReady, guestEmail, needsMigration, migrateFromGuest(), setSupabaseReady()
- [x] 3.4 Update `src/components/auth/LoginScreen.tsx` — Google OAuth button as primary, email mock fallback, terms+privacy links
- [x] 3.5 Create `.env.example` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- [x] 3.6 Update tests — cloudAuth (18), sso (17), auth (12), LoginScreen (8)
- [x] 3.7 Modify `src-tauri/tauri.conf.json` — CSP connect-src

## Phase 4: Sync Engine + Cloud Bridge (PR 4) ✅

- [x] 4.1 Create `src/sync/offline-queue.ts` — OfflineQueue with dedup, TTL, priority, quota eviction
- [x] 4.2 Create `src/sync/sync-engine.ts` — SyncEngine: pull(userId) → StorageAdapter.read → LWW merge → push
- [x] 4.3 Create `src/sync/cloud-bridge.ts` — CloudBridge wraps Supabase client for cloud_context table
- [x] 4.4 Create `src/sync/learning-capture.ts` — LearningCapture: convert app events to SDK LearningEvent
- [x] 4.5 Create `src/sync/migration.ts` — migrateGuestData: guest→cloud migration
- [x] 4.6 Create unit tests — OfflineQueue (21), SyncEngine (10), CloudBridge (9), LearningCapture (14), Migration (8)

## Phase 5: Privacy + Context Capture (PR 5) ✅

**Additions beyond original tasks**:
- Created `src/stores/consent.ts` — Zustand consent store with toggle+export+delete actions + localStorage persistence
- Created `src/lib/context-capture.ts` — pure functions + React hooks (`useBasicContextCapture`, `useRichContextCapture`)

- [x] 5.1 Create `src/components/settings/PrivacyPanel.tsx` — consent toggle, export JSON, delete confirm
- [x] 5.2 Modify `src/components/settings/SettingsPanel.tsx`: add "Privacidad" tab (auth-gated, visible only when authenticated)
- [x] 5.3 Implement progressive capture: basic prefs always collected, rich events only if consent ON
- [x] 5.4 Implement data export: UI complete (flag + button), actual Supabase query TBD in PR 6 integration
- [x] 5.5 Implement data deletion: UI complete (confirm dialog + flag), actual delete TBD in PR 6
- [x] 5.6 Link privacy policy URL in PrivacyPanel + already present in LoginScreen footer

## Phase 6: Tests (PR 6)

- [ ] 6.1 Test: OfflineQueue dedup (same key+value → single entry)
- [ ] 6.2 Test: OfflineQueue TTL (entries past TTL not pushed)
- [ ] 6.3 Test: OfflineQueue quota (evicts oldest/lowest-priority at limit)
- [ ] 6.4 Test: StorageAdapter TauriFS read/write/delete/quota (vitest + mock fs)
- [ ] 6.5 Test: StorageAdapter IndexedDB read/write/delete/quota (vitest + jsdom)
- [ ] 6.6 Test: cloudSyncBridge LWW merge (newer timestamp wins)
- [ ] 6.7 Test: Guest mode — zero cloud writes, localStorage only
