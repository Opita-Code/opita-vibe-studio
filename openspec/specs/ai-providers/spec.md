# AI Providers Specification

## Purpose

Multi-provider AI routing system with intelligent model selection by plan tier, BYOK support, and per-model rate limiting. The system supports free, paid, and user-owned API keys with automatic failover.

## Architecture

- **Model Router**: `src/agent/model-router.ts` — Pure function that selects provider+model based on plan, action, and availability.
- **Backend Providers**: `packages/vibe-ai-backend/src/api/chat.ts` — Provider adapters (DeepSeek, Gemini, OpenAI, Anthropic, OpenRouter, Custom).
- **Frontend Router**: `src/providers/router.ts` — Routes requests to backend with provider config.
- **AI Service**: `src/services/aiService.ts` — SSE streaming client for Lambda backend.

## Model Routing Table

| Plan | Chat / Mechanical SDD | High-Cognitive SDD | BYOK |
|------|----------------------|-------------------|------|
| Free | gemini-2.5-flash | BLOCKED | User's choice |
| Estudiante | gemini-2.5-flash | gemini-2.5-flash | User's choice |
| Pro | gemini-2.5-flash | deepseek-v4-pro | User's choice |
| Pro degraded | gemini-2.5-flash | gemini-2.5-flash | User's choice |

### High-Cognitive SDD Phases
- `sdd-explore`, `sdd-propose`, `sdd-design`, `sdd-verify`

## Branded Model Names

| Internal Provider | User-Facing Name | Usage |
|-------------------|-----------------|-------|
| Gemini (gemini-2.5-flash) | Opita Flash | Default for all plans |
| DeepSeek (deepseek-v4-pro) | Opita Reasoner | Pro high-cognitive SDD |

## Requirements

### Requirement: Intelligent Model Router

The `selectModel()` function MUST be a pure function with zero side effects that selects the optimal provider and model based on `ModelRouterInput`.

#### Scenario: Free user sends chat message
- GIVEN plan is `"free"` and action is `"chat"`
- WHEN `selectModel()` is called
- THEN it MUST return `{ providerId: "gemini", modelId: "gemini-2.5-flash", byok: false }`.

#### Scenario: Free user tries SDD subagent
- GIVEN plan is `"free"` and action is `"subagent"`
- WHEN `selectModel()` is called
- THEN it MUST return `{ blocked: true, blockReason: "Para usar la orquestación SDD..." }`.

#### Scenario: BYOK overrides all routing
- GIVEN `customApiKey` is provided (not `"aws-managed"`)
- WHEN `selectModel()` is called
- THEN it MUST return `{ byok: true }` with the user's chosen model
- AND plan restrictions MUST NOT apply.

#### Scenario: Degraded Pro uses cheapest model
- GIVEN plan is `"pro"` and `degraded` is `true`
- WHEN `selectModel()` is called for any action
- THEN it MUST return `gemini-2.5-flash` (cheapest available).

### Requirement: Provider Adapter Interface

All backend providers MUST conform to a common streaming interface that yields SSE chunks.

### Requirement: Google Cloud API Integration

The backend MUST use `API_GOOGLE_CLOUD` environment variable for Google Cloud Platform API access (not AI Studio keys). This provides production-grade rate limits and reliability.

### Requirement: Per-Model RPM Rate Limiting

The backend MUST enforce per-model requests-per-minute limits to prevent API abuse and manage costs. Rate limits SHALL be tracked per user in DynamoDB.

### Requirement: Provider Inference

The `inferProvider()` function MUST detect the provider from a model ID string:
- `gpt-*`, `o1*`, `o3*` → `"openai"`
- `gemini*` → `"gemini"`
- `deepseek*` → `"deepseek"`
- Contains `/` → `"openrouter"`
- Default → `"deepseek"`

### Requirement: Flash Fallback Chain

When selecting a "flash" (cheap) model, the system MUST prefer Google AI (if available) over DeepSeek. If neither is available, fall back to `deepseek-chat`.

### Requirement: BYOK Bypass Token Limits

Messages sent through BYOK providers MUST NOT count against the user's plan token limits.

### Requirement: Token Counting

Every provider MUST implement token counting using `tiktoken` for OpenAI models and character-based estimation (chars/4) for others.

## Files

- `src/agent/model-router.ts` — `selectModel()`, `inferProvider()`, `pickFlash()`, routing table.
- `packages/vibe-ai-backend/src/api/chat.ts` — Provider adapters, rate limiting, streaming engine.
- `src/services/aiService.ts` — Frontend SSE streaming client.
- `src/providers/router.ts` — Frontend request router.
- `sst.config.ts` — API_GOOGLE_CLOUD, AI_STUDIO_GOOGLE, DEEP_SEEK_KEY environment variables.
