# AGENTS.md — Vibe Studio

> **CRITICAL**: Every AI agent touching this repo MUST read and follow these rules.

## 🏷️ Brand

Vibe Studio is an Opita Code product — a simplified vibe-coding environment for Windows, designed as the entry point to OpenSpec-driven development for students and beginners.

**Tagline**: _Vibecodea en español. Aprende sin darte cuenta._

**Tone**: claro (clear), cercano (warm, Colombian, human), práctico (focused on results).

## 🏗️ Project Architecture

```
vibe-studio/
├── src/                        # React SPA (frontend)
│   ├── auth/sso.ts             # Magic links: initiateSSO({ postAuthUrl, service: 'vibe-studio' })
│   ├── agent/                  # Aura: harnesses, prompts, agents (chat/build/explore)
│   │   ├── prompts.ts          # System prompt composer (single source of truth)
│   │   └── harnesses/          # Harness engine: 24 harnesses en 6 fases
│   ├── components/             # UI: editor, chat, sidebar, model selector
│   ├── stores/                 # Zustand: auth, cloud, settings
│   └── lib/                    # Types, utils, dark-memory bridge singleton
├── landing/                    # Landing estática (HTML/CSS) → vibe.opitacode.com/
├── packages/
│   ├── vibe-ai-backend/        # Lambda CoreAPI (auth + chat)
│   │   └── src/api/
│   │       ├── core.ts         # Auth: magic links, service-aware email templates
│   │       └── chat.ts         # Chat AI: quota management, token tracking (DynamoDB)
│   ├── dark-memory-bridge/     # NUEVO: cliente TS de dark-memory (recall BM25, save, session)
│   ├── memory-sdk/             # DEPRECADO: sync key-value DynamoDB (solo compat)
│   ├── api-gateway/            # API Gateway config
│   └── opita-cloud-context/    # Sincronización contexto cloud ↔ local
├── openspec/                   # SDD specs y changes
└── sst.config.ts               # Infraestructura AWS (SST v4)
```

- **Stack**: React + TypeScript + Vite + Tailwind + Zustand
- **Backend**: AWS Lambda TypeScript via SST v4
- **Auth**: Magic Links propios — `initiateSSO(email, { postAuthUrl: '/app', service: 'vibe-studio' })`
- **AI**: DeepSeek V4 / Gemini / MiniMax via BYOK + quota DynamoDB
- **Memoria/RAG**: dark-memory (MCP) via `@opita/dark-memory-bridge` — recall BM25, agent_memory kinds, session lifecycle
- **Runtime**: Bun or Node.js ESM for tooling
- **Testing**: Vitest (unit + integration). E2E/browser: dark-copilot MCP (Playwright abolido — regla dura)
- **Config**: YAML-first, reversible changes
- **Governance**: OpenSpec Spec-Driven Development
- **Quality gates**: `npm test`, `npm run typecheck`, `npm run lint`, `npx tsc --noEmit` en packages/vibe-ai-backend y packages/dark-memory-bridge
- **Test contract**: los tests reflejan el estado real del código — el código es la fuente de verdad, no los tests

## 🧠 Dark-Memory (memoria canónica de Aura)

El backend de memoria/RAG de Aura es **dark-memory** (MCP local vía sidecar), accedido a través de `@opita/dark-memory-bridge` (`packages/dark-memory-bridge/`).

### Reglas
- **NUNCA inventar tools de memoria**: las únicas tools de memoria son las de dark-memory (`dark_memory_agent_memory_save/recall/list/get/entities`, `dark_memory_session_start/close`). Los stubs `memory_search` / `memory_save` / `mem_save` fueron eliminados — no reintroducirlos.
- **Kinds canónicos** (agent_memory): `note`, `observation`, `decision`, `finding`, `todo`, `link`, `context`.
- **Scoping**: cada usuario tiene su proyecto dark-memory (`vibe:<email>`), aislado por INV-7.
- **Session lifecycle**: `initDarkMemory()` + `startDarkMemorySession()` al autenticar (stores/auth.ts detectSession); `closeDarkMemorySession()` al logout.
- **Degradación elegante**: si dark-memory no está disponible, el bridge usa MemoryTransport in-memory y los harnesses operan sin bloqueo.
- **Inyección del bridge**: `src/lib/dark-memory.ts` es el singleton; los harnesses reciben el bridge via setters (`setEngramBridge`, `setDarkMemoryContextBridge`, `setDarkMemoryPersistBridge`, `setSessionBridge`, `setSkillBridge`).

### Archivos clave
| Archivo | Rol |
|---|---|
| `packages/dark-memory-bridge/src/client.ts` | `DarkMemoryBridge` — save/recall/list/get/entities + session + caché |
| `packages/dark-memory-bridge/src/transport.ts` | Tauri / HTTP / Memory (fallback) |
| `src/lib/dark-memory.ts` | Singleton + inyección en harnesses + memory context block |
| `src/agent/harnesses/infrastructure/dark-memory-context.ts` | Harness pre-execute: recall BM25 del mensaje |
| `src/agent/harnesses/infrastructure/dark-memory-persist.ts` | Harness post-execute: persiste decisiones/findings |
| `src/agent/harnesses/phases/engram-memory.ts` | Retrieval por topic keys SDD + instrucciones de persistencia |
| `src/agent/harnesses/infrastructure/session-summary.ts` | Session state persistido en DM (loadRecoveryState) |
| `src/agent/harnesses/skills/skill-registry.ts` | Skills dinámicas desde DM (kind=context, tag=skill) |

### Tests del bridge
```bash
cd packages/dark-memory-bridge && npx vitest run   # 11 tests
npx vitest run src/agent/harnesses/__tests__/dark-memory-harnesses.test.ts  # 9 tests
```

## 🚫 Prohibited Actions

- Exposing secrets, tokens, or credentials
- Making repos public (Opita Code repos are PRIVATE)
- Force pushing to main
- Skipping quality gates before commit
- Committing or deploying with E2E tests that reference removed UI elements, deleted flows, or stale selectors
- Routing tool-calling agents (explore-agent, build-agent) to `deepseek-reasoner` (DeepSeek-R1) since it does not support function calling and will crash.
- **Reintroducir Playwright** (deps, config, tests/e2e): abolido por regla dura del operador. E2E = dark-copilot.
- **Reintroducir ids legacy DeepSeek** (`deepseek-chat`, `deepseek-reasoner`): catálogo oficial = `deepseek-v4-pro` / `deepseek-v4-flash`. El migrate de stores/chat.ts mapea legacy → v4.

## ✅ Required Patterns

- Conventional commits in Spanish: `tipo(scope): descripción`
- SDD for substantial changes
- Config-first, reversible changes
- BYOK support in all tiers
- Use official DeepSeek V4 model names (`deepseek-v4-pro`, `deepseek-v4-flash`) for DeepSeek integration; do not revert them to legacy or placeholder model IDs.
- **Memoria**: usar `dark_memory_agent_memory_recall` antes de proponer algo que toque decisiones previas; `dark_memory_agent_memory_save` para persistir decisiones/findings (nunca stubs).
- **E2E test sync (parte del deploy)**: ante cualquier cambio de UI, flujo, o comportamiento observable, actualizar los tests E2E afectados en el mismo commit o PR antes de desplegar. Si se elimina un elemento, se elimina su test. Si se cambia un selector, se actualiza el helper. Los tests stale bloquean CI y son deuda técnica.
- Deployment: Use `vibe-aws-deploy` skill to build and deploy to S3/CloudFront
- **Aislamiento en Staging (dev.opitacode.com)**:
  - Todo proyecto frontend que se testee en el dominio compartido de staging debe desplegarse en su prefijo de ruta asignado en S3 (ej. `/app/` para vibe-studio mediante `aws s3 sync dist/ s3://dev.opitacode.com/app/ --delete`).
  - La landing corporativa o proyecto raíz en S3 debe excluir explícitamente estos prefijos al sincronizarse para no borrarlos: `aws s3 sync dist/ s3://dev.opitacode.com/ --exclude "app/*" --exclude "trabajos/*" --exclude "cuenta/*" --delete`.
  - Configurar correspondientemente el `base` path en Vite/React Router para cada aplicación (ej. `/app/` para Vibe Studio).

