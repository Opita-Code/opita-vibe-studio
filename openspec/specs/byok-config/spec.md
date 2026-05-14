# BYOK Configuration Specification

## Purpose

Bring Your Own Key (BYOK) system allowing users to connect their own AI provider API keys. Configured providers bypass Opita's prompt limits.

## Architecture

- **ByokPanel**: `src/components/settings/ByokPanel.tsx` — Grid of provider cards with expand/configure flow
- **Store**: `src/lib/byok-store.ts` — localStorage-based key storage (`vibe-byok-{provider}`)
- **Registry**: `src/providers/registry.ts` — Provider metadata and model lists

## Requirements

### Requirement: Supported Providers

The system MUST support the following AI providers via BYOK:

| Provider | Key prefix | Models |
|----------|-----------|--------|
| DeepSeek | `sk-` | deepseek-coder, deepseek-chat |
| Anthropic | `sk-ant-` | claude-3.5-sonnet, claude-3-haiku |
| Groq | `gsk_` | llama-3.1-70b, mixtral-8x7b |
| Mistral | N/A | mistral-large, mistral-medium |
| Cohere | N/A | command-r-plus |
| Together | N/A | meta-llama/Llama-3-70b |
| Perplexity | `pplx-` | llama-3.1-sonar-large |

### Requirement: Key Management

API keys are stored in localStorage as JSON objects: `{ key, createdAt, updatedAt }`. The key `vibe-byok-configured` tracks which providers have been set up as a JSON array.

#### Scenario: Connect a provider

- GIVEN user opens Settings → Conexiones IA
- WHEN user clicks on an unconfigured provider card
- THEN the card expands to show an API key input (`type="password"`)
- AND a "Conectar Proveedor" button appears (disabled until key is entered)
- AND entering a key enables the button

#### Scenario: Provider already configured

- GIVEN a provider key exists in localStorage
- WHEN the BYOK panel renders
- THEN the provider card shows a "connected" status indicator

### Requirement: Active Provider Selection

The active provider and model are stored in `src/stores/chat.ts` as `activeProvider` and `activeModelId`. These can be persisted via `vibe-chat-storage` in localStorage.

## Files

- `src/components/settings/ByokPanel.tsx`
- `src/lib/byok-store.ts`
- `src/providers/registry.ts`
- `src/stores/chat.ts` — `activeProvider`, `activeModelId`
