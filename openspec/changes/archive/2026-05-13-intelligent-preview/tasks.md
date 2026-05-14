# Tasks: VibeLens Implementation

## Review Workload Forecast
- **Estimated changed lines**: 250
- **Chained PRs recommended**: No (Fits within budget)
- **Decision needed before apply**: No
- **Execution Strategy**: `auto-chain` (Safe for single implementation batch)

## Implementation Tasks

### 1. Preparación e Instalación
- [x] Instalar la dependencia `@codesandbox/sandpack-react` en el `package.json`.
- [x] Añadir `sandpack-react` a la configuración de optimización de Vite si es necesario para evitar problemas de HMR de las librerías base.

### 2. Actualización de Estados Globales
- [x] Modificar `src/stores/ui.ts`:
  - Añadir el estado `previewTarget: string | null` (indica si VibeLens debe enfocar un componente específico o usar el entrypoint global).
  - Añadir acciones `setPreviewTarget(target)`.

### 3. VibeLens Engine (Reemplazo de LivePreview)
- [x] Refactorizar `src/components/preview/LivePreview.tsx`:
  - Eliminar el iframe estático que usa `srcdoc`.
  - Importar `SandpackProvider`, `SandpackLayout` y `SandpackPreview`.
  - Implementar lógica que convierta `fileContents` (de `useProjectStore`) en el formato de archivos requerido por `files` prop de Sandpack.
  - Implementar el *Modo VibeLens (Aislado)*: Si `previewTarget` está definido, inyectar dinámicamente un archivo virtual `src/.vibe/PreviewEntry.tsx` en el VFS de Sandpack y actualizar el `main.tsx` temporalmente para montarlo.

### 4. Integración de Vibe AI (Asistente de Chat)
- [x] Modificar `src/pipeline/prompts.ts`:
  - Enseñar al LLM sobre la capacidad de VibeLens.
  - Añadir la instrucción para emitir `<vibe-action type="preview-component" value="path/del/componente.tsx" />` cuando el usuario trabaja en un componente aislado.
- [x] Modificar `src/components/layout/ChatPanel.tsx` o `src/pipeline/engine.ts`:
  - Capturar la acción `preview-component` en el pipeline de respuestas de texto y mutar el estado global `useUIStore.getState().setPreviewTarget(value)`.

### 5. Pulido de UX / UI
- [x] Actualizar el diseño del panel de vista previa para mostrar un sub-header cuando se está en "Modo Aislado", indicando el componente actual y permitiendo "Cerrar Modo Aislado" para volver a la aplicación completa.
- [x] Asegurarse de que los estilos CSS globales (Tailwind) del usuario se carguen correctamente en el entorno de Sandpack.

## Verificación (sdd-verify)
- [ ] Ejecutar la aplicación de prueba e invocar el chatbot pidiéndole que aísle un componente.
- [ ] Validar que la vista previa se actualiza sin requerir reinicios manuales cuando se edita un componente en `MonacoEditor`.
