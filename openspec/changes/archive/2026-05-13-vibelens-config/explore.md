# Exploration: VibeLens Configurable (Desactivación)

### Current State
Actualmente, VibeLens está habilitado por defecto y permanentemente activo. El pipeline de IA (`engine.ts` y `prompts.ts`) siempre asume que puede disparar `<vibe-action type="preview-component" />` para aislar componentes usando Sandpack. No existe ninguna opción en la interfaz ni en el estado para que el usuario apague este comportamiento si prefiere usar la previsualización tradicional sin que la IA intervenga aisladamente.

### Affected Areas
- **`src/stores/ui.ts`** — Necesita un nuevo estado persistido `vibeLensEnabled: boolean` y su acción correspondiente.
- **`src/components/settings/SettingsPanel.tsx`** — La pestaña "Layout" (o una nueva sección) requiere un toggle/switch visual para interactuar con esta configuración.
- **`src/pipeline/prompts.ts`** — La instrucción de emitir el tag `<vibe-action>` debe ser opcional y condicional basada en el estado.
- **`src/pipeline/engine.ts`** — Debe leer el estado `vibeLensEnabled`, inyectarlo como bandera en los prompts y rechazar peticiones de `preview-component` si están desactivadas.

### Approaches

1. **Global Store + Conditional Prompts (Recomendado)** 
   - Agregar `vibeLensEnabled` (default: `true`) a Zustand (`ui.ts`).
   - Exponer un UI Switch en `SettingsPanel.tsx` -> Tab: Layout.
   - Modificar `buildConstruirMessages` en `prompts.ts` para recibir `vibeLensEnabled` por parámetro.
   - En `engine.ts`, leer el store y pasarlo. Si la IA intenta mandar el comando de todas formas estando apagado, ignorarlo.
   - **Pros**: Limpio, respeta el patrón arquitectónico, ahorra tokens al no mandar la instrucción cuando está apagado.
   - **Cons**: Requiere modificar las firmas de las funciones de prompt.
   - **Effort**: Low

2. **Intercept at UI Level Only**
   - Dejar los prompts igual, pero si la IA lo emite, la capa UI (`LivePreview`) ignora el `previewTarget` si está apagado.
   - **Pros**: Menos cambios en el pipeline.
   - **Cons**: Gasto innecesario de tokens porque le seguimos diciendo a la IA que puede hacerlo. Riesgo de alucinaciones.
   - **Effort**: Low

### Recommendation
**Global Store + Conditional Prompts (Opción 1)**. Es la ruta más robusta. Al remover la instrucción del prompt cuando está desactivado, reducimos el uso de tokens y evitamos confusiones en la generación del modelo. Además, bloquear la acción en `engine.ts` ofrece una doble capa de seguridad.

### Risks
- **Testing**: Romper las pruebas existentes en `pipeline.test.ts` que esperan que el prompt siempre traiga esa regla, o que evalúan firmas de funciones. Habrá que actualizar los tests.
- **State Hydration**: Asegurar que la configuración se persista correctamente en el localStorage / idb.

### Ready for Proposal
Yes. Estoy listo para mostrar el plan de implementación (Proposal / Spec) al usuario o proceder directo al desarrollo.
