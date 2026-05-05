# Proposal: Vibe-Studio MVP

## Intent

Colombian university students (~2.4M) want to build software but face two barriers: all AI coding tools are English-only and priced at $20–100 USD/mo — 6–8× the Colombian minimum wage. Vibe-Studio MVP fills this gap: a Spanish-native, Windows-native vibe-coding desktop app with a baked-in learning layer, priced at 11,900 COP/mo (~$3 USD). The MVP proves the core loop: describe in Spanish → AI generates code → see it working in live preview → learn without realizing it.

## Scope

### In Scope (MVP v1.0)

- Desktop app shell: Tauri v2, window management, system tray
- Chat assistant: AI streaming, markdown + code blocks, Spanish-first
- Code editor: Monaco, syntax highlighting, file tabs, HTML/CSS/JS only
- File system: open folder, file tree, create/edit/delete (Tauri fs plugin)
- Live preview: sandboxed iframe with strict CSP, postMessage bridge
- AI providers: DeepSeek V3 (free default), Gemini Flash (fallback), BYOK router
- Simplified OpenSpec pipeline: entender → construir → verificar (invisible to user)
- Learning tips: "¿Sabías que...?" contextual micro-explanations
- Terminal: basic shell with Spanish-translated command output
- Auth: Opita Code SSO (email/password + Google OAuth)
- Token display: prompts used/remaining, simple counter
- BYOK config: add/manage own API keys for any provider

### Out of Scope

- Ollama/local models, WebLLM (v2)
- Badges, "Modo mostrame", concept unlocking (v1.1)
- GitHub sync (v1.1)
- Multi-language beyond HTML/CSS/JS (post-MVP)
- Creador/Pro/Universidad plans (Free + Estudiante only at launch)
- Knowledge garden, LMS integration, collaboration (v2)
- Multi-agent orchestration, vault, community plugins (Opita Studio domain)

## Capabilities

### New Capabilities

- `desktop-shell`: Tauri v2 app shell, windows, system tray, IPC bridge
- `chat-assistant`: AI conversation, SSE streaming, markdown rendering, context management
- `code-editor`: Monaco integration, file tabs, syntax highlighting, create/save
- `file-system`: Folder open dialog, file tree component, CRUD via Tauri fs plugin
- `live-preview`: Sandboxed HTML/CSS/JS rendering, CSP enforcement, postMessage API
- `ai-providers`: Adapter pattern (AIProvider interface), DeepSeek, Gemini, BYOK, token counting, streaming
- `openspec-pipeline`: entender (understand intent) → construir (generate code) → verificar (validate) workflow
- `learning-layer`: Contextual Spanish tips triggered by code events
- `terminal`: Shell command execution, Spanish-translated output
- `auth`: Opita Code SSO login, registration, session persistence via SQLite
- `token-usage`: Per-user prompt counter, rate limiting, display
- `byok-config`: API key CRUD, provider selection, key validation

### Modified Capabilities

None — greenfield project.

## Approach

**Stack**: Tauri v2 (Rust backend) + React 18 + TypeScript + Zustand + Monaco Editor + SQLite + Vite.

**Architecture**: Rust handles filesystem, shell, auth, SQLite via official Tauri plugins. React renders in WebView2. IPC bridge connects them. AI providers use adapter pattern: `AIProvider` interface with `chat()` async generator for streaming. OpenSpec pipeline runs invisibly — user sees: describe intent → code appears → preview works. Zustand for state (project, chat, learning stores).

**Build Phases**: (1) Infrastructure: Tauri scaffold, Vite, Monaco, Zustand, vitest. (2) Core loop: Chat + Editor + Preview panel wiring. (3) AI layer: provider adapters, streaming, token counting. (4) Auth + BYOK config. (5) Learning tips + terminal. (6) Polish, testing, Windows installer.

## Affected Areas

| Area              | Impact | Description                                                      |
| ----------------- | ------ | ---------------------------------------------------------------- |
| `src-tauri/`      | New    | Rust backend: main.rs, IPC commands, plugin config               |
| `src/`            | New    | React frontend: components, stores, providers, openspec pipeline |
| `tests/`          | New    | vitest suites for providers, stores, components                  |
| `openspec/specs/` | New    | 12 capability specs created                                      |

## Risks

| Risk                               | Likelihood | Mitigation                                                                    |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Students don't adopt vibe-coding   | Medium     | Beta with 50 students BEFORE building; Figma prototype validation             |
| AI costs outpace free tier revenue | Medium     | DeepSeek (cheapest) default; hard rate limits; cost-per-user monitoring       |
| Spanish AI quality is poor         | Medium     | Pre-build benchmark: 100 Spanish prompts; prompt engineering; model selection |
| Live preview sandbox escape        | Low        | Strict CSP, no `allow-same-origin`, content security headers                  |
| Monaco impacts startup time        | Low        | Lazy-load; 5MB acceptable in desktop context                                  |

## Rollback Plan

If vibe-coding doesn't resonate with students: pivot to "Opita Learn" — Spanish-native coding tutorials using same AI infra (chat + editor + preview reusable). If Tauri v2 has critical Windows bugs: fallback to Electron (heavier but proven). If AI costs unsustainable: remove free tier, move to BYOK-only with Opita-provided token credits.

## Dependencies

- Tauri v2 + official plugins (fs, shell, dialog, sql, updater)
- DeepSeek API + Gemini Flash API (free tier models)
- Opita Code SSO service (OAuth 2.0/OIDC)
- Colombian payment processor (Wompi/PayU/MercadoPago) for Estudiante plan
- Windows 10/11 build runners (GitHub Actions)

## Success Criteria

- [ ] Student completes full vibe-coding loop in Spanish: describe project → code generated → live preview works — without reading English
- [ ] AI generates correct HTML/CSS/JS on >70% of basic prompts (landing page, form, portfolio)
- [ ] App launches on Windows 10/11 in <3s cold, <1.5s warm
- [ ] Free tier sustains 30 prompts/user/mo within cost margin
- [ ] 15+ of 20 beta students say "lo usaría" (I would use it)
- [ ] Auth login completes in <2s; session persists across app restarts
- [ ] Live preview sandbox passes all escape-attempt tests (filesystem access, network, infinite loops)
