# Token Usage Specification

## Purpose

Gestiona los límites de tokens por plan con ventanas temporales diarias y horarias. El sistema MUST mostrar el uso en tiempo real vía TokenBar y PlanCard. Se integra con la gamificación para habilitar quota ganada, y MUST soportar "Purchase Intent" para sugerir actualizaciones de plan sin modales bloqueantes.

## Architecture

- **Backend**: `packages/vibe-ai-backend/src/api/chat.ts` — DynamoDB token tracking, quota enforcement.
- **Store**: `src/stores/auth.ts` — `tokenUsage` state, `fetchTokenUsage()`.
- **Lib**: `src/lib/tokens.ts` — Plan limits, helpers, formatters.
- **UI**: `src/components/usage/` — TokenBar, PlanCard, `usePurchaseIntent.ts`.

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

El sistema MUST consumir tokens (input + output) por cada mensaje. El backend SHALL almacenar `tokensUsedToday` y `tokensUsedThisHour` en DynamoDB con reset automático.

#### Scenario: Daily limit reached
- GIVEN `tokensUsedToday >= tokensLimitDaily`
- WHEN user sends a new message
- THEN the assistant MUST show: "⚠️ Sin tokens. Se renuevan en Xh"
- AND the TokenBar MUST turn red
- AND the system MUST trigger the `purchase_intent` to suggest upgrading.

#### Scenario: Hourly limit reached
- GIVEN `tokensUsedThisHour >= tokensLimitHourly`
- WHEN user sends a new message
- THEN the assistant MUST show: "Límite horario. Se renueva en Xmin"
- AND the TokenBar MUST turn red.

### Requirement: Earned Quota Integration

Los tokens ganados por gamificación MUST incrementar el `tokensLimitDaily` hasta el límite definido (Gamification Cap).

#### Scenario: Effective quota calculation
- GIVEN user is on Free plan con 150K base + 50K earned
- WHEN `/usage` endpoint returns usage data
- THEN the system MUST calculate `tokensLimitDaily = min(150K + 50K, 300K)` = 200K
- AND PlanCard MUST show "+50K ganados con misiones".

### Requirement: BYOK Bypass

Los mensajes enviados a través de un proveedor BYOK (Bring Your Own Key) configurado MUST NOT count contra el límite de tokens del plan del usuario.

### Requirement: Usage Display and Purchase Intent

TokenBar y PlanCard MUST mostrar el uso en tiempo real utilizando el design system Aura. Además, el límite inminente o la restricción de modelos MUST disparar el `usePurchaseIntent`.

#### Scenario: Warning state
- GIVEN usage >= 80% of daily limit
- WHEN TokenBar renders
- THEN bar color MUST change to amber
- AND text MUST show "X tokens restantes"
- AND the UI SHOULD present a contextual nudge (Aura Nudge) to upgrade.

#### Scenario: Pro Model Locked Selection
- GIVEN user is on Free or Estudiante plan
- WHEN user clicks on a Pro model in the ModelSelector
- THEN the system MUST NOT select the model
- AND the system MUST trigger `setIntent("pro_model")` to prompt the upgrade flow.

### Requirement: Compact Mode

TokenBar MUST support a `compact` prop para la integración en la StatusBar.

#### Scenario: StatusBar display
- GIVEN `compact={true}`
- THEN the component MUST render inline: "45.2K/250K (Estudiante)".

## Files

- `src/lib/tokens.ts` — `PLAN_LIMITS`, `PLAN_FEATURES`, `PLAN_NAMES`, helpers.
- `src/stores/auth.ts` — `tokenUsage`, `fetchTokenUsage()`.
- `src/components/usage/TokenBar.tsx` — Progress bar (Aura themed).
- `src/components/usage/PlanCard.tsx` — Plan info card.
- `src/components/layout/StatusBar.tsx` — Compact TokenBar integration.
- `src/hooks/usePurchaseIntent.ts` — Purchase intent state management.
- `packages/vibe-ai-backend/src/api/chat.ts` — Token tracking, quota enforcement.
