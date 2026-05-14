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

- [x] 2.1 src-tauri/src/main.rs: plugins register, tray (Abrir/Cerrar), single-instance guard, IPC handlers
- [x] 2.2 src-tauri/src/commands/fs.rs: read_file, write_file, list_dir, create_dir, delete_entry
- [x] 2.3 src-tauri/src/commands/shell.rs: exec_shell with 30s timeout, stdout/stderr capture
- [x] 2.4 src-tauri/src/commands/project.rs: open_folder_dialog, validate project structure
- [x] 2.5 App.tsx: 3 resizable panels (sidebar | editor+preview | chat overlay)

## Phase 3: Chat Core (CA1–4)

- [x] 3.1 ChatPanel.tsx: multi-line input, send btn, Enter-key, 8k char limit, disabled while streaming
- [x] 3.2 MessageBubble.tsx: react-markdown + react-syntax-highlighter (HTML/CSS/JS)
- [x] 3.3 Context window: last 20 msgs, "12/20 mensajes" indicator, oldest eviction
- [x] 3.4 Streaming: append chunks incrementally, auto-scroll to latest content
- [x] 3.5 Empty/whitespace prompt: silent no-op

## Phase 4: AI Providers (AP1–4)

- [x] 4.1 src/providers/{types,sse,registry,router}.ts: AIProvider adapter (extant), ModelConfig, ProviderInfo, SSE streaming utility, provider registry with get/list/register, failover router
- [x] 4.2 src/providers/deepseek.ts: async generator SSE streaming via DeepSeek API, token count (chars/4), key validation
- [x] 4.3 src/providers/gemini.ts: Gemini Flash streaming via Google AI API, transparent failover (via router), token count, key validation
- [x] 4.4 src/providers/{openai,openrouter,custom}.ts: BYOK providers for OpenAI, OpenRouter (200+ models), and custom OpenAI-compatible endpoints — all SSE streaming, token count, key validation
- [x] 4.5 Token counting: chars/4 estimation for all providers, logged per request via console.log, integrated into provider router with usage logging
- [x] 4.6 Model selector dropdown: "Gratis" / "BYOK" groups, persist selection via config (BYOK config panel in Phase 8 enables key configuration; UI selector can read configured providers from byok-store)

## Phase 5: Editor + File System (CE1–4, FS1–4)

- [x] 5.1 EditorPanel.tsx: lazy @monaco-editor/react, HTML/CSS/JS hl, undo/redo, find/replace, line nums
- [x] 5.2 FileTabs.tsx: filename, close btn, unsaved dot indicator, save-prompt before close
- [x] 5.3 Ctrl+S save via IPC write_file, "Guardado" toast, clear dirty indicator
- [x] 5.4 FileTree.tsx: recursive tree, file-type icons, expand/collapse, click→open
- [x] 5.5 Context menu: Nuevo archivo, Nueva carpeta, Renombrar, Eliminar (→recycle bin)
- [x] 5.6 "Aplicar" button on AI code blocks → IPC write_file → open tab in editor
- [x] 5.7 Git status: branch detection via `git rev-parse` shell cmd, `lib/git.ts` utilities
- [x] 5.8 File watcher: Tauri fs watch → refresh tree + editor tabs on external change

## Phase 6: Live Preview (LP1–3)

- [x] 6.1 LivePreview.tsx: sandboxed iframe (allow-scripts, no allow-same-origin), strict CSP meta tag, postMessage bridge
- [x] 6.2 postMessage bridge: editor content→iframe reload with version counter, error capture from iframe
- [x] 6.3 Auto-reload on file save (version increment) + manual reload btn, "Actualizado" flash
- [x] 6.4 Error bar: window.onerror→postMessage→non-blocking error display above preview

## Phase 7: OpenSpec Pipeline (OS1–3)

- [x] 7.1 src/pipeline/types.ts + src/pipeline/entender.ts: Pipeline types (PipelinePhase enum, PhaseMessage, EntenderOutput), entender prompt template, plan parsing (intent analysis, file list, issues)
- [x] 7.2 src/pipeline/construir.ts: construir prompt template, file block parser (```file:path format), fallback parser, ConstruirOutput
- [x] 7.3 src/pipeline/verificar.ts: verificar prompt template, result parsing (ok/reintentar with reason)
- [x] 7.4 src/pipeline/engine.ts: Pipeline engine (entender→construir→verificar), retry loop (max 1), detectCodeRequest, collectResponse, file application via IPC
- [x] 7.5 src/pipeline/prompts.ts + src/stores/chat.ts: Spanish system prompts (Colombian tone), typed phase transition messages via PhaseMessage, pipelinePhase updated in store, replaceLastMessageContent action
- [x] 7.6 src/components/layout/ChatPanel.tsx: Pipeline wired — detectCodeRequest routes through pipeline, phase status ("Analizando...", "Escribiendo...", "Verificando..."), file notification, fallback to direct chat for non-code messages
- [x] 7.7 tests/pipeline/pipeline.test.ts: 25+ tests for detectCodeRequest, parsing, collectResponse, prompt builders, integration with mock provider, retry logic, error handling

## Phase 8: Auth + Token + BYOK Config (AU1–3, TU1–4, BY1–3)

- [x] 8.1 src/auth/sso.ts: Mock Opita Code SSO client, token exchange, session persistence, restore, logout (frontend MVP — no Rust backend needed yet)
- [x] 8.2 src/lib/byok-store.ts: localStorage-based encrypted key-value store (MVP fallback for Tauri store plugin). Keys masked in UI, never exposed in plaintext after save.
- [x] 8.3 src/components/auth/LoginScreen.tsx: "Iniciar sesión con Opita Code" with email field, loading/error states, "Continuar sin cuenta" guest mode
- [x] 8.4 Session persistence: localStorage read/write in sso.ts, auto-refresh on start via restoreSession(), logout clears everything
- [x] 8.5 src/lib/tokens.ts + src/components/usage/TokenBar.tsx: Per-plan prompt limits (30/200/500/2000), estimateTokens(), usage display "12/30 prompts este mes"
- [x] 8.6 Limit enforcement: ChatPanel checks isLimitReached() before sending, shows upgrade message. TokenBar warnings at 80% and limit state.
- [x] 8.7 src/components/settings/ByokPanel.tsx: add/view/remove keys, masked display (sk-...a1b2), validation via GET /v1/models, test connection button
- [x] 8.8 Encrypted key storage: localStorage with maskKey() (MVP fallback). syncProviderToRegistry() re-registers providers with new keys. AES-GCM via Tauri store plugin pending.
- [x] 8.9 Custom endpoint config: URL + key fields in ByokPanel + model list fetch (GET /v1/models), wired to createCustomProvider() with key/endpoint

## Phase 9: Learning + Terminal (LL1–2, TM1–3)

- [x] 9.1 src/lib/tips.ts: 20+ Colombian Spanish tips by concept tag (flexbox, grid, selectors, events, DOM)
- [x] 9.2 LearningTip.tsx: "¿Sabías que...?" toast, dismissible, 8s auto-dismiss, deduplicated
- [x] 9.3 Event triggers: file create/AI code gen/file save → tag lookup → show tip if unseen
- [x] 9.4 TerminalPanel.tsx: command input, spinner, stdout/stderr output, exit code, 30s timeout display
- [x] 9.5 Spanish translation: file-not-found, perm-denied, cmd-not-found, git/npm status output
- [x] 9.6 Preset commands dropdown (git status, npm init, etc.) + dangerous cmd confirmation dialog

## Phase 10: Tests (49 scenarios coverage)

- [x] 10.1 tests/providers/deepseek.test.ts: adapter compliance, streaming, token counting
- [x] 10.2 tests/providers/router.test.ts: provider selection logic, DeepSeek→Gemini fallback
- [x] 10.3 tests/stores/chat.test.ts: message CRUD, streaming append, context eviction
- [x] 10.4 tests/stores/project.test.ts: file ops, tab management, dirty state, save flow
- [x] 10.5 tests/openspec/pipeline.test.ts: prompt templates, output parsing, error loopback (max 3)

## Phase 11: Polish + Verification

- [x] 11.1 E2E vibe-coding loop: mock AI response → files on disk → preview renders
- [x] 11.2 Security audit: sandbox escapes (filesystem, network, eval, infinite loops)
- [x] 11.3 Boot perf: cold start <3s, warm <1.5s, verify load budget
- [x] 11.4 Edge cases: empty project, offline mode, corrupted SQLite, rapid file changes
- [x] 11.5 Quality gates: lint, format, typecheck, all tests pass
