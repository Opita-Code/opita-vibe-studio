# Design: Cloud Context Memory (Fase 1 — Vibe Studio Pilot)

## Technical Approach

Supabase BaaS as sole backend (Auth + PostgreSQL + Edge Functions). A new `packages/opita-cloud-context/` TypeScript SDK wraps the Supabase client. Platform-aware `StorageAdapter` selects Tauri FS, IndexedDB, or SQLite at runtime. Zustand stores sync via `cloudSyncBridge` using last-write-wins merge with offline queue. Guest mode preserved as fully-local fallback; OAuth email match auto-migrates guest data to cloud.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Backend | Supabase BaaS vs Cloudflare Workers+D1 vs Firebase | Supabase gives Auth+DB+RLS+Edge in one, less ops. Vendor lock-in mitigated by SDK abstraction. | **Supabase BaaS** |
| Storage adapter | Strategy pattern vs conditional imports vs per-platform builds | Strategy pattern = one bundle, runtime selection via `Tauri?→FS : IndexedDB`. Cleanest for Tauri+Web dual target. | **Strategy pattern** |
| Sync merge | Last-write-wins vs CRDT vs three-way merge | CRDT overkill for prefs+learning events. LWW simple, sufficient, matches Supabase realtime. | **Last-write-wins** |
| SDK packaging | Shared npm package vs duplicated code vs monorepo workspace | `packages/opita-cloud-context/` as npm workspace package. Prepares for opita-os Fase 2. | **npm workspace** |
| Guest migration | Email match vs token migration vs manual import | Email match from mock localStorage `vibe-session` → Supabase `auth.uid()` is automatic, non-destructive. No match = fresh context. | **Email match** |
| Offline queue | Zustand middleware vs standalone queue vs Dexie.js | Standalone `OfflineQueue` class with Map+localStorage persistence. Simple, no extra dependency. | **Standalone class** |

## Data Flow

```
LoginScreen → supabase.auth.signInWithOAuth(google)
     │
     ▼
authStore.login(user, session)
     │
     ├──▶ migrateGuestIfMatch(email) ──▶ cloud_context INSERT
     │
     ▼
cloudSyncBridge.pull(userId)
     │
     ├──▶ StorageAdapter.read(userId) ──▶ merge() ──▶ uiStore / learningStore
     │
     ▼
[on pref change] → StorageAdapter.write(queue) → OfflineQueue
     │                                              │
     └──────── sync every 5min / on reconnect ◀────┘
                    │
                    ▼
              supabase.from("cloud_context").upsert(rows)
```

```
Platform selection:
  window.__TAURI__ ? TauriFSAdapter(app_data_dir)
  : indexedDB available ? IndexedDBAdapter("opita-cloud")
  : LocalStorageAdapter("opita-cloud")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/opita-cloud-context/package.json` | Create | SDK package (private, workspace) |
| `packages/opita-cloud-context/src/types.ts` | Create | `CloudContext`, `UserMetadata`, `SyncQueueEntry` |
| `packages/opita-cloud-context/src/client.ts` | Create | Supabase client factory + CRUD |
| `packages/opita-cloud-context/src/sync.ts` | Create | Sync engine (pull/merge/push) |
| `packages/opita-cloud-context/src/storage/` | Create | `StorageAdapter` interface + platform impls |
| `packages/opita-cloud-context/src/queue.ts` | Create | `OfflineQueue` with dedup+TTL+quota |
| `src/stores/auth.ts` | Modify | Add `supabaseReady`, `migrateGuest()` action |
| `src/auth/sso.ts` | Rewrite | Mock → `supabase.auth` OAuth + OTP |
| `src/lib/cloud-sync.ts` | Create | Bridge Zustand stores → cloud SDK |
| `src/components/settings/PrivacyPanel.tsx` | Create | Consent toggle, export, delete UI |
| `src/components/settings/SettingsPanel.tsx` | Modify | Add "Privacidad" tab (visible only when auth) |
| `src/components/auth/LoginScreen.tsx` | Modify | Google button, OAuth flow, terms links |
| `src-tauri/tauri.conf.json` | Modify | `connect-src` add `https://*.supabase.co` |
| `src/lib/types.ts` | Modify | Add `ConsentState`, `CloudContext` types |

## Key Interfaces

```ts
// StorageAdapter (strategy pattern)
interface StorageAdapter {
  read(key: string): Promise<unknown | null>;
  write(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  quota(): Promise<{ used: number; total: number }>;
}

// OfflineQueue
interface QueueEntry {
  id: string; key: string; value: unknown;
  timestamp: number; ttl: number; priority: "low" | "normal" | "high";
}

// cloud_context Supabase table
// Columns: id (uuid PK), user_id (uuid FK→auth.users), context_key (text),
//          context_value (jsonb), updated_at (timestamptz), source (text)
// RLS: USING (auth.uid() = user_id), WITH CHECK (auth.uid() = user_id)
```

## Supabase Schema

```sql
CREATE TABLE cloud_context (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  context_key text NOT NULL,
  context_value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  source text DEFAULT 'vibe-studio',
  UNIQUE(user_id, context_key)
);

ALTER TABLE cloud_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own context" ON cloud_context
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

No Edge Functions in Fase 1 — RLS alone handles authz. DB triggers set `updated_at`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `OfflineQueue` dedup/TTL/quota | vitest, memory-only |
| Unit | `StorageAdapter` impls | vitest + jsdom (IndexedDB mock) |
| Integration | `cloudSyncBridge` pull/merge/push | vitest + Supabase local (supabase-js mock) |
| E2E | OAuth login → pref sync → cross-session | Manual Tauri dev build (no vitest Tauri mock yet) |

## Migration / Rollout

1. **Guest preservation**: `authMode="guest"` unchanged — zero cloud writes. No migration for guests.
2. **Auth migration**: On successful Supabase OAuth, `migrateGuestIfMatch()` reads `vibe-session` from localStorage. If email matches, existing `shownTips`, `sidebarWidth`, `learningEvents` are upserted to `cloud_context`.
3. **Rollback**: `CLOUD_ENABLED` env flag (default `true`). Set to `false` → all stores fall back to localStorage. No Supabase calls. App fully functional offline.
4. **Flag gating**: `window.__OPITA_CLOUD_DISABLED__` for Tauri debug builds.

## Open Questions

- [ ] Supabase project URL/anon key: env vars or hardcoded? (Recommend `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`)
- [ ] Privacy policy document: hosted where? (Recommend `https://opita.co/privacidad`)
- [ ] `packages/` as npm workspace or separate repo? (Recommend workspace for Fase 1 simplicity)
