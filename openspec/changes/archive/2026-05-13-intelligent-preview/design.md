# System Design: VibeLens (Intelligent Preview)

## Architecture Overview
VibeLens transforma el visor de HTML estático en un entorno interactivo completo dentro del navegador, integrándose con el VFS (Virtual File System) del editor para renderizar componentes React/TypeScript al instante.

Se utilizará la librería \`@codesandbox/sandpack-react\` para manejar la transpilación y el bundler del lado del cliente. 

## Component Design

### 1. VibeLens.tsx (Nuevo componente reemplazo de LivePreview.tsx)
- Reemplaza el iframe en crudo con \`<SandpackProvider>\`.
- Recibe \`fileContents\` (de \`useProjectStore\`) y los mapea a los \`files\` requeridos por Sandpack.
- Incluye internamente componentes de layout custom: \`<SandpackLayout>\` y \`<SandpackPreview>\`.
- Incluye un custom hook o watcher que actualiza el objeto \`files\` de Sandpack cada vez que el código cambia y se presiona Guardar.

### 2. VibeLens Engine (Gestor de Modos)
- **Modo Aplicación**: Sandpack se inicializa con el \`template="vite-react-ts"\`. El \`main.tsx\` y \`App.tsx\` definidos por el usuario se utilizan para la vista previa de la app completa.
- **Modo VibeLens (Aislado)**: Cuando se emite un requerimiento de aislar un componente, se inyecta en memoria (solo para Sandpack) un archivo llamado \`/src/VibeStoryEntry.tsx\` que importa directamente el componente y lo renderiza en el root. Al mismo tiempo, se sobreescribe virtualmente el \`index.html\` o el \`main.tsx\` para apuntar a \`VibeStoryEntry.tsx\` en vez de \`App.tsx\`.

### 3. Vibe AI Action Orchestrator
- Se añadirá a \`pipeline/engine.ts\` el parser para detectar la etiqueta \`<vibe-action type="preview-component" value="..." />\`.
- Esto ejecutará una acción en Zustand (ej. \`useUIStore.getState().setPreviewTarget(value)\`) que instruirá a VibeLens a cambiar de Modo Aplicación a Modo Aislado.

## Data Flow
1. **User Edit**: Usuario o IA edita \`Button.tsx\`.
2. **State Sync**: Zustand \`fileContents\` se actualiza.
3. **Save**: Ctrl+S incrementa \`version\`.
4. **Sandpack Sync**: VibeLens detecta el cambio de versión, reconstruye el objeto \`files\` y lo pasa al \`SandpackProvider\`.
5. **Preview Focus**: La IA emite \`<vibe-action type="preview-component" value="src/Button.tsx" />\`.
6. **VibeLens Routing**: VibeLens detecta el target, genera dinámicamente un \`main.tsx\` virtual que importa \`src/Button.tsx\` y lo envía a Sandpack. El componente se renderiza en aislamiento.

## Performance Considerations
- Sandpack transfiere grandes cantidades de datos al Worker. Para optimizar, no pasaremos la carpeta \`node_modules\` entera, solo los archivos de \`src/\` y el \`package.json\`. Sandpack instalará vía CDN lo especificado en \`package.json\`.
- Almacenamiento local: Sandpack cacheadará dependencias automáticamente usando Service Workers en WebView2.

## Security
- El componente se ejecuta en un iframe nativo sandboxed gestionado por CodeSandbox.
- No hay acceso a APIs del backend OS de Tauri desde dentro de Sandpack, protegiendo contra ejecución remota a nivel SO.
