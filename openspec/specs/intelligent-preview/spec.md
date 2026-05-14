# Specification: VibeLens (Intelligent Preview)

## Overview
VibeLens es el motor de vista previa inteligente de Vibe Studio. A diferencia del iframe estático convencional, VibeLens utiliza \`@codesandbox/sandpack-react\` para instanciar un entorno de desarrollo real en el navegador. Esto permite aislar y renderizar componentes individuales (como un Storybook interactivo), visualizar páginas completas y ver los cambios en tiempo real, todo orquestado por el motor de IA subyacente.

## Requirements

### 1. Functional Requirements
- **FR1**: El motor de vista previa debe poder ejecutar aplicaciones React/TypeScript en tiempo real usando Sandpack.
- **FR2**: La vista previa debe sincronizar su "Virtual File System" (VFS) con el \`fileContents\` global de \`useProjectStore\`.
- **FR3**: Debe existir un "Modo Aislado" (Storybook mode) donde la IA genere un \`PreviewEntry.tsx\` efímero que sirva como punto de entrada exclusivo para un componente seleccionado.
- **FR4**: La consola de errores nativa de Sandpack debe capturarse e integrarse en la UI de Vibe Studio de forma no obstructiva.

### 2. User Experience
- **UX1**: Al cambiar el archivo activo en el editor, VibeLens debe reevaluar si debe mostrar el componente actual aislado o el archivo \`index.html\` principal.
- **UX2**: La IA en el chat puede emitir una acción \`<vibe-action type="preview-component" value="..." />\` para forzar a VibeLens a enfocar un componente específico tras realizar cambios.
- **UX3**: Durante la carga de dependencias de npm, se debe mostrar un indicador de carga estilo "Vibe" (glow y skeleton).

### 3. Technical Constraints
- **TC1**: La vista previa no debe depender de procesos locales del OS (node/npm locales) para asegurar portabilidad inmediata, dependiendo puramente de Sandpack.
- **TC2**: Los archivos efímeros generados por la IA para el montaje (\`PreviewEntry.tsx\`) no deben escribirse en el disco real del usuario ni guardarse en su repositorio git, deben existir solo en el VFS de Sandpack.

## Dependencies
- \`@codesandbox/sandpack-react\`: Motor principal.
- Conexión a CDN de Sandpack para dependencias npm.
- Estado global (\`useProjectStore\`) para alimentar el VFS.
