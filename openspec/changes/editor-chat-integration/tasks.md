# SDD Tasks: Editor-Chat Integration

## PR 1: Catálogo de Modelos y Bloqueos de Plan (Slice 1)
- [ ] Modificar `src/providers/registry.ts` para registrar los nuevos modelos:
  - `deepseek-v4-flash` (Opita Flash V4, tier: free)
  - `deepseek-v4-pro` (Opita Pro V4, tier: free)
  - `gemini-2.5-pro` (Gemini Pro, tier: free)
- [ ] Añadir la propiedad `requiredPlanTier?: number` a `ModelConfig` en `src/providers/types.ts` y rellenarla en el catálogo de `registry.ts`:
  - `gemini-2.5-flash`: tier 0
  - `deepseek-v4-flash`: tier 1
  - `deepseek-v4-pro`, `gemini-2.5-pro`, `deepseek-reasoner`: tier 2
- [ ] Modificar `src/agent/model-router.ts` para restaurar el enrutamiento automático a `deepseek-v4-pro` y `deepseek-v4-flash`.
- [ ] Ejecutar y verificar pruebas unitarias del enrutador de modelos: `npx vitest run src/agent/__tests__/model-router.test.ts`.
- [ ] Modificar `src/components/chat/ChatInput.tsx` para bloquear modelos por encima del tier actual del usuario, renderizar candados y disparar las intenciones de compra `estudiante_model` / `pro_model`.

## PR 2: Acciones Rápidas del Editor (Slice 2)
- [ ] Añadir botones contextuales (**Explicar**, **Optimizar**, **Fix**, **Tests**) en `src/components/editor/EditorToolbar.tsx`.
- [ ] Implementar la lógica para abrir el chat si está cerrado al hacer clic en un botón.
- [ ] Integrar el envío del prompt predefinido adjuntando el código del archivo activo.

## PR 3: Inyección de Contexto en Chat y Guardas de Tamaño (Slice 3)
- [ ] Añadir en `src/stores/chat.ts` la propiedad de estado `shareActiveFileContext` y la acción `setShareActiveFileContext`.
- [ ] Crear la barra indicadora sobre el input de chat en `src/components/chat/ChatInput.tsx`: `📎 Contexto activo: [filename]`.
- [ ] Implementar la lógica de desactivación automática con advertencia de tokens si el archivo supera las 1500 líneas.
- [ ] Modificar `src/agent/useAgentHandler.ts` para adjuntar el contenido completo del archivo activo en el array `attachments` si el toggle está activado.

## PR 4: Backend Fallbacks y Protección de Tool Calling (Slice 4)
- [ ] Modificar `packages/vibe-ai-backend/src/api/chat.ts` para resolver correctamente `deepseek-v4-pro` y `deepseek-v4-flash` en la función `getModel()`.
- [ ] Implementar en el backend la degradación automática de `deepseek-reasoner` a `deepseek-v4-pro` si se envían herramientas.
- [ ] Implementar el fallback recíproco: si falla DeepSeek, reintentar con `gemini-2.5-flash` escribiendo una línea indicadora en el stream de respuesta.
