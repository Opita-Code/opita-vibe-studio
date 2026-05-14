# Proposal: V1.0 Desktop UX (Onboarding, BYOK y Agentic UI)

## Contexto y Motivación
Vibe Studio actualmente es una beta altamente funcional. Cuenta con un backend escalable en AWS (Serverless) y un puente nativo (Tauri IPC) que le da capacidades "agentic" al LLM. Sin embargo, carece de la experiencia de usuario esperable en un producto V1.0 de Opita Code. Un estudiante que instala el programa por primera vez se encuentra con un editor vacío sin saber cómo conectarse, y durante el uso del chat de inteligencia artificial, las interacciones con la terminal (vía MCP) ocurren invisiblemente en segundo plano, lo que causa confusión.

## Objetivos del Cambio
1. **Onboarding / BYOK:** Pantalla inicial para usuarios nuevos donde configuren su clave (Bring Your Own Key) o inicien sesión con Opita Code, guiándolos en los atajos de teclado básicos.
2. **Feedback Visual MCP:** Animar el panel del chat cada vez que la IA esté ejecutando un comando local (ej. corriendo `vitest` o leyendo archivos) para que el usuario sepa que la IA está interactuando con su computadora local.
3. **Control de Flujo:** Botón para "Cancelar Generación" (`AbortController`) durante streaming SSE.
4. **Resiliencia (Estado Offline):** Manejo elegante si la solicitud a AWS falla.

## Alcance Arquitectónico

### Frontend (React + Zustand)
- **Modificación de Rutas / Estado de Autenticación:** El estado global `useAuthStore` determinará la vista principal. Si `!hasCompletedOnboarding`, se renderiza `<OnboardingFlow />` en vez de `<EditorPanel />`.
- **UI del Chat:** Extender el store `useChatStore` para soportar estados como `isExecutingMCP` y `isStreaming`. El `<ChatPanel />` mostrará un loader animado inspirado en "Glass & Glow".
- **Interrupción SSE:** Extender `aiService.ts` para que la función `streamAwsSse` reciba una señal de un `AbortController` permitiendo al usuario cortar la comunicación si la IA está generando respuestas largas innecesarias.

### Core (Tauri)
- Las llamadas a `window.__TAURI__.invoke` ya están cableadas. Solo requieren que el Frontend dispare notificaciones UI antes y después de `execute_mcp_command`.
- Las variables se almacenarán en `localStorage` (vía persistencia de Zustand) para el estado del Onboarding y configuración BYOK.

## Riesgos y Mitigaciones
- **Cancelación Incompleta:** Si se aborta el fetch de SSE mientras la IA pedía ejecutar un script de terminal largo, el proceso local (Tauri command) podría seguir corriendo huérfano. *Mitigación:* Guardar un token local de cancelación o asegurar que los scripts tengan un timeout estricto.
- **Rendimiento Visual:** Múltiples animaciones de "Glass & Glow" al mismo tiempo (chat stream + MCP spinner) podrían causar repaints pesados. *Mitigación:* Usar animaciones CSS de opacidad y transformación (`translate`, `opacity`) que usan la GPU en vez de cambiar layout.

## Siguiente Fase Sugerida
Pasar a Especificación Detallada (`spec.md`) donde se mapeará el modelo Zustand a usar y la estructura exacta de componentes del Onboarding.
