# Vibe AI Capacity & Staging E2E Benchmark

Este directorio contiene las pruebas de integración End-to-End especializadas en medir los límites de las capacidades del agente Vibe AI. Estas pruebas difieren de las pruebas unitarias/e2e normales en que:

1. **Prueban el LLM real**: Consumen tokens y evalúan la calidad del código generado, no solo la UI.
2. **Ejecutan en Staging (`dev.opitacode.com`)**: Para validar la resiliencia de la infraestructura de Lambdas, WebSockets y la latencia real.
3. **Miden Complejidad, Resiliencia y Seguridad**: Evalúan la capacidad agentica, la robustez de la UI y el aislamiento del sandbox.

## Suites

| Archivo | Qué mide | Tests |
|---------|----------|-------|
| `ai-complexity.spec.ts` | Capacidad del agente para crear archivos en el VFS | Level 1 (1 archivo), Level 2 (2 archivos) × 2 modelos |
| `ai-resilience.spec.ts` | UI bajo carga masiva y recuperación de fallos de red | Output masivo, Interrupción de stream |
| `ai-security.spec.ts` | Aislamiento del sandbox VFS | Jailbreak, Prompt Injection, Path Traversal |

## Niveles de Capacidad (Complexity Limits)

- **Level 1 (Basic)**: Tareas de un solo archivo (Componentes UI puros).
- **Level 2 (Medium)**: Tareas multi-archivo con lógica simple (Componente + Util + Import).
- **Level 3 (Advanced)**: Tareas transversales (Themes, Refactoring de patrones de estado). *Pendiente.*
- **Level 4 (Expert)**: Migración de paradigmas o grandes refactors. *Pendiente.*

## Modelos bajo test

Las pruebas de complejidad iteran sobre los modelos disponibles en el plan gratuito:

| ID (backend) | Nombre en UI | Motor | Propósito |
|--------------|-------------|-------|-----------|
| `deepseek-chat` | **Opita Flash** | DeepSeek V3 | Latencia rápida, tareas básicas |
| `deepseek-reasoner` | **Opita Architect** | DeepSeek R1 | CoT extendido, tareas complejas |

## Selectores clave (referencia para mantenimiento)

Los selectores están alineados con el DOM real de Vibe Studio:

- **Chat log**: `role="log"` con `aria-label="Mensajes del chat"`
- **Chat input**: `textarea[placeholder*="Escribe"]`
- **Model selector**: `[aria-label="Seleccionar modelo de IA"]`
- **Settings button**: `[aria-label="Configuración"]`
- **Settings dialog**: `role="dialog"` con `aria-label="Configuración de Vibe Studio"`
- **File explorer**: `[aria-label="Explorador de Archivos"]`

### Patrones de texto del agente (useAgentHandler.ts)

- **Archivo creado**: `✅ Creado: \`filename\`` (L278)
- **Archivo modificado**: `🔧 Modificado: \`filename\`` (L278)
- **Error**: `⚠️ ${errorMsg}` (L310, L201)
- **Resumen final**: `**Archivos modificados:**\n- \`path\` (action)` (L321-323)
- **Error de red**: `"Error de red. Verifica tu conexión a internet..."` (aiService.ts L193)

## Cómo ejecutar

```bash
npx playwright test tests/e2e/capacity --project=staging
```

Para un solo suite:
```bash
npx playwright test tests/e2e/capacity/ai-complexity.spec.ts --project=staging
npx playwright test tests/e2e/capacity/ai-resilience.spec.ts --project=staging
npx playwright test tests/e2e/capacity/ai-security.spec.ts --project=staging
```

> **Aviso**: Esta suite usa credenciales de prueba y genera llamadas al LLM real. Se recomienda ejecutar a demanda o en un schedule semanal para controlar los costos de API.
