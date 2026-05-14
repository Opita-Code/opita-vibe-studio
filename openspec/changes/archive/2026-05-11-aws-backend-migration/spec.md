# SDD Especificación: Migración AI y MCP a AWS

## 📦 1. Dependencias y Herramientas

### Backend (AWS / `packages/vibe-ai-backend`)
- **Infraestructura:** `sst@latest` (Serverless Stack v3).
- **Runtime:** Node.js 20+ (o Bun).
- **Librerías Core:**
  - `@aws-sdk/client-dynamodb`: Para interacción serverless con el estado.
  - `jose`: Para validación de JSON Web Tokens (JWT) Edge/ligero.
  - `openai` / `@anthropic-ai/sdk`: Clientes oficiales.
  - `ai` (Vercel AI SDK): Recomendado para estandarizar el Agentic Loop y el streaming.

### Cliente (Tauri / React / `src` y `src-tauri`)
- **Estado (Frontend):** `zustand` (Manejo eficiente del estado de la conversación y el streaming).
- **MCP (Backend Local Tauri):** Integración nativa en Rust para exponer comandos del sistema (leer archivos, correr `vitest`) como herramientas MCP.

## 📡 2. Contratos de API (JSON)

### A. Endpoint de Chat (Streaming)
**Ruta:** `POST /api/v1/chat/stream`  
**Headers:** `Authorization: Bearer <JWT>`  
**Body Request:**
```json
{
  "projectId": "local-uuid",
  "messages": [
    { "role": "user", "content": "Haz un botón rojo" }
  ],
  "context": {
    "files": ["src/App.tsx"],
    "tests_status": "passing"
  }
}
```
**Response:** Flujo Server-Sent Events (SSE).

### B. Protocolo de Herramientas MCP (AWS ⇄ Tauri)
Cuando la IA en AWS necesite ejecutar algo local, enviará en el stream de texto un evento especial estructurado:
```json
{
  "type": "mcp_tool_request",
  "tool": "run_tests",
  "args": { "test_file": "Button.test.tsx" }
}
```
El cliente React intercepta este evento (no se lo muestra al usuario), se lo pasa a Tauri (Rust), Tauri corre el comando, y React hace un nuevo `POST` a AWS con el resultado:
```json
{
  "type": "mcp_tool_result",
  "tool": "run_tests",
  "result": "✓ 1 test passed"
}
```

## 🔄 3. Flujo TDD Obligatorio (Reglas de Negocio)
1. **Petición:** Usuario pide una feature.
2. **Generación de Test:** El Agente AWS genera el código del test.
3. **Petición MCP:** El Agente AWS pide ejecutar el test (vía evento `mcp_tool_request`).
4. **Validación:** El cliente responde el resultado. Si falla, el Agente AWS vuelve al paso 2 o corrige el código.
5. **Respuesta Final:** Solo cuando el test pasa, o si el usuario explícitamente aprueba un salto, la IA emite el código de la solución.

## 🗂️ 4. Cambios Estructurales
```text
OPITA Vibe-Studio/
├── packages/
│   ├── vibe-ai-backend/
│   │   ├── sst.config.ts        # Define: new sst.aws.Function("ChatAPI")
│   │   ├── package.json
│   │   └── src/
│   │       ├── api/chat.ts      # Lambda HTTP Handler
│   │       └── agents/          # Lógica TDD y MCP
├── src/
│   └── stores/
│       └── chatStore.ts         # Nuevo store Zustand para SSE
└── src-tauri/
    └── src/
        ├── mcp/                 # Comandos Rust expuestos a React
        │   ├── fs_tools.rs      # Leer/Escribir archivos
        │   └── shell_tools.rs   # Ejecutar vitest/npm
        └── main.rs
```

## ✅ Criterios de Aceptación
- La API de AWS puede mantener una conexión viva de 5+ minutos escribiendo texto.
- React no se congela (no bloquea el UI thread) mientras llega el texto.
- Tauri puede ejecutar comandos CLI y devolver la salida a AWS sin comprometer la seguridad (debe haber una lista blanca de comandos permitidos, ej. `npm test`, `vitest`, `git`).
