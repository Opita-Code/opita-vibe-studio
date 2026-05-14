# Delta Specifications: VibeLens Integration

This document outlines the modifications to existing capabilities required to integrate VibeLens (Intelligent Preview).

## Modified Capability: \`live-preview\`

### Current Behavior
La vista previa se renderiza en un \`iframe\` utilizando un \`srcdoc\` inyectado con HTML estático, CSS y JS básico compilados por \`buildPreviewContent\`. Las dependencias y código React/TSX no funcionan.

### New Behavior
- El componente \`LivePreview.tsx\` se reconstruirá en base a \`SandpackProvider\` y \`SandpackPreview\`.
- \`buildPreviewContent\` ya no necesitará hacer templates HTML en crudo para React; en su lugar, se alimentará el Virtual File System de Sandpack.
- Mantendrá el diseño actual de borde con glassmorphism, indicador de carga y banner de error, pero adaptados al estado interno de Sandpack (\`useSandpack\`).
- Permitirá modo "aislado" inyectando un archivo temporal que renderice \`activeTab\` en lugar de \`App.tsx\`.

## Modified Capability: \`chat-assistant\`

### Current Behavior
El asistente de chat solo detecta cambios en el código y emite acciones simples como \`set-view\` o \`open-file\`. No tiene noción de la vista previa interactiva.

### New Behavior
- El prompt del sistema del motor de IA (\`pipeline/prompts.ts\`) se enriquecerá para instruirle sobre "VibeLens".
- El asistente podrá emitir una nueva acción: \`<vibe-action type="preview-component" value="path/to/component.tsx" />\`.
- Cuando esta acción sea emitida, el layout forzará la apertura del \`PreviewPanel\` y orquestará a Sandpack para que monte \`path/to/component.tsx\` en aislamiento.
