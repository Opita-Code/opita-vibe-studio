# AGENTS.md — OPITA Vibe-Studio

> **CRITICAL**: Every AI agent touching this repo MUST read and follow these rules.

## 🏷️ Brand

Opita Vibe-Studio is an Opita Code product — a simplified vibe-coding environment for Windows, designed as the entry point to OpenSpec-driven development for students and beginners.

**Tagline**: _Vibecodeá en español. Aprendé sin darte cuenta._

**Tone**: claro (clear), cercano (warm, Colombian, human), práctico (focused on results).

## 🏗️ Project Architecture

- **Stack**: Tauri v2 + React + TypeScript (Windows native via WebView2)
- **Runtime**: Bun or Node.js ESM for tooling
- **Testing**: vitest
- **Config**: YAML-first, reversible changes
- **Governance**: OpenSpec Spec-Driven Development
- **Quality gates**: `npm test`, `npm run typecheck`, `npm run lint`

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
