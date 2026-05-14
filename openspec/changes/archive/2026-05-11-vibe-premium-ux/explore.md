# SDD Explore: Vibe Premium UX (IDE Redesign)

## Contexto Actual
El usuario ha solicitado transformar Vibe Studio de un "editor de texto con IA" a un **IDE moderno y profesional**, adoptando convenciones de interfaces como Cursor y VS Code, pero manteniendo la estética "Glass & Glow" (violeta/cyan) propia de Vibe.

## Análisis de la Base de Código
He revisado los componentes principales de layout y funcionalidad:

1. **Explorador (`ExplorerDock.tsx`, `FileTree.tsx`)**:
   - Actualmente usa un sistema básico de menú contextual para crear archivos/carpetas. 
   - *Falta*: Botones en línea (hover) para crear archivos/carpetas en la raíz o en subcarpetas, e íconos más ricos.

2. **Pantalla Inicial (`EditorPanel.tsx`)**:
   - Tiene un estado vacío con accesos rápidos básicos (Ctrl+P, Ctrl+S) y el logo.
   - *Falta*: Acciones directas como "Crear componente", "Ejecutar proyecto", "Preguntar a IA".

3. **Barra Superior (`ActionBar.tsx`)**:
   - Es un menú estilo ventana nativa (Archivo, Editar, Ver).
   - *Falta*: Botones de ejecución directa en la barra (Run, Debug, Test, Deploy) característicos de un IDE.

4. **Terminal (`TerminalPanel.tsx`)**:
   - Es una terminal única en la parte inferior.
   - *Falta*: Un sistema de pestañas (Tabs) que divida Terminal, Problemas, Consola, Git y Logs.

5. **Panel de IA (`ChatPanel.tsx`)**:
   - Es un chat general de entrada de texto.
   - *Falta*: Una botonera de acciones rápidas sobre el código (Explicar, Corregir, Optimizar, Crear Tests).

6. **Sistema de Errores y Git**:
   - No hay interfaz dedicada para Git ni un panel de problemas consolidados.

## Desafíos Técnicos
- **Estado Global**: Se necesitará ampliar `ui.ts` para manejar las pestañas de la terminal y paneles de Git/Problemas.
- **Tauri IPC**: Para Git y ejecución de comandos, se requerirá invocar comandos de shell vía Tauri.
- **Diseño Glass & Glow**: Mantener el rendimiento CSS evitando reflows excesivos al agregar blur y gradientes en múltiples paneles nuevos.
