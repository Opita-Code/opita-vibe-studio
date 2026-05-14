# Design: Vibe Premium UX

## Data Models & Store (`ui.ts`)

```ts
// Nuevas propiedades en UIStore
export interface UIState {
  // ... existente ...
  activeTerminalTab: "terminal" | "problems" | "output" | "git";
  setActiveTerminalTab: (tab: "terminal" | "problems" | "output" | "git") => void;
}
```

## Component Architecture

### `TerminalPanel.tsx`
Se dividirá visualmente en un área superior de pestañas (Tabs) y un área de contenido (Content).
- Si `activeTerminalTab === "terminal"`, muestra la consola interactiva (`execShell`).
- Si `activeTerminalTab === "git"`, muestra un nuevo subcomponente `GitPanel.tsx` que agrupe acciones como `git status` y diffs.
- Si `activeTerminalTab === "problems"`, mostrará un placeholder indicando que no hay problemas de lint.

### `ActionBar.tsx`
Modificar la estructura de flexbox.
- Izquierda: Branding + Menús desplegables (existente).
- Centro (Nuevo): Grupo de botones de íconos (Run, Debug, Test, Preview, Deploy) con `hover:bg-white/10 text-vibe-cyan`.
- Derecha: Botón Exportar, Configuración, Perfil.

### `EditorPanel.tsx` (Welcome Screen)
- Reemplazar el layout vertical de texto por una cuadrícula o tarjetas (cards) atractivas tipo Glassmorphism.
- Funciones:
  - `handleNewFile`: Invoca el store o FS para crear y abrir un archivo "Sin título".
  - `handleOpenTerminal`: Hace `setTerminalVisible(true)`.

### `ExplorerDock.tsx` y `FileTree.tsx`
- En `FileTreeNode`, cuando `isHovered` es true, renderizar dos pequeños botones (`+` para archivo, `+` para carpeta) que activan `InlineCreateInput`.
- Mantener la funcionalidad contextual, pero darle más visibilidad.

## UX Flow
1. Usuario abre la app y ve el nuevo Welcome Screen con botones de acceso directo.
2. Abre un proyecto, el File Explorer tiene ahora acciones en línea mucho más fáciles de clickear.
3. El botón "Preview" en el ActionBar central permite alternar a la vista Live Preview rápidamente sin navegar los menús.
4. El panel inferior aloja múltiples utilidades sin recargar el layout.
