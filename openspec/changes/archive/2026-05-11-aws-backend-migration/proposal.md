# SDD Propuesta: Arquitectura AI Serverless y Optimización de Vibe Studio

## 🎯 Objetivo
Migrar la lógica core de Inteligencia Artificial a un backend Serverless en AWS para proteger la propiedad intelectual, e implementar mejoras de rendimiento y calidad de contexto en el cliente (Tauri/React) para obtener mejores resultados generados por la IA.

## 🏗️ 1. Arquitectura del Backend (AWS Serverless)

Se creará un nuevo paquete `packages/vibe-ai-backend` gestionado con **SST v3** (Serverless Stack).

**Componentes:**
- **Inferencia (AWS Lambda con Function URLs):** Endpoint principal de streaming (`POST /api/chat/stream`) con `ResponseStream`. AWS mantiene la conexión hasta 15 minutos.
- **Seguridad y Errores:** Manejo estricto de timeouts y autenticación JWT.
- **Estado (DynamoDB):** Tablas para historiales y configuraciones.

## 🚀 2. Arquitectura de Alta Calidad (TDD, Contexto y MCP)

Para lograr resultados excepcionales incluso con proveedores gratuitos (que suelen tener ventanas de contexto más chicas o menor capacidad de razonamiento), implementaremos las siguientes capas:

- **Servidor MCP (Model Context Protocol) Local:** Tauri levantará o actuará como un servidor MCP en la máquina del usuario. En lugar de que el frontend adivine qué archivos enviar, la IA en el backend de AWS podrá *solicitar* dinámicamente leer archivos, buscar en directorios o ejecutar comandos a través del puente MCP-Tauri.
- **Capa de Contexto Avanzada:** Una base de datos local ligera en Tauri o un índice semántico que el servidor MCP puede consultar. Solo se envía la información estrictamente necesaria a AWS, ahorrando tokens y mejorando el foco (atención) del modelo gratuito.
- **Capa TDD (Test-Driven Development) Automatizada:** El Agentic Loop del backend requerirá que todo código generado pase por un ciclo: 
  1. La IA escribe un test de la funcionalidad.
  2. Ejecuta el test localmente en la máquina del usuario (vía MCP).
  3. Escribe el código hasta que el test pase.
  4. Recién ahí, devuelve el resultado final al usuario.

## 📦 3. Estructura de Directorios Propuesta

```text
OPITA Vibe-Studio/
├── packages/
│   ├── vibe-ai-backend/        # <-- NUEVO: Backend SST/AWS
│   │   ├── sst.config.ts
│   │   └── src/
│   │       ├── functions/      # Lambdas (ej. chat-stream.ts)
│   │       └── core/           # Prompts seguros, Agent Loop
├── src/                        # Frontend React actual
└── src-tauri/                  # Rust
    └── mcp_server/             # <-- NUEVO: Servidor MCP Local para dar herramientas a la IA
```

## 🛡️ Riesgos y Mitigaciones
- **Costos descontrolados por errores:** Alarmas de Billing en AWS.
- **Pérdida de conexión en streaming:** React implementará reconexión automática.
- **Riesgo de seguridad MCP:** Las herramientas MCP ejecutadas desde AWS estarán en una "sandbox" estricta; Tauri pedirá permisos explícitos al usuario antes de ejecutar comandos destructivos o leer fuera del proyecto.

## ➡️ Siguientes Pasos
Si esta propuesta actualizada se ve bien, el siguiente paso es la fase de Especificación (`/sdd-spec`).
