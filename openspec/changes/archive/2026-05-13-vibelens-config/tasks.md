# Tasks: VibeLens Configurable

## Fase 1: Estado Global (UI Store)
- `[ ]` Actualizar `src/stores/ui.ts`: Añadir `vibeLensEnabled` (default `true`) al estado y al `partialize`.
- `[ ]` Actualizar `src/stores/ui.ts`: Añadir acción `setVibeLensEnabled` que además asigne `previewTarget: null` si se pasa a `false`.
- `[ ]` Actualizar `tests/stores/ui.test.ts`: Añadir un unit test para asegurar que `setVibeLensEnabled(false)` limpie el target actual de la previsualización.

## Fase 2: Pipeline Inteligente (Prompts y Engine)
- `[ ]` Actualizar `src/pipeline/prompts.ts`: Modificar `buildConstruirMessages` para aceptar `vibeLensEnabled` e inyectar condicionalmente la directriz de `<vibe-action>`.
- `[ ]` Actualizar `src/pipeline/engine.ts`: Leer `vibeLensEnabled` del store. Pasarlo al builder de mensajes y condicionar el parsing del `<vibe-action>` final a que esté encendido.
- `[ ]` Actualizar `tests/pipeline/pipeline.test.ts`: Adaptar las pruebas existentes a la nueva firma, y añadir un test que verifique que si `vibeLensEnabled` es falso, la acción del LLM se ignora.

## Fase 3: Interfaz Visual (Settings)
- `[ ]` Actualizar `src/components/settings/SettingsPanel.tsx`: Añadir una tarjeta en el tab "Layout" con un toggle encendido/apagado para controlar `vibeLensEnabled`.
