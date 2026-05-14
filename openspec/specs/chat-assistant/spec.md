# Chat Assistant Specification

## Purpose

AI-powered chat panel for code generation and assistance. Supports SSE streaming, multi-provider BYOK, a 3-phase code pipeline, retry logic, and context-aware file injection.

## Architecture

- **ChatPanel**: `src/components/layout/ChatPanel.tsx` — Main container, lazy-loaded via `vibe-ai` extension
- **ChatInput**: `src/components/chat/ChatInput.tsx` — Textarea with image paste, drag-and-drop, and prompt suggestions
- **MessageList**: `src/components/chat/MessageList.tsx` — Renders messages with welcome screen
- **MessageBubble**: `src/components/chat/MessageBubble.tsx` — User (right-aligned) and assistant (left-aligned with `.prose`)
- **Store**: `src/stores/chat.ts` — Sessions, messages, streaming state, provider selection
- **Pipeline**: `src/pipeline/engine.ts` — 3-phase AI pipeline (entender → construir → verificar)
- **Streaming**: `src/providers/router.ts` → provider-specific SSE adapters

## Requirements

### Requirement: Chat Only for Authenticated Users

The ChatInput textarea MUST only render for authenticated users (`authMode === "authenticated"`). Unauthenticated users see a CTA block with "Despierta a Vibe AI para potenciar tu código" and an "Iniciar Sesión" button.

#### Scenario: Guest sees CTA

- GIVEN `authMode === "unauthenticated"`
- WHEN the chat panel is active
- THEN the ChatInput component is NOT rendered
- AND the CTA block is shown at the bottom of the panel

#### Scenario: Pro user sees ChatInput

- GIVEN `authMode === "authenticated"`
- WHEN the chat panel is active
- THEN the ChatInput textarea is rendered with placeholder "Escribe, pega imágenes o arrastra archivos aquí..."
- AND the model selector is available

### Requirement: SSE Streaming

Messages stream from AI providers via Server-Sent Events. The Lambda function at `packages/vibe-ai-backend/src/api/chat.handler` proxies requests to the active provider and returns `text/event-stream` responses.

#### Scenario: User sends message

- GIVEN an authenticated user with a configured provider
- WHEN user types a message and presses Enter
- THEN a user message bubble appears (right-aligned, `.justify-end`)
- AND an assistant message bubble appears (left-aligned, `.prose`)
- AND content streams in progressively via SSE chunks
- AND a "Detener generación" button appears during streaming

### Requirement: 3-Phase Code Pipeline

When the user's message is detected as a code request AND a project is open, the system runs a 3-phase pipeline: `entender` (understand context), `construir` (generate code), `verificar` (validate output). Each phase shows a status message in the assistant bubble.

### Requirement: Active File Context Injection

If the user has a file open in the editor, the ChatPanel automatically injects the file's content as a system message before the user's message. This enables "explain this code" and "fix this file" without manual copy-paste.

### Requirement: Multi-Session Chat History

The chat supports multiple sessions. Users can create new sessions (`Ctrl+N`), view history via the ChatHistoryPanel toggle, and switch between sessions. Each session maintains its own message history.

### Requirement: Retry on Network Error

If an SSE connection fails, the assistant message shows `<!--RETRY_NETWORK-->` tag and a "🔄 Reintentar Envío" button appears. Clicking it resends the last user message as a retry (`isRetry = true`), which does NOT increment the prompt counter.

### Requirement: Vibe Pro Engine Toggle

Pro users (`plan === "pro"`) see a "🚀 Vibe Pro Engine" toggle above the ChatInput. When enabled, the system uses the subagent pipeline for enhanced code generation.

### Requirement: Starter Prompts

When no messages exist in the active session, the MessageList shows a welcome screen with "¿Qué vamos a construir hoy?" and clickable starter prompts (e.g., "Crear un componente Navbar responsive"). Clicking a prompt fills the ChatInput.

## Files

- `src/components/layout/ChatPanel.tsx` — Main panel (lazy via `extensions/vibe-ai`)
- `src/components/chat/ChatInput.tsx` — Input with attachments
- `src/components/chat/MessageList.tsx` — Message rendering + welcome
- `src/components/chat/MessageBubble.tsx` — Message display
- `src/components/chat/ChatHistoryPanel.tsx` — Session switcher
- `src/components/chat/StreamingIndicator.tsx` — Typing animation
- `src/components/chat/ApplyCodeBlock.tsx` — Code block with apply button
- `src/stores/chat.ts` — Chat state management
- `src/pipeline/engine.ts` — 3-phase pipeline
- `src/providers/router.ts` — Provider routing + SSE