# Proposal: Vibe Premium UX (IDE Redesign)

## Intent
Transformar Vibe Studio en un IDE moderno (estilo Cursor/VS Code) implementando 10 componentes clave de productividad, manteniendo el lenguaje de diseño "Glass & Glow" (acentos violeta/cyan).

## Proposed Architecture

### 1. Explorador de Archivos Mejorado
- **Modificar**: `src/components/files/FileTree.tsx` y `ExplorerDock.tsx`.
- **Agregar**: Iconografía rica, carpetas desplegables y botones hover para `Crear Archivo` / `Crear Carpeta` directamente en la raíz y subcarpetas.

### 2. Pantalla Inicial (Welcome Screen)
- **Modificar**: `src/components/layout/EditorPanel.tsx`.
- **Agregar**: Layout centrado con acciones rápidas: Crear archivo, Crear componente, Abrir terminal, Ejecutar proyecto, y Preguntar a la IA.

### 3. Barra de Acción Superior (Top Bar)
- **Modificar**: `src/components/layout/ActionBar.tsx`.
- **Agregar**: Grupo de botones centrales: Ejecutar, Debug, Test, Preview, Deploy y Settings.

### 4. Terminal Inferior con Pestañas
- **Modificar**: `src/components/terminal/TerminalPanel.tsx` (y crear subcomponentes).
- **Agregar**: Navegación por pestañas: Terminal, Problemas, Consola, Git, y Logs. Ampliar `ui.ts` para manejar la pestaña activa de la terminal.

### 5. Panel de IA Avanzado
- **Modificar**: `src/components/layout/ChatPanel.tsx`.
- **Agregar**: Botones de acción rápida en la caja de input o debajo del código: Explicar código, Corregir errores, Optimizar, Generar endpoints, Crear tests, y Aplicar cambios.

### 6. Sistema de Errores Visual y Git
- **Agregar**: Panel de `Problemas` y `Git` integrados en la nueva arquitectura de la terminal.
- **Tauri IPC**: Crear wrappers (si no existen) para invocar `git status`, `git log` y manejar los problemas detectados en el pipeline de build/lint.

### 7. Mejoras Visuales (Glass & Glow)
- **Modificar**: `src/index.css` y utilidades de tailwind.
- **Agregar**: Mayor contraste en fondos, bordes suaves (white/5 a white/10), botones modernos con hover states (violeta a cyan).

## Risk Assessment
- **Complejidad de UI**: Rediseñar tantos componentes simultáneamente puede generar regresiones en el drag & drop y el manejo de ventanas.
- **Estado (Zustand)**: Añadir múltiples paneles requiere actualizar la sincronización del layout persistente (`persist` middleware).

## Next Steps
Aprobar esta propuesta para pasar a la fase de **Diseño** y la descomposición en **Tareas**.
