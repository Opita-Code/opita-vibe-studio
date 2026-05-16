# Vibe AI Capacity & Staging E2E Benchmark

Este directorio contiene las pruebas de integración End-to-End especializadas en medir los límites de las capacidades del agente Vibe AI. Estas pruebas difieren de las pruebas unitarias/e2e normales en que:

1. **Prueban el LLM real**: Consumen tokens y evalúan la calidad del código generado, no solo la UI.
2. **Ejecutan en Staging (`dev.opitacode.com`)**: Para validar la resiliencia de la infraestructura de Lambdas, WebSockets y la latencia real.
3. **Miden Complejidad y Seguridad**: Tratan de romper el "Sandbox" y evalúan si el LLM puede manejar tareas de varios archivos.

## Niveles de Capacidad (Complexity Limits)

Las pruebas están estructuradas en niveles para encontrar el punto de quiebre (donde las alucinaciones o errores se vuelven dominantes).

- **Level 1 (Basic)**: Tareas de un solo archivo (Componentes UI puros).
- **Level 2 (Medium)**: Tareas multi-archivo con lógica simple (Componente + Store + Hook).
- **Level 3 (Advanced)**: Tareas transversales (Themes, Refactoring de patrones de estado).
- **Level 4 (Expert)**: Migración de paradigmas o grandes refactors (fuera de límite esperado para un modelo actual sin supervisión humana).

## Cómo ejecutar localmente

Se requiere usar el proyecto `staging` de Playwright, lo que forzará `baseURL` a `https://dev.opitacode.com` y aumentará los timeouts a 120s (necesario para las llamadas LLM largas).

```bash
npx playwright test tests/e2e/capacity --project=staging
```

> **Aviso**: Esta suite usa credenciales de prueba y genera llamadas al LLM real. Se recomienda ejecutar a demanda o en un schedule semanal para controlar los costos de API.
