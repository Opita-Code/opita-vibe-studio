# Archive Report: VibeLens Configurable

**Change Name**: `vibelens-config`
**Completion Date**: 2026-05-11

## 1. Executive Summary
Se implementó exitosamente la capacidad de habilitar y deshabilitar VibeLens ("Modo Aislado") mediante un switch accesible desde el panel de configuración ("Layout"). Este ajuste se sincroniza de forma global a través del estado persistente en Zustand e impacta al pipeline de inteligencia artificial.

## 2. Core Decisions
- Se eligió persistir la bandera `vibeLensEnabled` en `ui.ts` para que sobreviviera recargas de página.
- El system prompt base `CONSTRUIR_BASE` en `prompts.ts` ya no enseña sobre VibeLens de manera predeterminada. Ahora, esta directiva solo se adhiere si el usuario tiene el toggle encendido.
- Se impuso un mecanismo de validación secundario en `engine.ts` para desestimar por completo cualquier intento de aislamiento por parte del LLM en caso de estar desactivado VibeLens.

## 3. Key Files Changed
- `src/stores/ui.ts` (Estado y persistencia).
- `src/components/settings/SettingsPanel.tsx` (UI toggle).
- `src/pipeline/prompts.ts` (Condicionalidad del LLM).
- `src/pipeline/engine.ts` (Filtrado del LLM).
- `tests/pipeline/pipeline.test.ts` (Pruebas de inyección y rechazo de VibeLens).
- `tests/stores/ui.test.ts` (Limpieza de `previewTarget` al apagarse).

## 4. Pending Risks / Debts
- Ningún riesgo o deuda introducido por esta función.
- Restan pendientes >600 errores de linting documentados.

**Final Status**: CHANGE ARCHIVED AND COMPLETED.
