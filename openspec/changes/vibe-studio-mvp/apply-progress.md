# Apply Progress — vibe-studio-mvp

## Status
**Mode**: Strict TDD
**Chain**: stacked-to-main (PR 10 of 11)
**Batch**: Phase 10 — Test Suite (30 new tests across 5 files)

## TDD Cycle Evidence

### Phase 9 (from prior batch)
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 9.1 | `tests/lib/tips.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 24 tips, 4 query functions | ✅ Clean |
| 9.2 | `tests/components/TipBanner.test.tsx` | Integration | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 7 cases (render, dismiss, auto-dismiss, expand) | ✅ Clean |
| 9.3 | `tests/learning/triggers.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 12 cases (patterns, scanAndTrigger, dedup, repeated code) | ✅ Clean |
| 9.4 | `tests/components/TerminalPanel.test.tsx` | Integration | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 9 cases (render, presets, input, dangerous cmd) | ✅ Clean |
| 9.5 | `tests/lib/terminal-translations.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 17 cases (translations, error/warning detection) | ✅ Clean |
| 9.6 | `tests/components/TerminalPanel.test.tsx` | Integration | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ Included in 9.4 tests (presets + dangerous cmd) | ✅ Clean |
| — | `tests/stores/learning.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 5 cases (push, dedup, dismiss, events, shown tracking) | ✅ Clean |

### Phase 10
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 10.1 | `tests/providers/deepseek.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 14 tests (adapter compliance, SseError, token edges, multi-chunk) | ✅ Clean |
| 10.2 | `tests/providers/router.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 10 tests (deepseek→gemini fallback, both fail, streamFromProvider x2) | ✅ Clean |
| 10.3 | `tests/stores/chat.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 16 tests (replace msg, context eviction, selectors, append edge) | ✅ Clean |
| 10.4 | `tests/stores/project.test.ts` | Unit | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 22 tests (saveFile, closeTabWithSave, openProject, openFile error paths) | ✅ Clean |
| 10.5 | `tests/pipeline/pipeline.test.ts` | Integration | ✅ 457/457 | ✅ Written | ✅ Passed | ✅ 44 tests (MAX_VERIFY_RETRIES=3, exact retry count, loopback max) | ✅ Changed MAX_VERIFY_RETRIES to 3 |

## Completed Tasks (Cumulative)

### Phase 1-9
[All previously completed tasks — unchanged from prior batch]

### Phase 10: Tests ← THIS BATCH
- [x] 10.1 tests/providers/deepseek.test.ts: adapter compliance, streaming, token counting (14 tests, +6 new)
- [x] 10.2 tests/providers/router.test.ts: provider selection logic, DeepSeek→Gemini fallback (10 tests, +4 new)
- [x] 10.3 tests/stores/chat.test.ts: message CRUD, streaming append, context eviction (16 tests, +9 new)
- [x] 10.4 tests/stores/project.test.ts: file ops, tab management, dirty state, save flow (22 tests, +10 new)
- [x] 10.5 tests/pipeline/pipeline.test.ts: prompt templates, output parsing, error loopback (44 tests, +1 new, 2 updated)

### Phase 11
- [ ] 11.1 E2E vibe-coding loop: mock AI response → files on disk → preview renders
- [ ] 11.2 Security audit: sandbox escapes (filesystem, network, eval, infinite loops)
- [ ] 11.3 Boot perf: cold start <3s, warm <1.5s, verify load budget
- [ ] 11.4 Edge cases: empty project, offline mode, corrupted SQLite, rapid file changes
- [ ] 11.5 Quality gates: lint, format, typecheck, all tests pass

## Files Changed (Phase 10)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/pipeline/engine.ts` | Modified | MAX_VERIFY_RETRIES changed from 1 to 3 (per spec: "After 3 retry attempts") |
| `tests/providers/deepseek.test.ts` | Extended | +6 tests: adapter compliance, SseError (500/network), token edges (empty/multi-msg), multi-chunk streaming |
| `tests/providers/router.test.ts` | Extended | +4 tests: DeepSeek→Gemini explicit fallback, both fail, streamFromProvider x2 |
| `tests/stores/chat.test.ts` | Extended | +9 tests: replaceLastMessageContent, context eviction (21+ msgs), selectors (getContextMessages/getContextCount), append edge case |
| `tests/stores/project.test.ts` | Extended | +10 tests: saveFile success/error, closeTabWithSave dirty/clean, openProject git/non-git/error, openFile read/cache/error |
| `tests/pipeline/pipeline.test.ts` | Extended | +1 test (exact retry count), 2 updated (MAX_VERIFY_RETRIES value, retry count assertion) |

## Deviations from Design
- **MAX_VERIFY_RETRIES**: Changed from 1 to 3 to align with the spec which states "After 3 retry attempts, the system MUST surface the error to the user rather than loop indefinitely." Existing test expected 1; updated to 3.
- **Task path mismatch**: Task 10.5 says `tests/openspec/pipeline.test.ts` but the actual file is at `tests/pipeline/pipeline.test.ts`. Extended the existing file instead of creating a new location.

## Issues Found
- The spec pipeline scenario mentions "3 retry attempts" but the code had `MAX_VERIFY_RETRIES = 1`. Fixed to `MAX_VERIFY_RETRIES = 3`.

## Remaining Tasks (Phase 11 — next batch)
- [ ] 11.1 E2E vibe-coding loop: mock AI response → files on disk → preview renders
- [ ] 11.2 Security audit: sandbox escapes (filesystem, network, eval, infinite loops)
- [ ] 11.3 Boot perf: cold start <3s, warm <1.5s, verify load budget
- [ ] 11.4 Edge cases: empty project, offline mode, corrupted SQLite, rapid file changes
- [ ] 11.5 Quality gates: lint, format, typecheck, all tests pass

## Workload / PR Boundary
- Mode: stacked-to-main slice (PR 10 of 11)
- Current work unit: Phase 10 — Test Suite
- Boundary: All 5 test files extended with spec-verification tests. One production code change (MAX_VERIFY_RETRIES)
- Estimated review budget impact: ~400 lines (tests + 1 line production code change)
