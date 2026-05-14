# Design: Fix Tauri Command Registration

## Technical Approach

Two-line wiring fix in `src-tauri/src/lib.rs`: declare the `commands` module so the compiler knows about it, and list all 8 commands in `generate_handler![]` so Tauri's IPC dispatcher can route frontend invocations. All 8 functions (`read_file`, `write_file`, `list_dir`, `create_dir`, `delete_entry`, `open_folder_dialog`, `validate_project`, `exec_shell`) are already `pub`, `#[tauri::command]` annotated, and implemented — they just need registration.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| **Module declaration placement** | After `use tauri::Manager;` (Rust convention) vs. anywhere in the module root | Rust idiom: `mod` after `use`, before `fn`. Placing elsewhere risks linter warnings. | After `use tauri::Manager;` |
| **Registration style** | Fully-qualified paths (`commands::fs::read_file`) vs. `use` imports per function | Qualified paths are explicit about origin, zero namespace pollution, easier to audit. | Fully-qualified paths |
| **Registration grouping** | Per-module grouping (all `commands::fs::*` together) vs. alphabetical | Per-module grouping mirrors the module structure and aids readability when commands share namespace prefixes. | Per-module grouping |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | Modify | Add `mod commands;` declaration and expand `generate_handler![]` from `[greet]` to all 9 commands (existing `greet` + 8 new) |

## Exact Code Change

### `src-tauri/src/lib.rs` — Before (lines 4-38)

```rust
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("¡Hola, {}! Bienvenido a Vibe Studio.", name)
}
```

```rust
        .invoke_handler(tauri::generate_handler![greet])
```

### `src-tauri/src/lib.rs` — After

```rust
use tauri::Manager;

mod commands;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("¡Hola, {}! Bienvenido a Vibe Studio.", name)
}
```

```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_dir,
            commands::fs::create_dir,
            commands::fs::delete_entry,
            commands::project::open_folder_dialog,
            commands::project::validate_project,
            commands::shell::exec_shell
        ])
```

## Verification

- `mod commands;` compiled → Rust resolves `src-tauri/src/commands/mod.rs` which re-exports `pub mod fs`, `pub mod project`, `pub mod shell`.
- `generate_handler![]` expanded → Tauri generates the IPC dispatch table with all 9 entries.
- `cargo check` passes → all command signatures match `#[tauri::command]` requirements (verified: `open_folder_dialog` is `async` + takes `AppHandle` — Tauri injects `AppHandle` automatically for async commands).
- `npm run typecheck` passes → no frontend signature change; commands were already declared in the TypeScript bindings.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Compile | `cargo check` exits 0 | Manual — no Rust test infrastructure for Tauri commands yet |
| Type | `npm run typecheck` exits 0 | Existing CI gate |
| Smoke | "Abrir proyecto" opens native dialog | Manual — click the button and verify OS dialog appears |

No automated test infrastructure exists for Tauri commands yet (out of scope per proposal). Compile + type checks + manual smoke test are sufficient for a wiring fix.

## Migration / Rollout

No migration required. Rollback: remove `mod commands;` and restore `generate_handler![greet]`. Single file, clean revert.

## Open Questions

None.
