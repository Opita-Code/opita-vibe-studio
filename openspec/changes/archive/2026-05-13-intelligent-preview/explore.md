## Exploration: Vista Previa Inteligente

### Current State
Actualmente, \`LivePreview.tsx\` funciona de manera muy básica: envuelve el contenido del archivo activo (HTML, CSS o JS) en un iframe utilizando el atributo \`srcdoc\`. 
Esta aproximación tiene graves limitaciones:
- No soporta TypeScript (.ts, .tsx).
- No soporta JSX/React components nativamente.
- No procesa importaciones ni dependencias (NPM modules).
- No permite visualizar componentes aislados si el proyecto es complejo.

El usuario busca una "Vista Previa Inteligente" que actúe en sinergia con el chat (Vibe Coding), donde la IA pueda aislar, interpretar y renderizar un componente específico o una página completa mientras se trabaja en ella.

### Affected Areas
- \`src/components/preview/LivePreview.tsx\` — Necesitará ser reemplazado o refactorizado drásticamente para montar el nuevo motor.
- \`src/components/layout/EditorPanel.tsx\` — Lógica de cómo y qué archivo se pasa al motor de previsualización.
- \`src/stores/project.ts\` — Sincronización del estado de los archivos con el motor de previsualización (HMR o inyección dinámica).
- \`src/pipeline/engine.ts\` — La IA necesitará capacidad para orquestar la vista previa (ej. crear un wrapper \`VibePreviewWrapper.tsx\` que importe el componente que el usuario quiere ver).

### Approaches

1. **Sandpack (@codesandbox/sandpack-react)**
   - **Descripción**: Integrar el motor de CodeSandbox en el navegador. Recibe los archivos desde Zustand y los compila/renderiza en tiempo real en un iframe. Para previsualizar un componente específico, la IA puede sobreescribir dinámicamente el \`App.tsx\` de Sandpack para que importe y renderice dicho componente.
   - **Pros**: 
     - 100% Client-side, no requiere gestionar procesos del OS ni puertos locales.
     - Soporta dependencias NPM y bundlers (Vite/CRA) dentro del navegador.
     - Aislamiento perfecto. Rápido para "jugar" con componentes.
   - **Cons**: 
     - Duplica el trabajo si el usuario ya tiene su proyecto corriendo localmente.
     - Puede tener limitaciones con proyectos muy complejos o acceso a APIs de backend.
   - **Effort**: Medium

2. **Servidor de Desarrollo Local (Vite Proxy + Tauri)**
   - **Descripción**: Dado que Vibe Studio corre en local via Tauri, podemos aprovechar el servidor Vite que ya corre el usuario (\`npm run dev\`). La Vista Previa sería un iframe apuntando a \`http://localhost:5173\`. Para "Inteligencia", la IA podría crear un archivo \`src/.vibe/PreviewWrapper.tsx\` y alterar el enrutador para mostrar solo ese componente si se le indica.
   - **Pros**: 
     - Usa el entorno real del proyecto, acceso total a variables de entorno, backend y librerías instaladas.
     - No consume recursos extra (el proceso ya corre).
   - **Cons**: 
     - Requiere manejar puertos de manera dinámica y detectar si el server está encendido.
     - Mayor acoplamiento con la estructura del proyecto del usuario.
   - **Effort**: Medium-High

3. **Arquitectura Híbrida (WebContainers / Local fallback)**
   - **Descripción**: Usar un entorno tipo WebContainers o Sandpack para "Modo Componente Aislado" y permitir un switch manual/automático a "Modo Proyecto (Localhost)" cuando el usuario requiere la página completa.

### Recommendation
**Sandpack (@codesandbox/sandpack-react)** es la opción más cercana a la "experiencia de una unidad de vibe coding". Permite a la IA inyectar código dinámicamente y previsualizar archivos .tsx sin depender de que el usuario tenga configurado y corriendo su servidor local en ese momento. Para la integración IA, podemos exponer una acción (ej. \`<vibe-action type="preview-component" value="src/components/Button.tsx" />\`) que haga que el Chat actualice un estado global en zustand, indicando a Sandpack que use ese componente como \`Entry Point\` de la vista previa temporal.

### Risks
- **Sincronización de Archivos**: Sandpack requiere todos los archivos del proyecto, lo que puede ser pesado en proyectos gigantes. Necesitaremos optimizar qué archivos enviamos (ej. solo el árbol de dependencias del componente o los archivos abiertos).
- **Rendimiento**: Ejecutar el bundler de Sandpack dentro de Tauri (WebView2) requiere consumo de memoria.

### Ready for Proposal
Yes. Se puede proceder con el Proposal utilizando la integración de Sandpack para crear la experiencia de "Vista Previa Inteligente".
