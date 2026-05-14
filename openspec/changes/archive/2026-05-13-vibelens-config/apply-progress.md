# Apply Progress: VibeLens Configurable

**Status**: Completado
**Phase**: `sdd-apply`

## Cambios Realizados
1. **Zustand (`src/stores/ui.ts`)**: Se añadió `vibeLensEnabled: boolean` y `setVibeLensEnabled`. Se configuró para que limpiar `previewTarget` cuando se apague.
2. **Settings UI (`src/components/settings/SettingsPanel.tsx`)**: Añadido un interruptor en el tab "Layout" para que el usuario pueda alternar libremente.
3. **Pipeline Condicional (`src/pipeline/prompts.ts` & `engine.ts`)**: Modificada la firma de `buildConstruirMessages`. Ahora, si la opción está desactivada, la IA no es instruida sobre el comando especial `<vibe-action>` reduciendo la latencia y el uso de tokens, además ignorando tags errantes.
4. **Pruebas**: Se actualizaron las firmas en los tests y se añadieron nuevas pruebas tanto en `ui.test.ts` (para el store global) como en `pipeline.test.ts` (para asegurar la restricción del pipeline).
