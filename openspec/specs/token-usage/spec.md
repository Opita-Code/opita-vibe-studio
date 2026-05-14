# Token Usage Specification

## Purpose

Enforces prompt limits per plan and displays usage information in the Settings panel's "Suscripción y Uso" tab.

## Plan Tiers

| Plan | Prompts/Month | Character Limit | Subagent Access | Model Selection |
|------|---------------|-----------------|-----------------|-----------------|
| Free (guest) | 30 | 8,000 chars | ❌ | Locked (Opita Flash) |
| Estudiante | 100 | 32,000 chars | ❌ | Unlocked |
| Pro | Unlimited | Unlimited | ✅ | Full access |

## Branded Model Names

| Internal Provider | User-Facing Name | Usage |
|-------------------|-----------------|-------|
| DeepSeek (deepseek-chat) | Opita Flash | Default for Free/Estudiante |
| DeepSeek (deepseek-coder) | Opita Architect | Code generation pipeline |

## Requirements

### Requirement: Prompt Counter

Each non-retry message increments `tokenUsage.promptsUsed` in the auth store. When the limit is reached, the ChatPanel shows a limit message instead of streaming.

#### Scenario: Limit reached

- GIVEN `promptsUsed >= promptsLimit`
- WHEN user sends a new message
- THEN the assistant shows: "⚠️ Llegaste al límite de X prompts este mes"
- AND suggests upgrading plan or configuring BYOK

### Requirement: BYOK Bypass

Messages sent via a BYOK-configured provider do NOT count against the plan's prompt limit.

### Requirement: Usage Display

The "Suscripción y Uso" tab in Settings shows: current plan, prompts used/remaining, billing period dates, and upgrade options.

## Files

- `src/lib/tokens.ts` — `isLimitReached()` helper
- `src/stores/auth.ts` — `tokenUsage`, `incrementPromptsUsed()`
- `src/components/layout/ChatPanel.tsx` — Limit enforcement (lines 48-65)
