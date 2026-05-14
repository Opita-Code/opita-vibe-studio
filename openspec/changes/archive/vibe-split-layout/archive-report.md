# Archivo: vibe-split-layout

## Resumen del Cambio
Se rediseñó la experiencia del layout en modo pantalla dividida (Split) para Opita Vibe Studio. Antes, el modo split ocultaba el explorador de archivos (`ExplorerDock`), dejando a los usuarios bloqueados en el estado "Abre un archivo" sin posibilidad de abrir la barra lateral. Ahora, el `ExplorerDock` se renderiza siempre que se esté en modo `Editor` o en modo `Split`, manteniendo el comportamiento fluido de flexbox para el reparto del ancho de pantalla.

## Artefactos Finales
- `src/components/layout/EditorPanel.tsx`: Modificado para permitir el renderizado condicional inteligente del Explorador sin romper el grid CSS.

## Estado
Completado exitosamente. La experiencia de la vista previa es ahora de cero-fricción para nuevos usuarios.
