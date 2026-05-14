# Archive Report: vibe-studio-chat-first

**Archived**: 2026-05-09
**Status**: PASS WITH WARNINGS
**Mode**: hybrid (openspec + engram)

---

## Artifact Traceability

| Artifact       | Filesystem Path                                                                       |
| -------------- | ------------------------------------------------------------------------------------- |
| Proposal       | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/proposal.md`              |
| Spec (delta)   | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/spec.md`                  |
| Design         | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/design.md`                |
| Tasks          | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/tasks.md`                 |
| Apply-progress | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/apply-progress.md`        |
| Verify-report  | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/verify-report.md`         |
| Archive-report | `openspec/changes/archive/2026-05-09-vibe-studio-chat-first/archive-report.md` (this) |

## Specs Synced to Source of Truth

| Domain          | Action           | Details                                                           |
| --------------- | ---------------- | ----------------------------------------------------------------- |
| guest-first-access | Created       | Full spec: 1 requirement, 3 scenarios                             |
| settings-panel  | Created          | Full spec: 1 requirement, 2 scenarios                             |
| desktop-shell   | Updated          | Added 2 requirements (Two-Column Layout, Top Bar), 2 scenarios    |
| chat-assistant  | Updated          | Added 1 requirement (Chat Always Visible), 2 scenarios            |
| code-editor     | Updated          | Added 1 requirement (Editor in Shared View), 1 scenario           |
| live-preview    | Updated          | Added 2 requirements (Preview as Default, Horizontal Split), 2 scenarios |
| file-system     | Updated          | Added 1 requirement (Collapsible Explorer Dock), 2 scenarios; Modified File Tree Component description |
| auth            | Updated          | Modified 3 requirements (SSO Silent Detection, Login Repurposed, Logout to Guest); Added 2 scenarios |
| byok-config     | Updated          | Added 1 requirement (BYOK in Settings Panel), 1 scenario          |
| token-usage     | Updated          | Added 1 requirement (Token Usage in Settings Panel), 2 scenarios  |

## Archive Contents

- proposal.md ✅
- exploration.md ✅ (optional)
- design.md ✅
- spec.md ✅
- tasks.md ✅ (55/56 tasks complete; 1 manual QA deferred — non-blocking)
- apply-progress.md ✅
- verify-report.md ✅
- archive-report.md ✅ (this file)

## Verification Summary

| Metric                   | Value                                   |
| ------------------------ | --------------------------------------- |
| Spec scenarios compliant | 19/21 (90.5%)                           |
| Spec requirements met    | 10/10 (100%)                            |
| Tasks complete           | 55/56 (98.2%)                           |
| Tests passing            | 563 passed, 0 failed (53 files)         |
| Typecheck (tsc)          | ✅ Clean                                |
| Linter (ESLint)          | ✅ 0 errors, 1 pre-existing warning     |
| Critical issues          | 0                                       |
| Warnings                 | 6 (see verify-report)                   |

## Non-Blocking Warnings Carried Forward

1. Prettier formatting in 4 files (cosmetic — trailing commas, spacing)
2. Chat resize drag interaction not covered by integration test
3. Split view rendering not directly tested in EditorPanel
4. Expired token catch path in `detectSession()` not directly tested in isolation
5. 3 test files use CSS className assertions (fragile but acceptable without snapshot testing)
6. Manual smoke test (task 3.5.4) deferred to human QA

## Source of Truth Updated

The following specs now reflect the chat-first, preview-first, guest-first behavior:

- `openspec/specs/guest-first-access/spec.md`
- `openspec/specs/settings-panel/spec.md`
- `openspec/specs/desktop-shell/spec.md`
- `openspec/specs/chat-assistant/spec.md`
- `openspec/specs/code-editor/spec.md`
- `openspec/specs/live-preview/spec.md`
- `openspec/specs/file-system/spec.md`
- `openspec/specs/auth/spec.md`
- `openspec/specs/byok-config/spec.md`
- `openspec/specs/token-usage/spec.md`

## SDD Cycle Complete

The change `vibe-studio-chat-first` has been fully planned (explore + propose), specified (spec), designed (design), implemented (apply across 3 chained PRs), verified (verify), and archived (archive).

Ready for the next change.
