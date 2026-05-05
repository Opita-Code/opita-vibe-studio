# Delta for AI Providers

## ADDED Requirements

### Requirement: Provider Adapter Interface

The system MUST implement an `AIProvider` interface with: `id`, `name`, `tier` (`free | byok | opita`), `chat()` async generator for SSE streaming, and `countTokens()`. All provider implementations SHALL conform to this interface.

#### Scenario: Free provider returns streaming response

- GIVEN DeepSeek V3 is the active provider
- WHEN `provider.chat(messages, options)` is called
- THEN chunks stream back as `AsyncIterable<ChatChunk>`
- AND each chunk contains `{ content: string, done: boolean }`

### Requirement: Free Tier Models

The system MUST include DeepSeek V3 as the default free model and Gemini Flash as fallback. If the primary free model fails, the system SHALL automatically retry with the fallback before returning an error. The tier is labeled "Gratis" in the UI.

#### Scenario: DeepSeek fails, Gemini succeeds

- GIVEN DeepSeek V3 returns a 429 rate-limit error
- WHEN the system retries the request
- THEN Gemini Flash is used as fallback automatically
- AND the response streams successfully
- AND the UI does not display the internal failover (transparent to user)

### Requirement: BYOK Provider Router

The system MUST support user-provided API keys for: OpenAI (GPT-4o-mini, GPT-4o), Anthropic (Claude Haiku, Claude Sonnet), OpenRouter (any model), and a custom OpenAI-compatible endpoint. The BYOK router SHALL map each provider's API format to the internal `AIProvider` interface.

#### Scenario: BYOK with custom endpoint

- GIVEN user configured a custom OpenAI-compatible endpoint at `https://my-llm.example.com`
- WHEN a chat request is sent
- THEN the request is routed to the custom endpoint with the user's API key
- AND streaming chunks are normalized to the internal ChatChunk format

### Requirement: Token Counting

Every provider MUST implement `countTokens(messages)` using `tiktoken` for OpenAI models and character-based estimation (chars/4) for other providers. The count SHALL be logged per request for usage tracking.

#### Scenario: Token count logged per request

- GIVEN a chat request with a 200-character Spanish prompt
- WHEN the provider processes the request
- THEN `countTokens` returns an estimated token count (~50 tokens)
- AND the count is emitted to the token-usage system
