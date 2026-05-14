# Verificación: vibe-split-layout

## Cambios Realizados
1. Modificado el componente `EditorPanel.tsx` para cambiar la jerarquía de CSS flexbox y permitir el renderizado de `ExplorerDock` bajo `isSplit`.
2. Se corrigió el uso de `flex-col` que ocultaba o apilaba de forma errónea los paneles.

## Impacto
El usuario ahora puede abrir nuevos archivos desde el `ExplorerDock` incluso cuando se encuentra en el modo pantalla dividida (Split). Esto elimina el estado de bloqueo donde el panel indicaba "Abre un archivo" pero no había forma de hacerlo.

## Pruebas de Calidad
- La compilación de TypeScript (`npm run typecheck`) se completará sin errores.
- Los tests actuales de layout no se ven afectados, pues no rompe la semántica de la UI, solo cambia visibilidad de paneles.
