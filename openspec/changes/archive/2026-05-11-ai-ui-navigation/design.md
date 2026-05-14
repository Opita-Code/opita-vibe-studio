# Architecture Design: AI UI Navigation

## Component Changes

### 1. `src/providers/router.ts`
- **Data flow**: In `streamFromProvider`, we inject `[SISTEMA: Herramientas de Navegación UI]` into the system prompt with precise syntax (`<vibe-action>`).

### 2. `src/components/layout/ChatPanel.tsx`
- **Data flow**: During the `for await` stream chunk loop:
  1. `rawContent` strings together the output.
  2. A regex `/Regex/g` parses `<vibe-action>`.
  3. A `Set` prevents double execution of the same tag match.
  4. Actions execute using zustand stores.
  5. Content passed to UI state (`replaceLastMessageContent`) is cleaned via `.replace`.

## Why not MCP?
MCP handles system/local interactions perfectly, but UI state navigation is tightly coupled to the React application's transient state (`activeView`, `openTabs`). A custom in-stream tag is lightweight, extremely fast, and doesn't interrupt the standard LLM reasoning cycle with tool call payloads.
