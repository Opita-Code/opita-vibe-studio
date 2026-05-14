# SDD Tareas: Migración a AWS Serverless, TDD y MCP

Este documento divide la implementación de la nueva arquitectura en tareas atómicas y secuenciales.

## Fase 1: Infraestructura AWS Base (SST)
- [ ] **1.1 Inicializar subproyecto backend:** Crear `packages/vibe-ai-backend` e inicializar SST v3 (`npx sst@latest init`).
- [ ] **1.2 Crear tabla DynamoDB:** Definir tabla `Conversations` en `sst.config.ts`.
- [ ] **1.3 Endpoint Dummy Streaming:** Crear un endpoint `POST /api/chat` usando AWS Lambda Function URLs que emita un contador en streaming (SSE) para probar la latencia y la conexión de 15 minutos, sin conectar la IA todavía.
- [ ] **1.4 Seguridad JWT:** Implementar middleware de validación JWT (usando la librería `jose`) en el endpoint.

## Fase 2: Adaptación del Frontend (Vibe Studio React)
- [ ] **2.1 Configurar Zustand:** Crear `src/stores/chatStore.ts` para manejar la lista de mensajes y el estado "isStreaming" de forma reactiva.
- [ ] **2.2 Conexión SSE:** Implementar el parser en React para consumir el flujo Server-Sent Events del backend de AWS.
- [ ] **2.3 Conectar UI:** Acoplar el input de chat y la vista de mensajes de la interfaz de Vibe Studio al store de Zustand.

## Fase 3: Puente MCP Local (Tauri Rust ⇄ React)
- [ ] **3.1 Sandbox en Rust:** Crear comandos Tauri (Rust) seguros: `read_local_file(path)`, `list_local_dir(path)`, `execute_test_command()`. Restringir ejecución al directorio del proyecto actual.
- [ ] **3.2 Interceptor React:** Modificar el parser SSE (tarea 2.2) para que escuche payloads `type: "mcp_tool_request"`.
- [ ] **3.3 Ciclo de vida Tool:** Al interceptar la petición, llamar al comando Rust, y enviar un HTTP POST `type: "mcp_tool_result"` de vuelta a AWS con la salida del comando o test.

## Fase 4: Agentic Loop & TDD (AWS AI)
- [ ] **4.1 Integrar Vercel AI SDK:** Conectar OpenAI/Anthropic SDKs en el Lambda.
- [ ] **4.2 Prompting TDD:** Crear el System Prompt obligando al modelo a usar herramientas MCP.
- [ ] **4.3 Tooling Backend:** Registrar las herramientas (leer archivos, correr tests) en el objeto de configuración del modelo de lenguaje para que la IA sepa que existen.
- [ ] **4.4 Prueba End-to-End:** Realizar una prueba completa pidiendo a la IA generar una función matemática; la IA debe crear el test, pedir a Tauri que lo corra, recibir el error, arreglar la función, y devolver el código exitoso.
