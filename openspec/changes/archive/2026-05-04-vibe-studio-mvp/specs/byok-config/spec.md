# Delta for BYOK Configuration

## ADDED Requirements

### Requirement: Provider Key Management

The system MUST allow users to add, view, and remove API keys for supported BYOK providers: OpenAI, Anthropic, OpenRouter, and custom endpoint. Keys SHALL be stored encrypted via the Tauri store plugin (platform secure storage). Keys MUST NEVER be displayed in plaintext after initial entry; only masked versions (e.g., `sk-...a1b2`).

#### Scenario: User adds an OpenAI key

- GIVEN the BYOK settings panel is open
- WHEN the user enters `sk-proj-abc123...` and clicks "Guardar"
- THEN the key is validated by making a lightweight API call (list models)
- AND on success, the key is encrypted and stored
- AND the UI shows "OpenAI ✅ Conectada" with the masked key `sk-proj-a...c123`
- AND on validation failure, the UI shows "❌ API key inválida"

#### Scenario: User removes a provider key

- GIVEN OpenAI is configured with a valid key
- WHEN the user clicks "Eliminar" on the OpenAI entry and confirms
- THEN the key is deleted from secure storage
- AND the provider status changes to "No configurado"

### Requirement: Provider Status Display

The BYOK settings panel SHALL display each provider's status: "No configurado", "✅ Conectada", "❌ Error: [reason]", or "⏳ Verificando...". Status MUST update after key validation.

#### Scenario: Provider shows error after key expires

- GIVEN a previously valid Anthropic key was stored
- WHEN the system detects a 401 Unauthorized on the next request
- THEN the provider status updates to "❌ Error: API key expirada"
- AND a notification suggests the user update their key

### Requirement: Custom Endpoint Configuration

The system MUST support adding a custom OpenAI-compatible endpoint with: endpoint URL, API key, optional model list override. The custom endpoint SHALL be listed alongside built-in providers in the BYOK panel.

#### Scenario: Custom endpoint configured

- GIVEN the user enters `https://my-llm.example.com/v1` and a key
- WHEN validation succeeds
- THEN the endpoint appears as "Custom (my-llm.example.com)" in the model selector
- AND models are fetched from `GET /v1/models` or the manual override list
