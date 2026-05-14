<div align="center">

<img src="public/vibe-logo.svg" alt="Vibe Studio" width="80" />

# Vibe Studio

**El primer IDE diseñado para que aprendas a programar con IA — en español.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/Opita-Code/opita-vibe-studio/deploy.yml?label=deploy)](https://github.com/Opita-Code/opita-vibe-studio/actions)
[![Desktop](https://img.shields.io/badge/desktop-Tauri_v2-blueviolet)](https://github.com/Opita-Code/opita-vibe-studio/releases)
[![Web](https://img.shields.io/badge/web-vibe.opitacode.com-cyan)](https://vibe.opitacode.com)

[Demo en vivo](https://vibe.opitacode.com) · [Descargar Desktop](https://github.com/Opita-Code/opita-vibe-studio/releases) · [Guía de instalación](https://vibe.opitacode.com/install.html)

</div>

---

## ¿Qué es?

Vibe Studio es un IDE con IA que corre en el navegador y como app de escritorio. Diseñado como punto de entrada al desarrollo guiado por IA para estudiantes y creadores en Latinoamérica.

- ✏️ Editor Monaco (el mismo de VS Code) con syntax highlighting y autocompletado
- 🤖 Chat IA con soporte multi-proveedor (DeepSeek, Gemini, OpenAI, Anthropic, +7 más)
- 📁 Explorador de archivos con sincronización local (Tauri) y cloud
- 🖥️ Preview en vivo integrado (Sandpack)
- 🔑 BYOK — Trae tu propia API key y trabaja con tu proveedor favorito
- 🌐 Funciona sin cuenta — empieza a codear en segundos

## Arquitectura

```
vibe-studio/
├── src/                        # React SPA (frontend)
│   ├── auth/                   # SSO, magic links, session management
│   ├── components/             # UI: editor, chat, sidebar, settings
│   ├── stores/                 # Zustand (auth, cloud, settings)
│   └── lib/                    # Types, utils, constants
│
├── landing/                    # Landing page estática
│   ├── index.html              # vibe.opitacode.com
│   └── install.html            # Guía de instalación Windows/macOS
│
├── packages/
│   └── vibe-ai-backend/        # AWS Lambda — auth, chat, billing
│       └── src/api/
│           ├── core.ts         # Auth: magic links, JWT, password
│           ├── chat.ts         # Streaming AI + token quota
│           └── billing.ts      # Wompi webhook + checkout
│
├── src-tauri/                  # Tauri v2 (desktop app)
├── tests/                      # E2E (Playwright)
├── sst.config.ts               # Infraestructura AWS (SST v4)
└── vite.config.ts              # Build config
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 · TypeScript · Vite |
| Estilos | Tailwind CSS · Framer Motion |
| Estado | Zustand |
| Backend | AWS Lambda · SST v4 · TypeScript |
| Auth | Magic Links + Password (JWT · SES) |
| AI | DeepSeek · Gemini · OpenAI · Anthropic + BYOK |
| Base de datos | DynamoDB |
| Hosting | S3 · CloudFront |
| Desktop | Tauri v2 |
| Testing | Vitest · Playwright |

## Quick Start

### Web (solo frontend)

```bash
git clone https://github.com/Opita-Code/opita-vibe-studio.git
cd opita-vibe-studio
npm install
npm run dev          # → http://localhost:5173
```

### Full stack (frontend + backend)

```bash
cp .env.example .env  # Configura tus variables
npm install
npx sst dev           # Levanta Lambdas en local (requiere AWS CLI)
npm run dev            # En otra terminal
```

### Desktop (Tauri)

```bash
npm run tauri dev      # Requiere Rust toolchain
```

## Variables de entorno

Copia `.env.example` y configura:

```env
JWT_SECRET=           # Requerido — secreto para firmar tokens
DEEP_SEEK_KEY=        # API key DeepSeek
GEMINI_API_KEY=       # API key Google Gemini
OPENAI_API_KEY=       # API key OpenAI (opcional)
SES_FROM_EMAIL=       # Email verificado en SES
FRONTEND_URL=         # URL del frontend (default: http://localhost:5173)
```

## Scripts

```bash
npm run dev           # Dev server
npm run build         # Production build (tsc + vite)
npm test              # Vitest unit tests
npm run typecheck     # TypeScript check
npm run lint          # ESLint
npx playwright test   # E2E tests
```

## Deploy

```bash
npx sst deploy --stage production   # Backend → AWS
# Frontend: S3 sync + CloudFront invalidation (ver CI/CD workflow)
```

## Planes

| | Free | Estudiante | Pro |
|--|------|-----------|-----|
| Tokens/día | 150K | 250K | 1M |
| Tokens/hora | 30K | 60K | 200K |
| BYOK | ✅ | ✅ | ✅ |
| Subagente SDD | ❌ | 30/día | ∞ |

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). PRs son bienvenidos.

## Licencia

[MIT](LICENSE) — usa, modifica, distribuye.

---

<div align="center">

Construido con 💜 desde Colombia 🇨🇴 por [Opita Code](https://opitacode.com)

</div>
