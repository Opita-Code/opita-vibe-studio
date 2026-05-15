# Chat Assistant Specification

## Purpose

AI-powered chat panel with agent orchestrator, tool execution, SSE streaming, multi-provider BYOK, execution modes (interactive/automatic), and context-aware file injection.

## Architecture

- **Agent Handler**: `src/agent/useAgentHandler.ts` — Bridge between Orchestrator and UI (replaces legacy sendMessage)
- **Orchestrator**: `src/agent/orchestrator.ts` — Handles messages, routes to provider, processes tool calls
- **Tool System**: `src/tools/` — 10 tool definitions (read_file, write_file, edit_file, search, etc.)
- **ChatPanel**: `src/components/layout/ChatPanel.tsx` — Main container
- **Chat Components**: `src/components/chat/` — ChatInput, MessageList, MessageBubble, ModeButtons, ExecutionRoadmap
- **Store**: `src/stores/chat.ts` — Sessions, messages, streaming state, modes, chaining state
- **Streaming**: `src/services/aiService.ts` → Lambda backend → provider SSE

## Execution Modes

| Mode | Description | UI Component |
|------|-------------|-------------|
| `interactive` | User confirms each AI step | ModeButtons selector |
| `automatic` | AI runs autonomously, user reviews at end | ModeButtons selector |

### Agent Pipeline

```
User Message → useAgentHandler.send()
  → orchestrator.handleMessage() → yields AgentEvents
    → processEvent() maps events to store mutations
      → ChatPanel renders updated state
```

### Agent Events
| Event Type | Description |
|-----------|-------------|
| `text-delta` | Streaming text chunk |
| `tool-start` | Tool execution started |
| `tool-result` | Tool execution result |
| `step` | Pipeline step (entender/construir/verificar) |
| `done` | Stream complete with file summary |

## Requirements

### Requirement: Agent-Based Message Handling

Messages are processed by the Orchestrator which yields AgentEvents. The useAgentHandler hook maps these events to UI store mutations.

#### Scenario: User sends message
- GIVEN an authenticated user
- WHEN user types a message and presses Enter
- THEN `useAgentHandler.send(text)` is called
- AND the orchestrator processes the message
- AND AgentEvents stream to the UI
- AND passive XP is awarded on successful completion (debounced 30s)

### Requirement: Tool Execution

The AI can call tools (read_file, write_file, edit_file, search_project, etc.) which execute against the virtual filesystem.

#### Scenario: AI uses a tool
- GIVEN the AI decides to read a file
- WHEN a `tool-start` event fires
- THEN the AgentStepAccordion shows the tool name and parameters
- AND `tool-result` shows the outcome
- AND the AI continues with the tool output in context

### Requirement: Execution Roadmap

In automatic mode, the AI generates a roadmap of goals. The ExecutionRoadmap component visualizes progress.

#### Scenario: Automatic mode execution
- GIVEN execution mode is `"automatic"`
- WHEN the AI starts a multi-step task
- THEN ExecutionRoadmap renders with goal cards
- AND each goal shows status (pending/in-progress/complete)

### Requirement: Mode Selection

Users can switch between interactive and automatic execution modes via ModeButtons.

#### Scenario: Switch to automatic
- GIVEN interactive mode is active
- WHEN user clicks "Automático" in ModeButtons
- THEN `executionMode` changes to `"automatic"`
- AND the AI runs autonomously

### Requirement: Chat Only for Authenticated Users

ChatInput MUST only render for authenticated users. Guests see a CTA with "Iniciar Sesión" button.

### Requirement: SSE Streaming

Messages stream from the Lambda backend via Server-Sent Events. The backend proxies to the active provider.

### Requirement: Active File Context Injection

If the user has a file open, its content is injected as context before the message.

### Requirement: Multi-Session Chat History

Multiple sessions with create/switch/delete. ChatHistoryPanel toggle for session management.

### Requirement: Retry on Network Error

Failed SSE shows `<!--RETRY_NETWORK-->` with "🔄 Reintentar Envío" button. Retries don't increment token usage.

### Requirement: Vibe Pro Engine Toggle

Pro/Estudiante users see mode selection and SDD orchestration capabilities.

### Requirement: Starter Prompts

Empty sessions show welcome screen with "¿Qué vamos a construir hoy?" and clickable starters.

### Requirement: Code Apply Blocks

AI code responses render with an "Aplicar" button that writes the code to the project filesystem.

## Files

- `src/agent/useAgentHandler.ts` — Agent-UI bridge hook
- `src/agent/orchestrator.ts` — Message orchestration, tool routing
- `src/agent/types.ts` — AgentEvent, AgentStep, RoadmapGoal types
- `src/agent/idea-backlog.ts` — Idea detection and matching
- `src/tools/definitions.ts` — 10 tool definitions
- `src/tools/executor.ts` — Tool execution engine
- `src/tools/parser.ts` — Tool call extraction from AI output
- `src/tools/prompts.ts` — System prompt builder
- `src/components/layout/ChatPanel.tsx` — Main panel
- `src/components/chat/ChatInput.tsx` — Input with attachments, mode selector
- `src/components/chat/MessageList.tsx` — Message rendering + welcome
- `src/components/chat/MessageBubble.tsx` — Message display with markdown
- `src/components/chat/ModeButtons.tsx` — Interactive/Automatic mode selector
- `src/components/chat/ExecutionRoadmap.tsx` — Visual goal tracker
- `src/components/chat/AgentStepAccordion.tsx` — Tool call visualization
- `src/components/chat/ApplyCodeBlock.tsx` — Code apply button
- `src/components/chat/ChatHistoryPanel.tsx` — Session switcher
- `src/components/chat/StreamingIndicator.tsx` — Typing animation
- `src/stores/chat.ts` — Chat state management
- `src/services/aiService.ts` — AI service layer