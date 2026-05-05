# Exploration: Vibe-Studio MVP

**Date**: 2026-05-04
**Phase**: Explore
**Status**: Complete
**Author**: SDD explore agent

---

## 1. Current State

Greenfield project. Zero code exists beyond `package.json` (stock `npm init`). The `openspec/` structure and `AGENTS.md` are configured and ready. The project vision and strategic direction have been defined in prior strategic discussion but no technical or market validation has been performed.

**Stack declared** (AGENTS.md):

- Tauri v2 + React + TypeScript
- Windows native via WebView2
- Node.js ESM tooling
- vitest (planned, not installed)

---

## 2. Affected Areas

N/A — greenfield. All areas will be created from scratch. The architecture will establish the foundation for all future modules.

---

## 3. Market Fit Analysis

### 3.1 Target Market Validation

| Factor                 | Assessment                                                                                                                                                                     | Rating     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Addressable market** | ~2.4M university students in Colombia (2024). Growing tech enrollment.                                                                                                         | ⭐⭐⭐⭐   |
| **Price sensitivity**  | Colombian minimum wage ~1,423,500 COP/mo. Competitors charge $20-25 USD (~80,000-100,000 COP). Vibe-Studio Estudiante at 11,900 COP = 0.8% of minimum wage.                    | ⭐⭐⭐⭐⭐ |
| **Language gap**       | **Zero** competitors offer Spanish-native AI coding tools. All are English-first. This is the single biggest differentiator.                                                   | ⭐⭐⭐⭐⭐ |
| **Windows dominance**  | ~85%+ of Colombian students use Windows. Tauri + WebView2 is the right choice.                                                                                                 | ⭐⭐⭐⭐   |
| **Learning demand**    | Colombian universities are rapidly adopting programming courses, but tools are English-only. Students struggle with the language barrier before they even struggle with logic. | ⭐⭐⭐⭐⭐ |
| **Cultural fit**       | "Aprendé sin darte cuenta" (learn without realizing it) maps perfectly to the Colombian informal learning culture. The "voseo" in the tagline is authentic Colombian Spanish.  | ⭐⭐⭐⭐   |

### 3.2 Competitive Pricing Comparison

| Competitor                 | Entry Price (USD)          | Est. COP Equivalent   | Vibe-Studio vs.                     |
| -------------------------- | -------------------------- | --------------------- | ----------------------------------- |
| Cursor Pro                 | $20/mo                     | ~80,000 COP           | **6.7x more expensive**             |
| Windsurf Pro               | $20/mo                     | ~80,000 COP           | **6.7x more expensive**             |
| Bolt.new Pro               | $25/mo                     | ~100,000 COP          | **8.4x more expensive**             |
| Lovable Pro                | $25/mo                     | ~100,000 COP          | **8.4x more expensive**             |
| Replit Core                | $25/mo                     | ~100,000 COP          | **8.4x more expensive**             |
| GitHub Copilot             | $10/mo (free for students) | ~40,000 COP (or free) | **Copilot Free is the real threat** |
| **Vibe-Studio Estudiante** | **~$3/mo (11,900 COP)**    | **11,900 COP**        | —                                   |

> **Key insight**: GitHub Copilot is free for verified students via GitHub Student Pack. This is the most direct threat in the "free AI coding tool" space. However, Copilot requires knowing how to code. Vibe-Studio targets students who CAN'T code yet. Different user, different need.

### 3.3 Colombian Student Economic Reality

- Monthly student budget: ~500,000 - 800,000 COP (transport, food, materials)
- 11,900 COP = approximately **one lunch** or **two bus fares** in most Colombian cities
- Semester pack (4 months = 39,900 COP) = ~10,000 COP/mo — even more accessible
- Annual (99,900 COP) = ~8,325 COP/mo
- **Universidad plan at 5,990 COP/student/mo** is priced for institutional budgets
- Colombian universities pay 50,000-200,000 COP/student/year for software licenses (Microsoft, Matlab, etc.). 5,990 COP/mo = 71,880 COP/year — competitive.

### 3.4 The "Why Now" Factor

1. **Vibe-coding is trending** — Bolt.new, Lovable, Replit Agent are normalizing the concept globally
2. **Spanish AI is underserved** — models are improving in Spanish but NO tool wraps them for Spanish-native coding
3. **Colombia's tech ecosystem is growing** — Medellín, Bogotá, Cali are becoming tech hubs; universities need tools
4. **Post-pandemic digital adoption** — students are comfortable with digital tools; online learning is normalized
5. **BYOK democratization** — DeepSeek, Gemini Flash, and OpenRouter make API access cheap enough for a free tier

### 3.5 Market Fit Verdict

**STRONG FIT** — with one caveat: the "vibe-coding for beginners" concept needs field validation. Do Colombian students who DON'T know how to code WANT to build software? The hypothesis is yes (they see peers doing it, they need projects for class, they want portfolios), but this MUST be validated with real users before heavy investment.

---

## 4. Technical Feasibility

### 4.1 Tauri v2 Capability Assessment

| Required Capability                                         | Tauri v2 Support     | Method                               | Risk                     |
| ----------------------------------------------------------- | -------------------- | ------------------------------------ | ------------------------ |
| **File system access** (read/write files, list directories) | ✅ Native            | `@tauri-apps/plugin-fs`              | Low                      |
| **Folder open dialog**                                      | ✅ Native            | `@tauri-apps/plugin-dialog`          | Low                      |
| **Shell command execution**                                 | ✅ Native            | `@tauri-apps/plugin-shell` + sidecar | Low                      |
| **Monaco editor integration**                               | ✅ Works in WebView  | Load as React component              | Low                      |
| **AI streaming (SSE/WebSocket)**                            | ✅ WebView2 supports | Standard fetch/EventSource           | Medium                   |
| **Live preview (HTML sandbox)**                             | ✅ iframe in WebView | Sandboxed iframe + postMessage       | Medium                   |
| **Window customization**                                    | ✅ Native            | `tauri.conf.json` WindowConfig       | Low                      |
| **Multiple windows**                                        | ✅ Native            | Multi-window config                  | Low                      |
| **System tray**                                             | ✅ Plugin            | `tauri-plugin-tray`                  | Low                      |
| **Auto-updater**                                            | ✅ Plugin            | `tauri-plugin-updater`               | Low                      |
| **Local model (Ollama)**                                    | ✅ Sidecar or HTTP   | Subprocess or REST API               | High (user installation) |
| **Local model (WebLLM)**                                    | ⚠️ WebAssembly       | Load in WebView                      | High (RAM, perf)         |
| **SQLite (local DB)**                                       | ✅ Plugin            | `tauri-plugin-sql`                   | Low                      |
| **Git operations**                                          | ⚠️ Via shell or lib  | Shell `git` or `isomorphic-git`      | Medium                   |
| **Process management**                                      | ✅ Native            | `tauri::process`                     | Low                      |

### 4.2 Frontend Stack Feasibility

| Component              | Technology                                    | Rationale                                                      |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| **UI Framework**       | React 18+ with TypeScript                     | Most documented Tauri integration, large ecosystem             |
| **Bundler**            | Vite                                          | Fast HMR, excellent Tauri integration via `@tauri-apps/cli`    |
| **Code Editor**        | Monaco Editor (`@monaco-editor/react`)        | Battle-tested, VS Code quality, supports 60+ languages         |
| **State Management**   | Zustand                                       | Lightweight (<1KB), no boilerplate, works perfectly with React |
| **Styling**            | Tailwind CSS or vanilla CSS modules           | Lightweight, no runtime cost, good for desktop apps            |
| **AI Client**          | Custom adapter layer                          | Need to support multiple providers with different APIs         |
| **Markdown Rendering** | `react-markdown` + `react-syntax-highlighter` | For chat messages with code blocks                             |
| **File Tree**          | Custom component using Tauri fs plugin        | Must be native-feeling and fast                                |
| **Testing**            | vitest                                        | Configured per AGENTS.md; fast, native ESM support             |

### 4.3 Key Technical Risks

1. **AI streaming stability** (Medium): WebView2's SSE implementation may have quirks with long-lived connections. Mitigation: test early with real API calls. Fallback: polling-based approach.

2. **Live preview sandboxing** (High): Executing user/AI-generated HTML/CSS/JS safely within a desktop app. Must prevent filesystem access, network calls to malicious endpoints, and infinite loops. Mitigation: sandboxed iframe with strict CSP, content security policies, and no `allow-same-origin`.

3. **Ollama onboarding friction** (High): Installing Ollama on Windows requires downloading an installer, running it, pulling models. This is already too technical for the target user. Mitigation: defer local models to v2, build a guided setup wizard, or use WebLLM (WebGPU) for small models that download automatically.

4. **Monaco editor bundle size** (Medium): Monaco is ~5MB gzipped. In a desktop app this matters less than web, but it impacts initial load. Mitigation: lazy-load Monaco, use `@monaco-editor/react` which handles this.

5. **Build pipeline complexity** (Medium): Tauri v2 requires Rust toolchain on CI. Windows builds need Windows runners. Cross-compilation not realistic. Mitigation: GitHub Actions with Windows runners.

6. **AI provider costs at scale** (High): Free tier runs on DeepSeek V3 and Gemini Flash. Both cost money per token. At 30 prompts/user/mo × N users, costs scale linearly. Mitigation: aggressive token caching, prompt compression, negotiated API discounts, smart model routing (route simple queries to cheaper models).

### 4.4 Technical Feasibility Verdict

**HIGH FEASIBILITY** — Tauri v2 provides every capability needed for the MVP. The stack is mature and well-documented. The main technical challenges are AI streaming stability, live preview sandboxing, and cost management at scale — all solvable with known patterns.

---

## 5. Scope Boundaries

### 5.1 MVP (v1.0) — "The Minimum Lovable Product"

These features MUST ship in v1.0:

| #   | Feature                                                                        | Why MVP                         | Effort |
| --- | ------------------------------------------------------------------------------ | ------------------------------- | ------ |
| 1   | **Desktop app shell** — launch, window management, system tray                 | Cannot exist without this       | Medium |
| 2   | **Chat assistant** — conversation with AI, markdown rendering, code blocks     | Core vibe-coding loop           | High   |
| 3   | **Simplified code editor** — Monaco with syntax highlighting, file tabs        | Must write code somewhere       | High   |
| 4   | **File system integration** — open folder, file tree, create/edit/delete files | One project = one folder        | Medium |
| 5   | **Live preview** — render HTML/CSS/JS output in sandboxed pane                 | See what you build              | High   |
| 6   | **AI provider layer** — DeepSeek V3 (free), Gemini Flash (free), BYOK          | Three-model strategy            | High   |
| 7   | **Simplified OpenSpec pipeline** — entender → construir → verificar (3 phases) | Invisible governance            | Medium |
| 8   | **Basic learning tips** — "¿Sabías que...?" contextual micro-explanations      | Learning layer, bare minimum    | Low    |
| 9   | **Simplified terminal** — Spanish-translated command output                    | Lower the barrier               | Low    |
| 10  | **Opita Code authentication** — login, registration, session                   | User identity, plan management  | Medium |
| 11  | **Token usage display** — simple counter showing prompts used/remaining        | Transparency, trust             | Low    |
| 12  | **BYOK configuration** — add your own API keys for any provider                | Differentiator, free tier value | Low    |

**MVP Total Effort Estimate**: 8-12 weeks (2 developers full-time, assuming React + Tauri experience).

### 5.2 Post-MVP (v1.1) — "The Learning Layer"

These features are HIGH VALUE but can wait:

| #   | Feature                                                                  | Why Post-MVP                                   |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| 1   | **"Modo mostrame"** — line-by-line code explanation in Colombian Spanish | Complex NLP; needs real usage data to tune     |
| 2   | **Badges system** — "¡Usaste tu primer loop!", "¡Creaste una función!"   | Needs event tracking infrastructure            |
| 3   | **GitHub sync** — push projects to GitHub for portfolio                  | External dependency, auth complexity           |
| 4   | **Assignment templates** — API REST, CRUD, landing page, portfolio       | Needs prompt template system                   |
| 5   | **Token usage dashboard** — detailed analytics                           | Depends on usage data infrastructure           |
| 6   | **Concept unlocking** — variables → functions → loops → objects → APIs   | Needs curriculum design; complex state machine |
| 7   | **"No me des la respuesta" toggle** — AI gives hints, not solutions      | Requires prompt engineering and model routing  |

### 5.3 v2.0 — "The Ecosystem"

These are for future releases:

| #   | Feature                                                              | Why v2                                         |
| --- | -------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **Ollama / local model support** — offline vibe-coding               | Complex onboarding, model management           |
| 2   | **Knowledge garden visualization**                                   | Pure UX innovation; needs design iteration     |
| 3   | **"Repaso antes del examen"** — reviews projects, quizzes concepts   | Needs concept extraction from code; complex AI |
| 4   | **"Traducir a código de clase"** — adapt output to professor's style | Requires professor-specific training data      |
| 5   | **LMS integration** — Moodle, Canvas, Blackboard                     | External APIs, institution-by-institution      |
| 6   | **Universidad dashboard** — B2B: professor views, class management   | Enterprise features, role management           |
| 7   | **Collaboration** — real-time pair vibe-coding                       | Significant complexity (CRDT, WebRTC)          |
| 8   | **Semester packs & institutional billing**                           | Payment infrastructure, invoicing              |
| 9   | **WebLLM integration** — browser-based local models                  | Technology maturity (WebGPU adoption)          |

### 5.4 What It Should NOT Have (by design)

These are intentionally excluded — they belong to Opita Studio, not Vibe-Studio:

- ❌ Multi-agent orchestration
- ❌ Advanced model/provider configuration (beyond 5 choices)
- ❌ Knowledge store / persistent project memory
- ❌ Conflict resolution between AI agents
- ❌ Vault encryption
- ❌ Community plugins (read-only reference at most)
- ❌ Multi-workspace (one project = one folder, always)
- ❌ Self-hosting / on-prem deployment
- ❌ Complex build pipelines
- ❌ Database management tools
- ❌ Docker/devcontainer support

---

## 6. Competitive Landscape

### 6.1 Direct Competitors (AI Coding Tools)

| Dimension            | Cursor          | Windsurf     | Bolt.new        | Lovable         | Replit            | **Vibe-Studio**                 |
| -------------------- | --------------- | ------------ | --------------- | --------------- | ----------------- | ------------------------------- |
| **Category**         | AI IDE          | AI IDE       | AI Web Builder  | AI Web Builder  | AI Web IDE        | AI Desktop App                  |
| **Platform**         | Electron        | Electron     | Web             | Web             | Web               | **Tauri (native)**              |
| **User**             | Developers      | Developers   | Non-devs + Devs | Non-devs + Devs | Non-devs + Devs   | **Students (beginners)**        |
| **Language**         | English         | English      | English         | English         | English           | **🇨🇴 Spanish native**           |
| **Free tier**        | Hobby (limited) | Free (light) | 1M tokens/mo    | Free (limited)  | Starter (limited) | **Free (30 prompts/mo + BYOK)** |
| **Entry price**      | $20/mo          | $20/mo       | $25/mo          | $25/mo          | $25/mo            | **~$3/mo (11,900 COP)**         |
| **Learning**         | ❌              | ❌           | ❌              | ❌              | ❌                | **✅ Core feature**             |
| **BYOK in free**     | ❌              | ❌           | N/A             | N/A             | N/A               | **✅ Yes**                      |
| **Own models**       | ❌              | SWE-1.5      | ❌              | ❌              | ❌                | **✅ Opita models**             |
| **Student discount** | ❌              | ❌           | ✅ 50%          | ✅ 50%          | ❌                | **✅ Native student tiers**     |
| **Offline**          | ❌              | ❌           | ❌              | ❌              | ❌                | **✅ Future (v2)**              |
| **GitHub sync**      | ✅ Built-in     | ✅ Built-in  | ❌              | ❌              | ✅                | **Post-MVP (v1.1)**             |
| **Windows focus**    | ✅              | ✅           | Web             | Web             | Web               | **✅ Primary target**           |

### 6.2 Indirect Competitors

| Competitor                             | Threat Level | Why                                                                                                                   |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| **GitHub Copilot (free for students)** | ⚠️ HIGH      | Free, integrated in VS Code, powerful. But: requires knowing how to code. Different user segment.                     |
| **ChatGPT / Claude (free tier)**       | ⚠️ MEDIUM    | Students already use these for homework help. But: no code execution, no project management, no Spanish optimization. |
| **YouTube tutorials (Spanish)**        | 🟢 LOW       | Always the default learning path. But: passive, not interactive, no live building.                                    |
| **Platzi / CódigoFacilito**            | 🟢 LOW       | Colombian edtech, strong brand. But: courses, not tools. Complementary, not competitive.                              |

### 6.3 Competitive Moats

1. **Spanish-native AI coding** — no competitor is doing this. The moat is language + cultural understanding.
2. **Colombian pricing** — $3/mo vs $20/mo. Competitors can't match this without local operations.
3. **"Invisible learning"** — no AI coding tool teaches. Vibe-Studio is an educational tool disguised as a coding tool.
4. **Windows-native desktop** — Tauri gives better performance, smaller footprint, and native feel vs Electron/web.
5. **Own fine-tuned models** — Opita Coder, Opita Tutor, Opita Architect trained on Spanish code patterns. Competitors use generic models.
6. **BYOK in all plans** — competitors restrict bring-your-own-key to paid tiers. Vibe-Studio gives it to free users.

### 6.4 Competitive Landscape Verdict

**DEFENSIBLE POSITION** — The combination of Spanish-native, Colombian pricing, learning layer, and Windows desktop creates a unique offering that no competitor currently serves. The main risk is GitHub Copilot's free student offering, but it serves a DIFFERENT USER (those who already code) and a DIFFERENT NEED (productivity, not learning).

---

## 7. Risk Assessment

### 7.1 Critical Risks (Could Kill the Project)

| #   | Risk                                                                                      | Impact    | Likelihood | Mitigation                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Students don't adopt vibe-coding** — the concept is too foreign for the target audience | 🔴 Fatal  | 🟡 Medium  | Run a beta with 50 students before building. Validate that beginners WANT to build things they don't know how to build.                               |
| R2  | **AI costs outpace revenue** — free tier users generate more cost than expected           | 🔴 Fatal  | 🟡 Medium  | Aggressive token optimization. Use DeepSeek (cheapest) as default. Implement hard rate limits. Monitor cost per user daily.                           |
| R3  | **GitHub Copilot free for students** — students choose Copilot over Vibe-Studio           | 🟠 Severe | 🟢 High    | Differentiate on "no necesitás saber programar" (you don't need to know how to code). Position as learning tool, not productivity tool.               |
| R4  | **Spanish AI quality is poor** — models generate broken Spanish code/advice               | 🟠 Severe | 🟡 Medium  | Fine-tune Opita models specifically for Spanish code generation. Use prompt engineering to improve output. Show warnings when output is likely wrong. |
| R5  | **Tauri v2 instability or breaking changes on Windows**                                   | 🟠 Severe | 🟢 Low     | Tauri v2 is stable (v2.0 released). Pin dependencies. Test on Windows 10 and 11.                                                                      |

### 7.2 Moderate Risks

| #   | Risk                                                                          | Impact      | Likelihood | Mitigation                                                                                            |
| --- | ----------------------------------------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| R6  | **Ollama/local model installation too complex for beginners**                 | 🟡 Moderate | 🟢 High    | Defer to v2. Build wizard that handles installation automatically. Start with WebLLM for tiny models. |
| R7  | **Internet dependency alienates users with poor connectivity**                | 🟡 Moderate | 🟡 Medium  | Cache aggressively. Offline mode for editing without AI. Local models in v2.                          |
| R8  | **Support burden overwhelms small team** — beginners have many questions      | 🟡 Moderate | 🟢 High    | Invest in in-app help ("Modo mostrame"). Build FAQ. Use AI to answer common questions.                |
| R9  | **Payment processing in Colombia** — limited options, high fees               | 🟡 Moderate | 🟡 Medium  | Wompi, PayU, or MercadoPago for local payments. PSE (Colombian debit) is essential.                   |
| R10 | **Monaco editor feels slow on low-end hardware** — many students have old PCs | 🟡 Moderate | 🟡 Medium  | Lazy-load. Disable heavy features by default. Offer "modo ligero" (lighter editor).                   |

### 7.3 Low Risks

| #   | Risk                                        | Impact | Likelihood                                                  |
| --- | ------------------------------------------- | ------ | ----------------------------------------------------------- |
| R11 | Windows 7/8 users not supported by WebView2 | 🟢 Low | 🟢 Low (most students on Win 10/11)                         |
| R12 | Competitor copies the concept               | 🟢 Low | 🟢 Low (Spanish market is too small for them to prioritize) |
| R13 | Regulatory issues with AI in education      | 🟢 Low | 🟢 Low (Colombia is AI-friendly)                            |

### 7.4 Top 3 Risks to Address Before Building

1. **Validate demand** — talk to 20 Colombian university students. Show them a Figma prototype. Ask: "Would you use this?" Do NOT build until this is validated.
2. **Model AI costs** — run a spreadsheet model: 100 free users × 30 prompts × avg tokens per prompt × cost per token. Determine break-even point.
3. **Test Spanish AI quality** — run 100 coding prompts in Spanish through DeepSeek V3, Gemini Flash, and GPT-4o-mini. Measure: correct code rate, Spanish quality, explanation quality.

---

## 8. Architecture Approach

### 8.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    VIBE-STUDIO DESKTOP APP                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              TAURI v2 RUST BACKEND                │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │   │
│  │  │ File Ops │ │  Shell   │ │ Process Manager  │ │   │
│  │  │ (fs,path)│ │ (git,npm)│ │ (sidecar,Ollama) │ │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │   │
│  │  │  SQLite  │ │  Config  │ │   Auth Client    │ │   │
│  │  │ (local)  │ │ (YAML)   │ │ (Opita Code SSO) │ │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │   │
│  │                                                  │   │
│  │  ════════════════ IPC Bridge ═══════════════════ │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │          REACT FRONTEND (WebView2)               │   │
│  │                                                  │   │
│  │  ┌────────┐ ┌──────────┐ ┌────────────────────┐ │   │
│  │  │  Chat  │ │  Editor  │ │  Live Preview      │ │   │
│  │  │ Panel  │ │  Panel   │ │  Panel             │ │   │
│  │  │        │ │ (Monaco) │ │ (sandboxed iframe) │ │   │
│  │  └────────┘ └──────────┘ └────────────────────┘ │   │
│  │                                                  │   │
│  │  ┌──────────────┐ ┌──────────────┐              │   │
│  │  │  File Tree   │ │  Terminal    │              │   │
│  │  │  (Sidebar)   │ │  (Spanish)   │              │   │
│  │  └──────────────┘ └──────────────┘              │   │
│  │                                                  │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │        AI PROVIDER ADAPTER LAYER         │    │   │
│  │  │  ┌────────┐ ┌────────┐ ┌──────────────┐ │    │   │
│  │  │  │DeepSeek│ │ Gemini │ │  BYOK Router │ │    │   │
│  │  │  │  V3    │ │ Flash  │ │(any provider)│ │    │   │
│  │  │  └────────┘ └────────┘ └──────────────┘ │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  │                                                  │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │    SIMPLIFIED OPENSPEC PIPELINE           │    │   │
│  │  │  Entender → Construir → Verificar         │    │   │
│  │  │  (invisible to user, drives AI behavior)  │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│                    STATE: ZUSTAND                        │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │  Project     │ │  Chat        │ │  Learning       │  │
│  │  Store       │ │  Store       │ │  Store           │  │
│  └──────────────┘ └──────────────┘ └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Key Architecture Decisions

| Decision              | Choice                                | Rationale                                                                                                                                    |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop framework** | Tauri v2 over Electron                | 10x smaller binary, better memory usage, native WebView2 on Windows                                                                          |
| **Frontend**          | React + TypeScript over Vue/Svelte    | Larger ecosystem, more Tauri examples, Monaco editor has first-class React support                                                           |
| **State management**  | Zustand over Redux/Context            | Minimal boilerplate, works great with React + Tauri IPC, no middleware needed                                                                |
| **Code editor**       | Monaco over CodeMirror/Ace            | VS Code quality, best syntax highlighting, largest language support. Worth the bundle size in desktop context.                               |
| **AI provider layer** | Adapter pattern over direct API calls | Must support multiple providers with different APIs, token counting, streaming, error handling                                               |
| **OpenSpec pipeline** | 3-phase simplification                | Full SDD is too complex for beginners. entender → construir → verificar maps naturally to: understand request → build code → verify it works |
| **Project model**     | One folder = one project              | Simplicity. No multi-workspace. Direct mapping to filesystem. Easy GitHub sync.                                                              |
| **Authentication**    | Opita Code SSO (OAuth 2.0/OIDC)       | Centralized identity. Must support email/password + Google/GitHub OAuth for easy onboarding                                                  |
| **Local storage**     | SQLite (tauri-plugin-sql)             | Project metadata, user preferences, learning progress. Not for AI knowledge (excluded by design).                                            |

### 8.3 AI Provider Adapter Pattern

```typescript
interface AIProvider {
  id: string;
  name: string;
  tier: 'free' | 'byok' | 'opita';
  models: AIModel[];
  chat(messages: Message[], options: ChatOptions): AsyncIterable<ChatChunk>;
  countTokens(messages: Message[]): number;
}

interface AIModel {
  id: string;
  name: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  strengths: string[]; // ['code', 'explanation', 'spanish']
}

// Implementations
class DeepSeekProvider implements AIProvider { ... }
class GeminiProvider implements AIProvider { ... }
class BYOKProvider implements AIProvider { ... }  // OpenAI, Anthropic, OpenRouter, etc.
class OpitaProvider implements AIProvider { ... }  // Future: Opita Coder, Opita Tutor
```

### 8.4 Simplified OpenSpec Pipeline

```
┌──────────┐     ┌────────────┐     ┌───────────┐
│ ENTENDER │ ──→ │ CONSTRUIR  │ ──→ │ VERIFICAR │
│ (Phase 1)│     │ (Phase 2)  │     │ (Phase 3) │
└──────────┘     └────────────┘     └───────────┘
     │                 │                   │
     ▼                 ▼                   ▼
 User describes    AI generates       AI checks output
 what they want    code + files       against intent
 AI asks clarifying                   Runs linter/tests
 questions                           Shows live preview
 AI creates plan    User can edit    User approves or
 (invisible to     or ask changes    requests fixes
 user)                               (loop back to
                                     Construir)
```

**Invisible to user**: The pipeline runs behind the scenes. The user only sees: (1) describe what you want, (2) see the code appear, (3) see it working. The `entender` phase is compressed into the first AI interaction. The `verificar` phase manifests as the live preview working (or not).

### 8.5 Data Flow for a Typical Vibe-Coding Session

```
User: "Quiero una landing page para mi emprendimiento de arepas"

1. Chat → AI Provider (DeepSeek V3, free tier)
2. AI responds with plan (invisible entender phase)
3. AI generates: index.html, styles.css, script.js
4. File system: writes files to project folder (via Tauri fs plugin)
5. Editor: Monaco opens files with syntax highlighting
6. Live Preview: sandboxed iframe renders index.html
7. Learning layer: "¿Sabías que... el flexbox que usamos aquí..."
8. User: "Cambiá los colores a verde y blanco"
9. AI modifies styles.css
10. Live preview updates instantly

Token counter: 27/30 prompts remaining this month
```

### 8.6 Directory Structure (Proposed)

```
opita-vibe-studio/
├── src-tauri/              # Tauri v2 Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point, plugin registration
│   │   ├── commands/       # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── fs.rs       # File operations
│   │   │   ├── shell.rs    # Shell commands (git, npm)
│   │   │   └── project.rs  # Project management
│   │   ├── auth/           # Opita Code SSO integration
│   │   └── db/             # SQLite operations
│   ├── Cargo.toml
│   └── tauri.conf.json     # Window config, plugins, permissions
├── src/                    # React frontend
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root layout (3-panel + sidebar)
│   ├── components/
│   │   ├── chat/           # Chat panel, messages, input
│   │   ├── editor/         # Monaco wrapper, file tabs
│   │   ├── preview/        # Sandboxed live preview
│   │   ├── file-tree/      # Project file explorer
│   │   ├── terminal/       # Spanish-translated terminal
│   │   └── learning/       # Tips, badges, explanations
│   ├── stores/             # Zustand stores
│   │   ├── project.ts
│   │   ├── chat.ts
│   │   └── learning.ts
│   ├── providers/          # AI provider adapters
│   │   ├── base.ts
│   │   ├── deepseek.ts
│   │   ├── gemini.ts
│   │   └── byok.ts
│   ├── openspec/           # Simplified pipeline
│   │   ├── entender.ts
│   │   ├── construir.ts
│   │   └── verificar.ts
│   └── lib/                # Utilities, types, constants
├── tests/                  # vitest tests
├── package.json
└── AGENTS.md
```

---

## 9. Recommendation

### Verdict: **PROCEED TO PROPOSAL** — with 3 pre-conditions

The concept is strong, the market gap is real, and the technical path is clear. However, **three validations MUST happen before any code is written**:

1. **Student validation interviews** — Talk to 15-20 Colombian university students. Use a Figma prototype. Validate that:
   - They understand what "vibe-coding" means when explained in Spanish
   - They have projects they WANT to build (even if they can't code)
   - The price point (11,900 COP/mo) feels accessible
   - The "learn without realizing it" proposition resonates

2. **AI cost model spreadsheet** — Build a detailed model:
   - Cost per prompt for DeepSeek V3 vs Gemini Flash
   - Average tokens per vibe-coding session
   - Projected user growth (free tier vs paid)
   - Break-even timeline at each pricing tier
   - Worst-case scenario: what if 10,000 free users join in month 1?

3. **Spanish AI quality benchmark** — Run 50-100 coding prompts in Spanish:
   - Test: "Creá una API REST con Express que..." (Create a REST API with Express...)
   - Test: "Hacé una página que muestre..." (Make a page that shows...)
   - Test: "Explicame qué hace este código..." (Explain what this code does...)
   - Measure: code correctness, Spanish quality, explanation clarity
   - Compare: DeepSeek V3 vs Gemini Flash vs GPT-4o-mini (BYOK)

### If validations pass: recommended approach

1. **MVP first, learning layer second** — ship the core vibe-coding loop (chat + editor + preview) ASAP. The learning layer (tips, explanations, badges) can be added incrementally post-MVP.

2. **Start with 2 languages** — HTML/CSS/JS only for MVP. Add Python later. Don't try to support 10 languages from day one.

3. **DeepSeek V3 as default free model** — it's the cheapest per token with good code quality. Gemini Flash as backup. Claude/GPT via BYOK.

4. **Tauri v2 with all official plugins** — don't reinvent the wheel. Use `tauri-plugin-fs`, `tauri-plugin-shell`, `tauri-plugin-dialog`, `tauri-plugin-sql`, `tauri-plugin-updater`.

5. **Launch with Estudiante plan only** — Free + Estudiante (11,900 COP). Add Creador and Pro later when you have usage data and Opita models ready.

6. **Colombia-only at launch** — validate in one market before expanding to Latin America. The Colombian pricing model won't directly translate to Mexico, Argentina, or Chile.

---

## 10. Ready for Proposal

**Yes**, conditional on the 3 pre-validations above. The proposal should:

- Define the MVP scope with exact boundaries (what ships, what doesn't)
- Detail the 3-phase OpenSpec pipeline implementation
- Define the AI provider adapter interface
- Specify authentication flow with Opita Code SSO
- Define the learning layer architecture (even if implemented post-MVP, design it now)
- Include rollback plan (what if vibe-coding doesn't resonate with students?)
- Address the project naming concern: "vibe-studio-mvp" change name implies this is the full MVP scope, but consider whether to split into smaller changes

### Next SDD Phase

`sdd-propose` — Create the formal change proposal with scope, approach, risks, and rollback plan. The orchestrator should first ensure the 3 pre-validations are underway or planned, then launch the proposal.

---

## Appendix: Research Sources

- Cursor pricing: https://cursor.com/pricing (fetched 2026-05-04)
- Windsurf pricing: https://windsurf.com/pricing (fetched 2026-05-04)
- Bolt.new pricing: https://bolt.new/pricing (fetched 2026-05-04)
- Lovable pricing: https://lovable.dev/pricing (fetched 2026-05-04)
- Replit pricing: https://replit.com/pricing (fetched 2026-05-04)
- Tauri v2 documentation: https://v2.tauri.app (Context7, 2376+ snippets)
- Colombian minimum wage 2026: ~1,423,500 COP (government decree, adjusted annually)
- Colombian university student population: ~2.4M (MEN statistics, 2024 estimate)
