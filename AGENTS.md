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
│   ├── components/             # UI: editor, chat, sidebar, model selector
│   ├── stores/                 # Zustand: auth, cloud, settings
│   └── lib/                    # Types, utils
├── landing/                    # Landing estática (HTML/CSS) → vibe.opitacode.com/
├── packages/
│   ├── vibe-ai-backend/        # Lambda CoreAPI (auth + chat)
│   │   └── src/api/
│   │       ├── core.ts         # Auth: magic links, service-aware email templates
│   │       └── chat.ts         # Chat AI: quota management, token tracking (DynamoDB)
│   ├── api-gateway/            # API Gateway config
│   └── opita-cloud-context/    # Sincronización contexto cloud ↔ local
├── tests/                      # Playwright E2E
├── openspec/                   # SDD specs y changes
└── sst.config.ts               # Infraestructura AWS (SST v4)
```

- **Stack**: React + TypeScript + Vite + Tailwind + Zustand
- **Backend**: AWS Lambda TypeScript via SST v4
- **Auth**: Magic Links propios — `initiateSSO(email, { postAuthUrl: '/app', service: 'vibe-studio' })`
- **AI**: DeepSeek / Anthropic / Gemini via BYOK + quota DynamoDB
- **Runtime**: Bun or Node.js ESM for tooling
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Config**: YAML-first, reversible changes
- **Governance**: OpenSpec Spec-Driven Development
- **Quality gates**: `npm test`, `npm run typecheck`, `npm run lint`, `npx tsc --noEmit` en packages/vibe-ai-backend


## 🚫 Prohibited Actions

- Exposing secrets, tokens, or credentials
- Making repos public (Opita Code repos are PRIVATE)
- Force pushing to main
- Skipping quality gates before commit

## ✅ Required Patterns

- Conventional commits in Spanish: `tipo(scope): descripción`
- SDD for substantial changes
- Config-first, reversible changes
- BYOK support in all tiers
- Deployment: Use `vibe-aws-deploy` skill to build and deploy to S3/CloudFront
