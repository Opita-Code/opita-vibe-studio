<div align="center">

<img src="public/vibe-logo.svg" alt="Vibe Studio" width="80" />

# Vibe Studio

**Vibecodea en español. Aprende sin darte cuenta.**
**Vibe-coding in Spanish. Learn without noticing.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build](https://img.shields.io/badge/branch-main-blueviolet)](https://github.com/Opita-Code/opita-vibe-studio)
[![Stack](https://img.shields.io/badge/desktop-Tauri_v2-blueviolet)](https://github.com/Opita-Code/opita-vibe-studio/releases)
[![Web](https://img.shields.io/badge/web-vibe.opitacode.com-cyan)](https://vibe.opitacode.com)

[Demo en vivo](https://vibe.opitacode.com) · [Descargar Desktop](https://github.com/Opita-Code/opita-vibe-studio/releases) · [Guía de instalación](https://vibe.opitacode.com/install.html)

</div>

---

## Estado del proyecto · Project state

| | |
|---|---|
| **Versión actual** | `0.5.0` (ver `package.json`) |
| **Último tag documentado** | `v0.2.1` en [`release-notes.md`](release-notes.md) — *mojibake (UTF-8 doble-encoded) pendiente de arreglar en otra pasada* |
| **Stack headless** | Tauri v2 · React 18 · TypeScript 5.4 · Vite 5.4 · Tailwind 3.4 · Zustand 4.5 · CodeMirror 6 |
| **Backend** | AWS Lambda vía SST v4 (`packages/vibe-ai-backend/`) · DynamoDB |
| **AI providers** | 12 (Anthropic · ChatGPT Web · Cohere · Custom · DeepSeek · Gemini · Groq · Mistral · OpenAI · OpenRouter · Perplexity · Together) — todos BYOK |
| **Modelo DeepSeek canónico** | `deepseek-v4-pro`, `deepseek-v4-flash` *(ver `AGENTS.md` para contexto)* |
| **Auth** | Magic Links propios · sin password · sin JWT |
| **Studio** | dev: <https://dev.opitacode.com/app/> · prod: <https://vibe.opitacode.com/app/> |
| **Landing** | <https://vibe.opitacode.com/> (estática, S3 + CloudFront) |
| **Calidad** | OpenSpec SDD · strict TDD · Vitest (unit) + Playwright (e2e) |
| **Convención de commits** | `tipo(scope): descripción` (en español) |

## ¿Qué es Vibe Studio? · What is Vibe Studio?

**ES** — IDE con IA que corre en el navegador y como app de escritorio. Punto de entrada al desarrollo Spec-Driven para estudiantes y principiantes en Latinoamérica. Trae tu propia API key (BYOK) y trabaja con tu proveedor favorito; los datos de trabajo quedan en tu navegador y (opcionalmente) se sincronizan con la nube.

**EN** — AI-powered IDE that runs in the browser and as a desktop app. Entry point to Spec-Driven Development for students and beginners in Latin America. BYOK across all tiers; work data stays local (browser/Tauri), with optional cloud sync.

Características verificadas en este repo (no se afirmam features que no estén en `src/`, `packages/` o `src-tauri/`):

- 🪄 Editor de código con highlighting por lenguaje (CodeMirror 6: JS/TS, CSS, HTML, JSON, Markdown, Python, XML, YAML)
- 🤖 Chat IA multi-proveedor (12 proveedores — listados arriba) + BYOK en todos los tiers
- 📁 Explorador de archivos · persistencia local (Tauri OPFS / IndexedDB) con sync cloud opcional (`packages/memory-sdk/`)
- 🖥️ Live preview con [Sandpack](https://sandpack.codesandbox.io) (in-process React preview iframe)
- 📦 Export de proyecto (zip via `jszip`)
- 🏅 Gamificación (XP, streaks, milestones) en `src/components/gamification/`
- 💳 Pagos vía Wompi (`WompiModal.tsx`) — *los planes y cuotas exactas viven en el backend, no en este README*
- 🔐 SSO Magic Link por servicio (`auth/sso.ts`) · verificación por deep link en desktop (`auth/deep-link.ts`)

## Arquitectura · Architecture

```
opita-vibe-studio/
├── src/                        React SPA (frontend)
│   ├── auth/                   Magic links + deep-link SSO
│   ├── components/             UI: editor, chat, sidebar, settings, gamification, learning
│   ├── stores/                 Zustand (auth, chat, project, ui, learning)
│   ├── lib/                    fs backend, file watcher, sync, tokens, export, IPC
│   ├── providers/              12 AI providers (anthropic, gemini, openai, deepseek, …)
│   ├── agent/                  Harness orchestration + multi-agent (chat/explore/build/spec/…)
│   ├── extensions/vibe-ai/     Vibe-AI surface (extension points + memory channel)
│   └── core/                   CoreHost + coreStore (IPC core bridge)
├── src-tauri/                  Tauri v2 desktop shell (Rust) — fs, shell, dialog, sql, updater
├── landing/                    Landing estática (HTML/CSS) → vibe.opitacode.com/
├── packages/
│   ├── vibe-ai-backend/        Lambda CoreAPI (magic links + chat + billing)
│   │   └── src/api/
│   │       ├── core.ts         Service-aware magic links + email templates
│   │       ├── chat.ts         Streaming chat + quota (DynamoDB)
│   │       ├── billing.ts      Wompi checkout / webhook
│   │       ├── gamification.ts XP, streaks, missions
│   │       ├── telemetry-stream.ts  Token telemetry
│   │       └── registry.ts     Endpoint registry
│   ├── api-gateway/            API Gateway / Cloudflare Workers config
│   ├── memory-sdk/             Local + cloud sync (cloud-bridge, context-decay, offline-queue…)
│   └── telemetry-sdk/          Telemetry package (token usage, persona selectors)
├── tests/                      Playwright E2E · integration · lib · providers · stores
├── openspec/                   Spec-Driven Development specs + changes history
├── .github/workflows/          CI (npm test+lint+typecheck) + deploys
│   ├── ci.yml
│   ├── build-tauri.yml
│   ├── deploy-landing.yml         (tag `v*` / `landing/v*` / `web/v*`)
│   ├── deploy-landing-dev.yml
│   ├── deploy-web-app-prod.yml
│   ├── deploy-web-app-dev.yml
│   ├── deploy-backend-prod.yml
│   ├── deploy-backend-dev.yml
│   └── update-changelog.yml
├── sst.config.ts               SST v4 infra (canonical stages: dev, prod)
└── scripts/                    generate-changelog, setup-athena
```

## Quick start

### Web (solo frontend · frontend only)

```bash
git clone https://github.com/Opita-Code/opita-vibe-studio.git
cd opita-vibe-studio
npm install
npm run dev          # vite → http://localhost:5173
```

### Full stack (frontend + backend · frontend + AWS Lambdas locales)

```bash
cp .env.example .env       # ver .env.example para variables requeridas
npm install
npx sst dev                # levanta las Lambdas en local (requiere AWS CLI configurada)
npm run dev                # en otra terminal → http://localhost:5173
```

> **Stage canónico de SST:** `prod`. **Nunca** uses `production` como nombre de stage — crea un stack paralelo (`opita-vibe-studio-production`) separado del de producción real. Ver comentario en `sst.config.ts`.

### Desktop (Tauri v2 · WebView2 en Windows)

```bash
npm run tauri dev          # requiere Rust toolchain estable
npm run tauri build        # genera instalador (Windows .msi / .exe, macOS .dmg, Linux .deb/.rpm)
```

## Variables de entorno · Environment variables

Ver [`AUTH.md` / `body.json` / `chat.json`](./) o el `.env.example` committed. Las que la **infra SST** lee de SSM por stage (config en `sst.config.ts`):

- `/opita-account/{stage}/users-table-name` (DynamoDB)
- `/opita-account/{stage}/user-keys-table-name` (BYOK cifrado)

Las del frontend (en `.env.example`) típicamente incluyen: claves BYOK por proveedor (`DEEP_SEEK_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, …) y `FRONTEND_URL`. **No** usamos `JWT_SECRET`: la auth es magic-link only.

## Scripts · Scripts

```bash
npm run dev                 # vite dev server
npm run build               # tsc + vite build (producción)
npm run preview             # vite preview
npm test                    # vitest unit + integration
npm run test:watch          # vitest watch
npm run test:e2e            # playwright (chromium)
npm run test:e2e:staging    # playwright contra dev.opitacode.com
npm run test:e2e:prod       # playwright contra vibe.opitacode.com
npm run typecheck           # tsc --noEmit
npm run lint                # eslint .
npm run format              # prettier --write .
npm run format:check        # prettier --check .
npm run storybook           # storybook dev :6006
npm run build-storybook     # storybook static build
npm run tauri               # tauri CLI (dev / build / …)
```

## Deploy · Deployment

### Backend (AWS via SST)

```bash
npx sst deploy --stage prod        # canónico — NO uses 'production'
```

### Frontend (S3 + CloudFront)

Tag-trigger: `v*` (ej. `v0.5.0`), `landing/v*`, `web/v*`. La landing vive en el **root** del bucket; la web app en el prefijo `/app/`. Aislamiento crítico en el sync (ver `deploy-landing.yml`):

- `landing/` → `s3://vibe-landing-…/` (root), excluye `app/*`
- Web app build (`dist/`) → `s3://…/app/` (path-prefixed)

No deployes el contenido de Vibe Studio al root del bucket de otra app de staging (por ejemplo `dev.opitacode.com/`) sin excluir prefijos ajenos (`--exclude "trabajos/*" --exclude "cuenta/*"`).

## Gobierno · Governance

- **OpenSpec SDD** (modo híbrido: `openspec` + `engram`). Las specs viven en `openspec/specs/`, las propuestas en `openspec/changes/`.
- **Strict TDD**: tests antes que código. `package.json` `engines.strict_tdd_mode = enabled`.
- **Conventional commits en español** — `tipo(scope): descripción`.
- **Quality gates**: `npm test && npm run typecheck && npm run lint` antes de commit.
- **E2E test sync**: ante cualquier cambio de UI/flow/selector, los tests afectados van en el mismo PR antes del deploy.

Las reglas completas viven en [`AGENTS.md`](AGENTS.md) — todo agente (humano o IA) que toque el repo debe leerlo.

## Seguridad · Security

- **BYOK** — las claves de proveedor quedan cifradas en DynamoDB; nunca se loguean.
- **Magic-link only** — sin passwords, sin JWT. La sesión es un token de un solo uso enviado por email.
- **Sandbox** — el preview Sandpack corre en un iframe aislado (ver `tests/security/sandbox-escape.test.ts`).
- **No secrets en el repo** — `.env*` ignorado por `.gitignore`; ver `sst.config.ts` línea 35 para el manejo del BOM UTF-8 que GitHub Secrets puede arrastrar.

## Licencia · License

[MIT](LICENSE) — usar, modificar, distribuir.

---

<div align="center">

Construido con 💜 desde Colombia 🇨🇴 por [Opita Code](https://opitacode.com)

---

<sub>Última revisión del README: **2026-07-28** — auditoría org-wide de READMEs (de-hallucination contra real ground-truth: `package.json`, `sst.config.ts`, `openspec/config.yaml`, `src/auth/`, `AGENTS.md`). Pendientes separados: (a) arreglar mojibake en `release-notes.md`, `AGENTS.md`, `openspec/config.yaml`; (b) sincronizar `AGENTS.md` (aún dice Monaco, package.json usa CodeMirror 6); (c) cerrar el `[sst deploy --stage production]` que un README anterior recomendaba contra el comentario de `sst.config.ts:6`.</sub>

</div>
