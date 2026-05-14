# SDD Exploration: Migración de IA a AWS Lambda (Serverless Backend)

## 🎯 Objetivo
Diseñar la arquitectura backend para Vibe Studio que gestione toda la lógica de Inteligencia Artificial (prompts, llamadas a API de modelos) utilizando servicios 100% stateless (Serverless) en AWS para maximizar la protección de la Propiedad Intelectual (IP) y asegurar un modelo de pago por uso (pay-per-use) puro.

## 🔎 Estado Actual
- **Cliente:** Aplicación de escritorio Tauri v2 + React (TypeScript). Actualmente se está construyendo la interfaz de usuario (UI), sin integración de IA directa en el código aún.
- **Infraestructura:** La cuenta de AWS del usuario ya tiene despliegues Serverless (AWS Lambda) para el `vibe-landing`.
- **Problema a prevenir:** Si la lógica de IA se implementa en Tauri (sea en el frontend React o en el backend local Rust), los prompts y API keys quedan vulnerables a ingeniería inversa.

## 🏗️ Opciones de Arquitectura Serverless

### Opción 1: AWS SAM (Serverless Application Model)
- **Compute:** AWS Lambda.
- **API:** Lambda Function URLs (soporta Response Streaming nativo, esencial para UX de IA).
- **Pros:** Herramienta oficial de AWS, madura, plantillas declarativas en YAML.
- **Contras:** La experiencia de desarrollo local con TypeScript puede ser pesada.

### Opción 2: SST (Serverless Stack) o AWS CDK
- **Compute:** AWS Lambda (Node.js / Bun).
- **API:** Lambda Function URLs para streaming + API Gateway HTTP APIs para rutas CRUD.
- **Pros:** Infraestructura como código real (TypeScript). SST v3 tiene una experiencia de desarrollo local espectacular (Live Lambda) que se integra perfecto con monorepos Vite/Tauri.
- **Contras:** Requiere aprender la sintaxis de SST/CDK si el usuario solo conoce YAML.

### El Mecanismo de Streaming (Crítico para IA)
Para que Vibe Studio muestre el código "escribiéndose" en tiempo real, no podemos usar un API Gateway REST tradicional (timeout de 29s y sin streaming bidireccional estable). La solución stateless óptima es **AWS Lambda Function URLs con `ResponseStream`**.

## ⚖️ Recomendación
Recomendamos avanzar con la **Opción 2 (SST o AWS CDK con Lambda Function URLs)**, creando un nuevo paquete en el monorepo (ej. `packages/vibe-ai-backend`). Esto permite compartir tipos de TypeScript (interfaces, DTOs) entre el frontend de Vibe Studio y el backend de AWS.

## ➡️ Siguientes Pasos
Si el usuario aprueba esta exploración, el siguiente paso es la fase de Propuesta (`/sdd-propose`), donde se documentará la estructura exacta de carpetas, herramientas y cómo se conectará Vibe Studio con el nuevo backend.
