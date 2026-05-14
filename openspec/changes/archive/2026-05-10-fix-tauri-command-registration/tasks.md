# Tasks: Fix Tauri Command Registration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2 additions, 0 deletions (2 net) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Phase 1: Wiring

- [x] 1.1 Add `mod commands;` after `use tauri::Manager;` in `src-tauri/src/lib.rs`
- [x] 1.2 Expand `generate_handler![greet]` to include all 9 commands (existing `greet` + 8 unregistered): `commands::fs::read_file`, `commands::fs::write_file`, `commands::fs::list_dir`, `commands::fs::create_dir`, `commands::fs::delete_entry`, `commands::project::open_folder_dialog`, `commands::project::validate_project`, `commands::shell::exec_shell`

## Phase 2: Verification

- [x] 2.1 Run `cargo check` in `src-tauri/` and confirm exit code 0
- [x] 2.2 Run `npm run typecheck` in project root and confirm exit code 0
