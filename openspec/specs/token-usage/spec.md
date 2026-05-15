# Token Usage Specification

## Purpose

Gestiona los límites de tokens por plan con ventanas temporales diarias y horarias. Muestra uso en tiempo real via TokenBar y PlanCard. Integra con gamificación para quota ganada.

## Architecture

- **Backend**: `packages/vibe-ai-backend/src/api/chat.ts` — DynamoDB token tracking, quota enforcement
- **Store**: `src/stores/auth.ts` — `tokenUsage` state, `fetchTokenUsage()`
- **Lib**: `src/lib/tokens.ts` — Plan limits, helpers, formatters
- **UI**: `src/components/usage/` — TokenBar, PlanCard (Aura design system)

## Plan Tiers

| Plan | Daily Tokens | Hourly Tokens | Gamification Cap | Model Access |
|------|-------------|--------------|-------------------|-------------|
| Free (guest) | 150,000 | 30,000 | 300,000 | Opita Flash |
| Estudiante | 250,000 | 60,000 | 400,000 | Flash + SDD |
| Pro | 1,000,000 | 200,000 | N/A | Full access |

## Branded Model Names

| Internal Provider | User-Facing Name | Usage |
|-------------------|-----------------|-------|
| DeepSeek (deepseek-chat) | Opita Flash | Default for Free/Estudiante |
| Gemini (gemini-2.5-flash) | Opita V4 Flash | SDD Orchestration |
| Gemini (gemini-2.5-pro) | Opita Reasoner | Pro pipeline |

## Requirements

### Requirement: Token-Based Limits

Cada mensaje consume tokens (input + output). El backend trackea `tokensUsedToday` y `tokensUsedThisHour` en DynamoDB con reset automático.

#### Scenario: Daily limit reached
- GIVEN `tokensUsedToday >= tokensLimitDaily`
- WHEN user sends a new message
- THEN the assistant shows: "⚠️ Sin tokens. Se renuevan en Xh"
- AND the TokenBar turns red
- AND suggests upgrading plan or waiting

#### Scenario: Hourly limit reached
- GIVEN `tokensUsedThisHour >= tokensLimitHourly`
- WHEN user sends a new message
- THEN shows: "Límite horario. Se renueva en Xmin"
- AND the TokenBar turns red

### Requirement: Earned Quota Integration

Tokens ganados por gamificación incrementan `tokensLimitDaily` hasta el cap del plan.

#### Scenario: Effective quota calculation
- GIVEN user free con 150K base + 50K earned
- WHEN `/usage` returns usage data
- THEN `tokensLimitDaily = min(150K + 50K, 300K)` = 200K
- AND PlanCard shows "+50K ganados con misiones"

### Requirement: BYOK Bypass

Messages sent via a BYOK-configured provider do NOT count against the plan's token limit.

### Requirement: Usage Display

TokenBar y PlanCard muestran uso en tiempo real con el design system Aura (gradientes aura-cyan→aura-purple, glassmorphism, white/XX opacity scale).

#### Scenario: Warning state
- GIVEN usage >= 80% of daily limit
- WHEN TokenBar renders
- THEN bar color changes to amber
- AND text shows "X tokens restantes"

### Requirement: Compact Mode

TokenBar supports `compact` prop for StatusBar integration.

#### Scenario: StatusBar display
- GIVEN `compact={true}`
- THEN renders inline: "45.2K/250K (Estudiante)"

## Files

- `src/lib/tokens.ts` — `PLAN_LIMITS`, `PLAN_FEATURES`, `PLAN_NAMES`, helpers
- `src/stores/auth.ts` — `tokenUsage`, `fetchTokenUsage()`
- `src/components/usage/TokenBar.tsx` — Progress bar (Aura themed)
- `src/components/usage/PlanCard.tsx` — Plan info card (Aura themed, gamification integrated)
- `src/components/layout/StatusBar.tsx` — Compact TokenBar integration
- `packages/vibe-ai-backend/src/api/chat.ts` — Token tracking, quota enforcement
