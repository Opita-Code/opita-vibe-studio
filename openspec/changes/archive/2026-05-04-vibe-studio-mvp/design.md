# Design: Vibe-Studio MVP

## Technical Approach

Desktop app where users describe projects in Spanish, AI generates code, live preview renders output, and contextual Spanish tips teach without friction. Architecture: Tauri v2 Rust backend (fs, shell, SQLite, auth) + React 18 frontend in WebView2 (Monaco editor, chat, preview) connected via IPC commands. AI providers use an adapter pattern with async generators for streaming. A simplified 3-phase OpenSpec pipeline (entender → construir → verificar) runs invisibly behind the chat loop. Zustand manages three stores (project, chat, learning). One folder = one project. No multi-agent, no vault, no community plugins — those are Opita Studio domain.

---

## Architecture Decisions

| #   | Decision                    | Option A                             | Option B                   | Choice                     | Rationale                                                                                                                                                                                                                                        |
| --- | --------------------------- | ------------------------------------ | -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Desktop shell**           | Tauri v2                             | Electron                   | **Tauri v2**               | 10× smaller binary, native WebView2 on Windows, official fs/shell/sql/dialog/updater plugins. Electron is heavier and not needed for Windows-only target.                                                                                        |
| 2   | **IPC design**              | Commands (request/response)          | Events (pub/sub)           | **Commands**               | File ops, auth, config reads are synchronous from user POV. Events reserved for file watcher notifications (fs changes → frontend). WebView2 SSE for AI streaming bypasses Rust IPC.                                                             |
| 3   | **State management**        | Zustand                              | React Context              | **Zustand**                | <1KB, no providers needed, selectors prevent re-renders, devtools. Context re-renders whole subtrees; Redux is overkill for 3 stores.                                                                                                            |
| 4   | **Component structure**     | Atomic design                        | Container/presentational   | **Feature-folders**        | `components/chat/`, `components/editor/`, etc. Each folder owns its components, hooks, and types. No enforced atomic layers — this is a desktop app, not a design system.                                                                        |
| 5   | **Routing**                 | Single-window panels                 | React Router               | **Single-window**          | Three resizable panels (sidebar + editor + preview) + chat overlay. No page navigation needed. Panel visibility toggled via Zustand.                                                                                                             |
| 6   | **AI provider abstraction** | Adapter interface + async generators | Direct fetch per provider  | **Adapter + generators**   | `AIProvider` interface with `chat(): AsyncIterable<ChatChunk>`. DeepSeek, Gemini, BYOK each implement it. Provider router selects based on availability, cost, and user's BYOK keys.                                                             |
| 7   | **AI streaming path**       | Frontend → provider API directly     | Frontend → Rust → provider | **Frontend direct**        | WebView2 supports fetch/SSE natively. Rust proxy adds latency with no benefit. Token counting and cost tracking happen in the frontend adapter layer.                                                                                            |
| 8   | **Code editor**             | Monaco Editor                        | CodeMirror 6               | **Monaco**                 | VS Code quality, best HTML/CSS/JS support, `@monaco-editor/react` wrapper handles lazy-loading. 5MB bundle acceptable in desktop context (lazy-loaded, not on critical path).                                                                    |
| 9   | **Live preview sandbox**    | Sandboxed iframe + CSP               | Shadow DOM + eval          | **Sandboxed iframe**       | `sandbox="allow-scripts"` without `allow-same-origin`. Strict CSP via `<meta>` tag. postMessage bridge for editor↔preview communication. No eval, no filesystem access.                                                                          |
| 10  | **OpenSpec pipeline**       | 3-phase simplified                   | Full SDD 8-phase           | **3-phase**                | entender (parse intent, ask clarifying) → construir (generate files, write to disk) → verificar (lint output, show preview, offer fixes). User sees only: describe → code → preview. Pipeline is agent prompt templates, not independent agents. |
| 11  | **Learning layer**          | Event-driven triggers                | Polling/intervals          | **Event-driven**           | Code events (file created, element added, function written) trigger `¿Sabías que...?` tips from a static Spanish dictionary keyed by concept. Zustand `learningStore` tracks shown tips to avoid repetition.                                     |
| 12  | **Auth**                    | Opita Code SSO (OAuth 2.0/OIDC)      | Custom email/password      | **Opita Code SSO**         | Centralized identity. Token stored in SQLite via tauri-plugin-sql. Session persists across restarts. Google OAuth for easy onboarding.                                                                                                           |
| 13  | **BYOK key storage**        | SQLite + AES encryption              | Plaintext config           | **SQLite + AES**           | API keys encrypted at rest using Web Crypto API (AES-GCM). Key derived from machine-specific salt. Stored in SQLite, never in plaintext files.                                                                                                   |
| 14  | **File watcher**            | Tauri fs plugin watch                | Polling                    | **Tauri fs watch**         | `@tauri-apps/plugin-fs` supports `watch()` — events pushed to frontend via Tauri events (the only event-based IPC). Triggers preview refresh and editor tab updates.                                                                             |
| 15  | **Auto-update**             | tauri-plugin-updater                 | Manual download            | **tauri-plugin-updater**   | Official plugin checks GitHub Releases for `.msi` updates. Silent download + install on next launch.                                                                                                                                             |
| 16  | **Styling**                 | Tailwind CSS + CSS modules           | Styled-components          | **Tailwind + CSS modules** | Zero runtime cost, fast in WebView2, good developer experience. CSS modules for component-specific overrides.                                                                                                                                    |

---

## Data Flow

### Vibe-Coding Loop (main flow)

```
User types Spanish prompt
        │
        ▼
┌──────────────────┐
│   Chat Store     │  append user message, set loading
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Provider Router  │  select provider (DeepSeek default, fallback Gemini, BYOK if configured)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ OpenSpec Pipeline │  entender: parse intent → construir: stream code chunks → verificar: validate
│ (prompt templates)│
└──────┬───────────┘
       │ SSE stream
       ▼
┌──────────────────┐
│  AIProvider      │  chat() async generator → yield ChatChunk { type: 'text'|'code'|'file' }
└──────┬───────────┘
       │
       ├──→ Chat Panel: render markdown + syntax-highlighted code blocks (react-markdown)
       │
       ├──→ File System: IPC command write_file(path, content) via Tauri fs plugin
       │       │
       │       └──→ File Watcher event → Editor opens/updates file tab
       │
       ├──→ Token Counter: countTokens() → update usageStore (prompts used/remaining)
       │
       └──→ Live Preview: if HTML/CSS/JS changed → postMessage to sandboxed iframe → reload
```

### Learning Tip Trigger Flow

```
Code event (file created, CSS class added)
        │
        ▼
┌──────────────────┐
│ Learning Store   │  match event type → lookup tip dictionary
└──────┬───────────┘
       │
       ▼
  ┌─────────┐
  │ Tip shown│  "¿Sabías que... flexbox organiza elementos en filas y columnas?"
  └─────────┘
  marked as shown → won't repeat tip for same concept
```

### Auth Flow

```
App launch → check SQLite for stored session token
  ├── Valid token: restore session, fetch user profile
  └── No token: show login screen
        │
        ▼
  Opita Code SSO (OAuth 2.0/OIDC)
  ├── Email/password → JWT token
  └── Google OAuth → redirect → callback → JWT token
        │
        ▼
  Store token in SQLite (encrypted) → Zustand authStore updated
```

---

## File Changes

| File                                        | Action | Description                                                                                  |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `src-tauri/src/main.rs`                     | Create | Entry point: register plugins (fs, shell, dialog, sql, updater, tray), invoke handlers       |
| `src-tauri/src/commands/fs.rs`              | Create | IPC handlers: read_file, write_file, list_dir, create_dir, delete                            |
| `src-tauri/src/commands/shell.rs`           | Create | IPC handlers: execute shell command, return output                                           |
| `src-tauri/src/commands/project.rs`         | Create | IPC handlers: open_folder dialog, validate project structure                                 |
| `src-tauri/src/auth/mod.rs`                 | Create | Opita Code SSO client: token exchange, refresh, verify                                       |
| `src-tauri/src/db/mod.rs`                   | Create | SQLite initialization, migrations, encrypted key-value store                                 |
| `src-tauri/tauri.conf.json`                 | Create | Window config (3 resizable panels), plugins, permissions, CSP                                |
| `src-tauri/Cargo.toml`                      | Create | Rust dependencies: tauri 2.x, plugins, serde, rusqlite                                       |
| `src/main.tsx`                              | Create | React entry point, Zustand provider, Monaco loader                                           |
| `src/App.tsx`                               | Create | Root layout: sidebar (file tree) + editor panel + preview panel + chat overlay               |
| `src/components/chat/ChatPanel.tsx`         | Create | Message list, streaming markdown rendering, input area                                       |
| `src/components/chat/MessageBubble.tsx`     | Create | Single message: user/AI, markdown + code blocks                                              |
| `src/components/editor/EditorPanel.tsx`     | Create | Monaco editor wrapper, file tabs, save indicator                                             |
| `src/components/editor/FileTabs.tsx`        | Create | Open file tabs with unsaved indicators, close button                                         |
| `src/components/preview/PreviewPanel.tsx`   | Create | Sandboxed iframe, postMessage bridge, reload trigger                                         |
| `src/components/file-tree/FileTree.tsx`     | Create | Recursive file tree, context menu (create/delete/rename)                                     |
| `src/components/terminal/TerminalPanel.tsx` | Create | Xterm.js wrapper, command input, Spanish-translated output                                   |
| `src/components/learning/LearningTip.tsx`   | Create | Toast/notification with "¿Sabías que...?" tip                                                |
| `src/stores/project.ts`                     | Create | Zustand store: currentProject, files, openTabs                                               |
| `src/stores/chat.ts`                        | Create | Zustand store: messages, streamingState, activeProvider                                      |
| `src/stores/learning.ts`                    | Create | Zustand store: shownTips, tipQueue, learningEvents                                           |
| `src/stores/auth.ts`                        | Create | Zustand store: user, session, plan, tokenUsage                                               |
| `src/providers/base.ts`                     | Create | AIProvider interface, ProviderRouter, token counter                                          |
| `src/providers/deepseek.ts`                 | Create | DeepSeek V3 adapter: API client, streaming, token count                                      |
| `src/providers/gemini.ts`                   | Create | Gemini Flash adapter: API client, streaming, token count                                     |
| `src/providers/byok.ts`                     | Create | BYOK adapter: multi-provider (OpenAI, Anthropic, OpenRouter)                                 |
| `src/openspec/entender.ts`                  | Create | Phase 1 prompt template: parse intent, ask clarifying questions                              |
| `src/openspec/construir.ts`                 | Create | Phase 2 prompt template: generate files with system prompt for file creation markers         |
| `src/openspec/verificar.ts`                 | Create | Phase 3 prompt template: validate output, suggest fixes                                      |
| `src/lib/types.ts`                          | Create | Shared types: Message, ChatChunk, FileNode, AIModel, UserPlan                                |
| `src/lib/tips.ts`                           | Create | Static Spanish tip dictionary: concept → question, explanation                               |
| `tests/providers/deepseek.test.ts`          | Create | Unit: adapter interface compliance, streaming, token counting                                |
| `tests/providers/router.test.ts`            | Create | Unit: provider selection logic, fallback behavior                                            |
| `tests/stores/chat.test.ts`                 | Create | Unit: message management, streaming append                                                   |
| `tests/stores/project.test.ts`              | Create | Unit: file operations, tab management                                                        |
| `tests/openspec/pipeline.test.ts`           | Create | Unit: prompt templates, output parsing                                                       |
| `package.json`                              | Modify | Add dependencies: react, zustand, @tauri-apps/api, @monaco-editor/react, vitest, tailwindcss |

---

## Interfaces / Contracts

```typescript
// AI Provider (src/providers/base.ts)
interface AIProvider {
  id: string;
  name: string;
  tier: "free" | "byok" | "opita";
  chat(messages: Message[], options: ChatOptions): AsyncGenerator<ChatChunk>;
  countTokens(messages: Message[]): number;
  validateKey?(key: string): Promise<boolean>;
}

interface ChatChunk {
  type: "text" | "code" | "file_create" | "file_update" | "done" | "error";
  content: string;
  language?: string;
  filePath?: string;
}

// IPC Commands (Tauri → Frontend contract)
type IpcCommands = {
  read_file: (path: string) => Promise<string>;
  write_file: (path: string, content: string) => Promise<void>;
  list_dir: (path: string) => Promise<FileNode[]>;
  create_dir: (path: string) => Promise<void>;
  delete_entry: (path: string) => Promise<void>;
  exec_shell: (cmd: string, cwd: string) => Promise<{ stdout: string; stderr: string }>;
  open_folder_dialog: () => Promise<string | null>;
  get_auth_token: () => Promise<string | null>;
  set_auth_token: (token: string) => Promise<void>;
  get_config: (key: string) => Promise<string | null>;
  set_config: (key: string, value: string) => Promise<void>;
};

// Zustand stores shape
interface ProjectStore {
  rootPath: string | null;
  files: FileNode[];
  openTabs: string[];
  activeTab: string | null;
  isDirty: Record<string, boolean>;
}

interface ChatStore {
  messages: Message[];
  isStreaming: boolean;
  activeProvider: string;
  pipelinePhase: "entender" | "construir" | "verificar" | null;
}
```

---

## Testing Strategy

| Layer           | What to Test                                               | Approach                                                         |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| **Unit**        | Provider adapters (streaming, token count, key validation) | vitest + MSW (mock API responses)                                |
| **Unit**        | Zustand stores (state transitions, selectors)              | vitest, no DOM needed                                            |
| **Unit**        | OpenSpec prompt templates (output parsing, file markers)   | vitest, snapshot templates                                       |
| **Unit**        | Tip dictionary (lookup correctness, Spanish quality)       | vitest, static data                                              |
| **Integration** | IPC commands (file ops, shell)                             | vitest + Tauri mock API                                          |
| **Integration** | Provider router (selection logic, fallback)                | vitest, mock providers                                           |
| **Integration** | Chat + Pipeline + File System end-to-end                   | vitest, mock AI responses                                        |
| **E2E**         | Full vibe-coding loop (describe → code → preview)          | Manual + future Playwright/WebDriver                             |
| **Security**    | Live preview sandbox escape attempts                       | Manual test checklist: filesystem, network, eval, infinite loops |

---

## Migration / Rollout

No migration required — greenfield project. Rollout plan:

1. **Alpha** (internal): Tauri scaffold + Monaco + chat with DeepSeek — validate architecture
2. **Beta** (50 students): Full MVP with auth, file system, preview — validate product-market fit
3. **v1.0** (public): Windows installer via GitHub Releases + auto-updater

Rollbacks: if Tauri v2 has critical Windows issues, fallback to Electron. All provider adapters can be feature-flagged off individually. No database migrations to reverse.

---

## Open Questions

- [ ] **Spanish AI benchmark results** — need real data on DeepSeek V3 vs Gemini Flash code quality in Spanish before finalizing default provider
- [ ] **Opita Code SSO endpoint** — exact OAuth 2.0 endpoints and token format needed for auth implementation
- [ ] **Cost model validation** — spreadsheet with projected user growth × token costs before launch; determines rate limits
- [ ] **Tauri v2 plugin-fs watch() stability on Windows** — need to test watcher reliability with rapid file changes (AI writing multiple files)
- [ ] **BYOK provider list** — initial set: OpenAI, Anthropic, OpenRouter. Should Groq/Cohere be included in MVP?
