# Especificación: vibe-split-layout

## Requisitos Funcionales y Visuales
1. **Acceso Ininterrumpido al Explorador**: El usuario debe poder ver e interactuar con el `ExplorerDock` (explorador de archivos) mientras se encuentra en la vista dividida (`split`).
2. **Integridad del Layout**: El ancho del `ExplorerDock` (normalmente 256px) debe mantenerse fijo (`shrink-0`) para no ser aplastado por el código y la vista previa.
3. **Flujo Cero-Fricción**: Eliminar la imposibilidad de abrir un archivo nuevo si se entró a la vista dividida sin tener un documento previamente seleccionado.
