# Chat Assistant Specification

## Purpose

AI-powered chat panel with multi-agent orchestrator, intelligent intent routing, tool execution, SSE streaming, multi-provider BYOK, execution modes (interactive/automatic), and context-aware file injection.

## Architecture

- **Orchestrator**: `src/agent/orchestrator.ts` — Single entry point for all AI interactions. Routes to specialized sub-agents.
- **Intent Classifier**: `src/agent/intent.ts` — Classifies user messages as `chat`, `explore`, or `code`.
- **Sub-Agents**:
  - `src/agent/chat-agent.ts` — Conversational responses (questions, explanations).
  - `src/agent/explore-agent.ts` — Codebase exploration and analysis.
  - `src/agent/build-agent.ts` — Code generation with TDD and delivery strategy decisions.
- **Model Router**: `src/agent/model-router.ts` — Selects optimal model per plan tier.
- **Context Loader**: `src/agent/context-loader.ts` — Loads project context (files, test runner, conventions).
- **Spec Writer**: `src/agent/spec-writer.ts` — Generates OpenSpec specifications from prompts.
- **Idea Backlog**: `src/agent/idea-backlog.ts` — Detects and tracks feature ideas from conversations.
- **Tool System**: `src/tools/` — Tool definitions, executor, and parser.
- **Stream Client**: `src/agent/stream-client.ts` — SSE client with retry logic.
- **Agent Handler**: `src/agent/useAgentHandler.ts` — React hook bridging orchestrator to UI.
- **System Prompts**: `src/agent/prompts.ts` — Dynamic system prompt builder.
- **Store**: `src/stores/chat.ts` — Sessions, messages, streaming state, modes, chaining.
- **UI**: `src/components/chat/` — ChatInput, MessageList, MessageBubble, ModeButtons, ExecutionRoadmap.

## Agent Pipeline

```
User Message → orchestrator.handleMessage()
  → classifyIntent() → "chat" | "explore" | "code"
    → selectModel() → optimal provider+model
      → runChatAgent() / runExploreAgent() / runBuildAgent()
        → AsyncGenerator<AgentEvent>
          → useAgentHandler maps events to store mutations
            → ChatPanel renders updated state
```

## Intent Classification

| Intent | Description | Sub-Agent |
|--------|-------------|-----------|
| `chat` | Questions, explanations, conversations | ChatAgent |
| `explore` | Codebase analysis, architecture review | ExploreAgent |
| `code` | Feature creation, bug fixes, code changes | BuildAgent |

## Intelligent Decisions (BuildAgent)

### TDD Decision
- Uses TDD when: project has test runner AND request involves creating/modifying testable code.
- Skips TDD when: no test runner, styling/docs/config, or user explicitly opts out ("sin tests").

### Delivery Strategy
| Strategy | Condition |
|----------|-----------|
| `direct` | No git, or small changes (default) |
| `feature-branch` | Large scope (sistema, módulo, migrar) |
| `pr` | User explicitly requests PR/branch |

## Agent Events

| Event Type | Description |
|-----------|-------------|
| `text` | Streaming text content |
| `phase` | Agent phase change (chatting/thinking/planning/building) |
| `step` | Named step with description |
| `tool_call` | Tool invocation with name and args |
| `tool_result` | Tool execution result |
| `file_changed` | File created or modified |
| `error` | Error message |
| `done` | Stream complete with summary |

## Requirements

### Requirement: Agent-Based Message Routing

Messages MUST be routed through the Orchestrator which classifies intent and delegates to the appropriate sub-agent.

#### Scenario: User asks a question
- GIVEN an authenticated user sends "¿Qué es React?"
- WHEN `handleMessage()` is called
- THEN `classifyIntent()` MUST return `"chat"`
- AND `runChatAgent()` MUST be invoked.

#### Scenario: User requests code generation
- GIVEN an authenticated user sends "Crear una página de login"
- WHEN `handleMessage()` is called
- THEN `classifyIntent()` MUST return `"code"`
- AND `selectModel()` MUST be called with `action: "subagent"`
- AND `runBuildAgent()` MUST be invoked with TDD and delivery decisions.

### Requirement: Execution Modes

Users MUST be able to switch between `interactive` (user confirms each step) and `automatic` (AI runs autonomously) modes via ModeButtons.

### Requirement: Chat Only for Authenticated Users

ChatInput MUST only render for authenticated users. Guests see a CTA with "Iniciar Sesión" button.

### Requirement: SSE Streaming

Messages stream from the Lambda backend via Server-Sent Events. The `stream-client.ts` MUST handle connection retry on network errors.

### Requirement: Context Injection

The `context-loader.ts` MUST inject project summary (files, test runner, conventions) into the system prompt for code-aware responses.

### Requirement: Idea Backlog

The `idea-backlog.ts` MUST detect feature ideas and suggestions from AI responses and track them for the user.

### Requirement: Starter Prompts

Empty sessions MUST show welcome screen with "¿Qué vamos a construir hoy?" and clickable starter prompts.

### Requirement: Code Apply Blocks

AI code responses MUST render with an "Aplicar" button that writes the code to the project filesystem.

### Requirement: Multi-Session Chat History

Multiple sessions with create/switch/delete. ChatHistoryPanel toggle for session management.

## Files

- `src/agent/orchestrator.ts` — Main entry point, intent routing, TDD/delivery decisions.
- `src/agent/intent.ts` — Intent classification (chat/explore/code).
- `src/agent/chat-agent.ts` — Conversational sub-agent.
- `src/agent/explore-agent.ts` — Exploration sub-agent.
- `src/agent/build-agent.ts` — Build sub-agent with TDD support.
- `src/agent/model-router.ts` — Plan-based model selection.
- `src/agent/context-loader.ts` — Project context loading.
- `src/agent/spec-writer.ts` — OpenSpec generation.
- `src/agent/idea-backlog.ts` — Idea detection and tracking.
- `src/agent/prompts.ts` — System prompt builder.
- `src/agent/stream-client.ts` — SSE client with retry.
- `src/agent/useAgentHandler.ts` — React hook for agent-UI bridge.
- `src/agent/types.ts` — AgentEvent, AgentPhase, IntentClass types.
- `src/tools/definitions.ts` — Tool definitions.
- `src/tools/executor.ts` — Tool execution engine.
- `src/tools/parser.ts` — Tool call extraction from AI output.
- `src/tools/prompts.ts` — Tool-aware system prompt.
- `src/stores/chat.ts` — Chat state management.
- `src/components/chat/` — All chat UI components.