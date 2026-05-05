# Delta for Chat Assistant

## ADDED Requirements

### Requirement: Prompt Input and Submission

The chat interface MUST provide a multi-line text input for Spanish-language prompts with a send button and Enter-key submission. The system SHALL disable input while a response is streaming. Input length MUST be capped at 8000 characters.

#### Scenario: User sends a Spanish prompt

- GIVEN the chat input is empty
- WHEN the user types "Creá una landing page para mi negocio" and presses Enter
- THEN the prompt is sent to the active AI provider
- AND the input clears and disables until streaming completes

#### Scenario: Empty prompt rejected

- GIVEN the chat input is empty or whitespace-only
- WHEN the user presses Enter or clicks Send
- THEN no request is sent
- AND the input remains focused with no error shown (silent no-op)

### Requirement: Streaming Response Display

The system MUST render AI responses incrementally as SSE chunks arrive, supporting Markdown formatting and syntax-highlighted code blocks via `react-markdown` + `react-syntax-highlighter`. The response area SHALL auto-scroll to the latest content.

#### Scenario: AI streams a response with code

- GIVEN a prompt was submitted
- WHEN the AI streams back text containing a markdown code block
- THEN text appears incrementally in the chat panel
- AND code blocks render with HTML/CSS/JS syntax highlighting
- AND the scroll position follows new content automatically

### Requirement: Context Window Management

The chat MUST maintain a conversation context (last 20 messages) sent with each prompt. The system SHALL display a context size indicator (e.g., "12/20 mensajes") and SHOULD warn before context truncation.

#### Scenario: Context limit reached

- GIVEN a conversation has 20 messages in context
- WHEN the user sends a new prompt
- THEN the oldest message pair is evicted from context
- AND the indicator updates to "20/20 mensajes"
- AND the AI still receives 20 messages of context

### Requirement: Model Selector

The chat interface SHALL display a dropdown to select the active AI model, grouped by tier: "Gratis" (DeepSeek V3, Gemini Flash), "BYOK" (user-configured providers), and the currently selected model MUST persist across sessions.

#### Scenario: User switches from free to BYOK model

- GIVEN the user has configured a BYOK provider
- WHEN the user selects a BYOK model from the dropdown
- THEN subsequent prompts route through the selected BYOK provider
- AND the selection persists after app restart
