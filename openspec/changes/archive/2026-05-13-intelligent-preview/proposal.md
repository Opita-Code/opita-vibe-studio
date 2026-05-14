# Proposal: Intelligent Live Preview

## Intent

Actualmente, la vista previa (\`LivePreview.tsx\`) solo renderiza HTML, CSS y JS básico mediante un iframe con \`srcdoc\`. Esto limita severamente el desarrollo de aplicaciones React/TypeScript, impidiendo visualizar componentes de manera aislada.
El objetivo es crear una "VibeLens" estilo Storybook que se integre nativamente con el motor de IA. Cuando el usuario desarrolle un componente, la IA podrá generar dinámicamente un entorno aislado para renderizarlo, mostrando los cambios en tiempo real y ofreciendo una experiencia fluida de "Vibe Coding".

## Scope

### In Scope
- Integración de \`@codesandbox/sandpack-react\` para renderizar código React/TypeScript en el navegador sin dependencias de OS.
- Sincronización del estado de archivos del proyecto (\`useProjectStore\`) con el Virtual File System de Sandpack.
- "Modo Storybook": Capacidad para que la IA genere un archivo de entrada temporal (ej. \`src/.vibe/PreviewEntry.tsx\`) que monte el componente específico que el usuario está editando.
- Actualización de \`pipeline/engine.ts\` para emitir acciones de UI que cambien la vista previa al componente deseado.
- Refactorización de \`LivePreview.tsx\` para soportar el nuevo motor Sandpack.

### Out of Scope
- Configuración de un servidor Vite real en background usando procesos de sistema operativo de Tauri (se prefiere la solución client-side de Sandpack por su aislamiento y facilidad de integración "Storybook-like").
- Soporte para lenguajes de backend (Node.js/Python) en la vista previa.

## Capabilities

### New Capabilities
- \`intelligent-preview\`: Definición del entorno Sandpack, inyección de dependencias y orquestación del VFS (Virtual File System) para previsualizaciones aisladas.

### Modified Capabilities
- \`live-preview\`: Reemplazo del iframe estático por el componente de Sandpack. Actualización del manejo de errores y estados de carga.
- \`chat-assistant\`: Integración de comandos o intenciones para solicitar la "Vista Previa de Componente" durante las conversaciones.

## Approach

Reemplazaremos el renderizado basado en \`srcdoc\` con \`SandpackProvider\` y \`SandpackPreview\` de \`@codesandbox/sandpack-react\`. 
Cuando el usuario abra un archivo (ej. \`Button.tsx\`), la UI consultará si existe un archivo \`Button.story.tsx\` (o similar) o pedirá a la IA generar un \`App.tsx\` dinámico en memoria que importe y monte \`<Button />\`. Esto crea una experiencia idéntica a Storybook, pero totalmente autónoma e inteligente. Sandpack se encargará de transpilar TypeScript y JSX en tiempo real.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| \`src/components/preview/LivePreview.tsx\` | Modified | Se reemplazará el iframe nativo por \`SandpackPreview\`. |
| \`src/stores/project.ts\` | Modified | Lógica para inyectar el VFS a Sandpack. |
| \`src/pipeline/engine.ts\` | Modified | Interacción de IA para generar los wrappers de previsualización. |
| \`package.json\` | Modified | Añadir dependencia \`@codesandbox/sandpack-react\`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Consumo de Memoria por Sandpack | Medium | Optimizar enviando solo los archivos necesarios o limitar las dependencias cargadas en memoria. |
| Dependencias Nativas / Faltantes | Medium | Sandpack usa CDN para npm; si el usuario usa una librería exótica, puede fallar. Se notificará mediante errores en la UI. |

## Rollback Plan

Mantener el código actual de \`LivePreview.tsx\` renombrado como \`LegacyPreview.tsx\`. Si Sandpack falla al inicializarse o el usuario está offline, podemos hacer un fallback al motor anterior.

## Dependencies

- \`@codesandbox/sandpack-react\`
- Conexión a internet para descargar las dependencias del proyecto desde CDN de Sandpack.

## Success Criteria

- [ ] Instalar y montar \`Sandpack\` correctamente en el panel de Vista Previa.
- [ ] Visualizar un componente de React (.tsx) aislado con estilos de Tailwind.
- [ ] La IA es capaz de generar un wrapper de previsualización para un componente y mostrarlo automáticamente en la UI al cambiar el código.
