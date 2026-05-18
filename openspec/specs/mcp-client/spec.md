# MCP Client Specification

## Purpose

Frontend Model Context Protocol (MCP) client that bridges AWS backend tool requests to local Tauri IPC operations. Enables the AI agent to read/write files and run test commands on the user's local machine.

## Architecture

- **Client**: `src/services/mcpClient.ts` — Tool handler and result sender.
- **Backend**: `packages/vibe-ai-backend/src/api/chat.ts` — Emits `mcp_tool_request` chunks.
- **Transport**: HTTPS POST to `api.opitacode.com/chat/mcp`.
- **Local Execution**: Tauri IPC (`@/lib/ipc`) for filesystem and shell operations.

## Supported Tools

| Tool | Operation | Security |
|------|-----------|----------|
| `read_local_file` | Read file content | Path validation (no traversal) |
| `write_local_file` | Write file content | Path validation |
| `list_local_dir` | List directory contents | Path validation |
| `execute_test_command` | Run shell command | Whitelist-only (npm test, vitest, lint) |

## Requirements

### Requirement: Path Validation

All file operations MUST validate paths to prevent traversal attacks.

#### Scenario: Path traversal blocked
- GIVEN a tool request with `path: "../../etc/passwd"`
- WHEN `validateMcpPath()` is called
- THEN it MUST throw an error: "Path contains forbidden segments"
- AND blocked segments include: `..`, `~`, `%2e%2e`.

#### Scenario: Absolute paths blocked
- GIVEN a tool request with `path: "C:\\Windows\\System32\\..."`
- WHEN `validateMcpPath()` is called
- THEN it MUST throw an error: "Absolute paths are forbidden".

### Requirement: Shell Command Whitelist

The `execute_test_command` tool MUST only allow commands starting with:
- `npm test`, `npx vitest`, `vitest`, `npm run test`, `npm run lint`.

#### Scenario: Unauthorized command blocked
- GIVEN a tool request with `command: "rm -rf /"`
- WHEN the tool handler evaluates the command
- THEN it MUST throw: "Comando de shell bloqueado por seguridad".

### Requirement: Tauri Environment Detection

If the app is not running inside Tauri (browser mode), all tool requests MUST return an error: "Tauri IPC not available in browser mode."

### Requirement: Result Reporting

After tool execution, results MUST be sent back to the backend via `POST api.opitacode.com/chat/mcp` with `{ type: "mcp_tool_result", tool, payload }`.

### Requirement: Project Root Scoping

All file operations MUST be scoped to the active workspace root (`useProjectStore.activeWorkspaceId`). If no project is open, tool requests MUST return an error.

## Files

- `src/services/mcpClient.ts` — MCP client, path validation, tool handler, result sender.
- `src/lib/ipc.ts` — Tauri IPC wrappers (readFile, writeFile, listDir, execShell).
