# Tasks: Vibe-Studio MVP

## Review Workload Forecast

| Field                   | Value           |
| ----------------------- | --------------- |
| Estimated changed lines | ~3,500          |
| 400-line budget risk    | High            |
| Chained PRs recommended | Yes             |
| Delivery strategy       | auto-chain      |
| Chain strategy          | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units (11 stacked PRs → main)

| Unit | Goal                      | Likely PR | Depends On | Estimate |
| ---- | ------------------------- | --------- | ---------- | -------- |
| 1    | Scaffold + Types + Stores | PR 1      | —          | ~350     |
| 2    | Shell + IPC + Layout      | PR 2      | PR 1       | ~380     |
| 3    | Chat Core (no providers)  | PR 3      | PR 1       | ~350     |
| 4    | AI Provider Adapters      | PR 4      | PR 3       | ~380     |
| 5    | Editor + File System      | PR 5      | PR 2       | ~390     |
| 6    | Live Preview              | PR 6      | PR 5       | ~250     |
| 7    | OpenSpec Pipeline         | PR 7      | PR 4, PR 6 | ~300     |
| 8    | Auth + Token + BYOK       | PR 8      | PR 2       | ~350     |
| 9    | Learning + Terminal       | PR 9      | PR 2, PR 3 | ~300     |
| 10   | Test Suite                | PR 10     | PR 1–9     | ~400     |
| 11   | Polish + Security         | PR 11     | PR 1–10    | ~200     |

## Phase 1: Scaffold (DS1-4, TT1, ST1-4)

- [x] 1.1 Cargo.toml: tauri v2 + plugins (fs, shell, dialog, sql, updater, tray)
- [x] 1.2 tauri.conf.json: window (1280×800, 1024×680 min), CSP, tray menu, updater
- [x] 1.3 package.json: React 18, Zustand, Monaco, Tailwind, vitest, tauri-api
- [x] 1.4 src/lib/types.ts: Message, ChatChunk, FileNode, AIProvider, UserPlan
- [x] 1.5 src/stores/project.ts: rootPath, files, openTabs, isDirty
- [x] 1.6 src/stores/chat.ts: messages, isStreaming, activeProvider, pipelinePhase
- [x] 1.7 src/stores/learning.ts: shownTips, tipQueue, learningEvents
- [x] 1.8 src/stores/auth.ts: user, session, plan, tokenUsage
- [x] 1.9 src/main.tsx: React entry, Vite mount, Tailwind CSS, Monaco loader
- [x] 1.10 src/App.tsx: root layout skeleton with panel placeholder slots

## Phase 2: Shell + Layout (DS1–4)

- [ ] 2.1 src-tauri/src/main.rs: plugins register, tray (Abrir/Cerrar), single-instance guard, IPC handlers
- [ ] 2.2 src-tauri/src/commands/fs.rs: read_file, write_file, list_dir, create_dir, delete_entry
- [ ] 2.3 src-tauri/src/commands/shell.rs: exec_shell with 30s timeout, stdout/stderr capture
- [ ] 2.4 src-tauri/src/commands/project.rs: open_folder_dialog, validate project structure
- [ ] 2.5 App.tsx: 3 resizable panels (sidebar | editor+preview | chat overlay)

## Phase 3: Chat Core (CA1–4)

- [ ] 3.1 ChatPanel.tsx: multi-line input, send btn, Enter-key, 8k char limit, disabled while streaming
- [ ] 3.2 MessageBubble.tsx: react-markdown + react-syntax-highlighter (HTML/CSS/JS)
- [ ] 3.3 Context window: last 20 msgs, "12/20 mensajes" indicator, oldest eviction
- [ ] 3.4 Streaming: append chunks incrementally, auto-scroll to latest content
- [ ] 3.5 Empty/whitespace prompt: silent no-op

## Phase 4: AI Providers (AP1–4)

- [ ] 4.1 src/providers/base.ts: AIProvider interface, ProviderRouter, ChatChunk types
- [ ] 4.2 src/providers/deepseek.ts: async generator SSE streaming, token count
- [ ] 4.3 src/providers/gemini.ts: fallback on DeepSeek 429, transparent to user
- [ ] 4.4 src/providers/byok.ts: OpenAI, Anthropic, OpenRouter, custom OpenAI-compatible endpoint
- [ ] 4.5 Token counting: tiktoken for OpenAI, chars/4 estimation for others, log per request
- [ ] 4.6 Model selector dropdown: "Gratis" / "BYOK" groups, persist selection via config

## Phase 5: Editor + File System (CE1–4, FS1–4)

- [ ] 5.1 EditorPanel.tsx: lazy @monaco-editor/react, HTML/CSS/JS hl, undo/redo, find/replace, line nums
- [ ] 5.2 FileTabs.tsx: filename, close btn, unsaved dot indicator, save-prompt before close
- [ ] 5.3 Ctrl+S save via IPC write_file, "Guardado" toast, clear dirty indicator
- [ ] 5.4 FileTree.tsx: recursive tree, file-type icons, expand/collapse, click→open
- [ ] 5.5 Context menu: Nuevo archivo, Nueva carpeta, Renombrar, Eliminar (→recycle bin)
- [ ] 5.6 "Aplicar" button on AI code blocks → IPC write_file → open tab in editor
- [ ] 5.7 Git status: colored dots via `git status` shell cmd, update on save
- [ ] 5.8 File watcher: Tauri fs watch → refresh tree + editor tabs on external change

## Phase 6: Live Preview (LP1–3)

- [ ] 6.1 PreviewPanel.tsx: sandboxed iframe (allow-scripts, no allow-same-origin), strict CSP meta tag
- [ ] 6.2 postMessage bridge: editor content→iframe reload, error capture from iframe
- [ ] 6.3 Auto-reload on file save (500ms debounce) + manual reload btn, "Actualizado" flash
- [ ] 6.4 Error bar: window.onerror→postMessage→non-blocking error display above preview

## Phase 7: OpenSpec Pipeline (OS1–3)

- [ ] 7.1 src/openspec/entender.ts: prompt template to parse intent, ask clarifying qs, generate file plan
- [ ] 7.2 src/openspec/construir.ts: prompt template to generate code files with file-create markers
- [ ] 7.3 src/openspec/verificar.ts: prompt template to validate output, lint, suggest fixes
- [ ] 7.4 Error loopback: verificar→construir retry (max 3), surface error on exhaustion
- [ ] 7.5 Typed phase messages: `{phase, status, data}`, consumed by stores, hidden from UI

## Phase 8: Auth + Token + BYOK Config (AU1–3, TU1–4, BY1–3)

- [ ] 8.1 src-tauri/src/auth/mod.rs: Opita Code SSO client, token exchange, refresh, .edu verification
- [ ] 8.2 src-tauri/src/db/mod.rs: SQLite init, migrations, encrypted key-value store
- [ ] 8.3 Login screen: "Iniciar sesión", system-browser SSO flow, local callback server, token capture
- [ ] 8.4 Session persistence: SQLite token read/write, auto-refresh on start, logout clears everything
- [ ] 8.5 Prompt counter: per billing period (30/mo free), display "N de 30 prompts usados"
- [ ] 8.6 Limit enforcement: block prompt, modal "Actualizá a Estudiante o configurá BYOK"
- [ ] 8.7 BYOK config panel: add/view/remove keys, masked display (sk-...a1b2), validation via API call
- [ ] 8.8 Encrypted key storage: AES-GCM via Tauri store plugin, never plaintext
- [ ] 8.9 Custom endpoint config: URL + key + model list fetch (GET /v1/models)

## Phase 9: Learning + Terminal (LL1–2, TM1–3)

- [ ] 9.1 src/lib/tips.ts: 20+ Colombian Spanish tips by concept tag (flexbox, grid, selectors, events, DOM)
- [ ] 9.2 LearningTip.tsx: "¿Sabías que...?" toast, dismissible, 8s auto-dismiss, deduplicated
- [ ] 9.3 Event triggers: file create/AI code gen/file save → tag lookup → show tip if unseen
- [ ] 9.4 TerminalPanel.tsx: command input, spinner, stdout/stderr output, exit code, 30s timeout display
- [ ] 9.5 Spanish translation: file-not-found, perm-denied, cmd-not-found, git/npm status output
- [ ] 9.6 Preset commands dropdown (git status, npm init, etc.) + dangerous cmd confirmation dialog

## Phase 10: Tests (49 scenarios coverage)

- [ ] 10.1 tests/providers/deepseek.test.ts: adapter compliance, streaming, token counting
- [ ] 10.2 tests/providers/router.test.ts: provider selection logic, DeepSeek→Gemini fallback
- [ ] 10.3 tests/stores/chat.test.ts: message CRUD, streaming append, context eviction
- [ ] 10.4 tests/stores/project.test.ts: file ops, tab management, dirty state, save flow
- [ ] 10.5 tests/openspec/pipeline.test.ts: prompt templates, output parsing, error loopback (max 3)

## Phase 11: Polish + Verification

- [ ] 11.1 E2E vibe-coding loop: mock AI response → files on disk → preview renders
- [ ] 11.2 Security audit: sandbox escapes (filesystem, network, eval, infinite loops)
- [ ] 11.3 Boot perf: cold start <3s, warm <1.5s, verify load budget
- [ ] 11.4 Edge cases: empty project, offline mode, corrupted SQLite, rapid file changes
- [ ] 11.5 Quality gates: lint, format, typecheck, all tests pass
