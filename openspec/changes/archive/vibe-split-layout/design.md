# Diseño Técnico: vibe-split-layout

## Componentes a Modificar

### `src/components/layout/EditorPanel.tsx`
El renderizado condicional actual del explorador es:
`{isEditor && <ExplorerDock />}`

Debe actualizarse para abarcar la vista dividida:
`{(isEditor || isSplit) && <ExplorerDock />}`

**Consideraciones CSS (Flexbox):**
La estructura del contenedor del editor en la línea 228 es:
```tsx
<div className={`overflow-hidden transition-opacity duration-150 ${isEditor ? "flex flex-1" : isSplit ? "flex flex-col" : "hidden"}`} ...>
```
Al inyectar el `ExplorerDock` dentro de un `flex-col` (cuando `isSplit` está activo), el Dock se pondrá *arriba* del editor de código en vez de *a la izquierda*.
Para evitar esto, debemos asegurar que el contenedor interno que envuelve al `ExplorerDock` y el `editorSection` mantenga una disposición horizontal (`flex-row`), independientemente de si estamos en `isEditor` o `isSplit`.

### Rediseño del contenedor de la derecha
```tsx
      <div
        className={`overflow-hidden transition-opacity duration-150 flex ${
          isPreview ? "hidden" : "flex-1"
        }`}
        style={
          isSplit
            ? { flexBasis: `${(1 - splitRatio) * 100}%` }
            : undefined
        }
      >
        {(isEditor || isSplit) && <ExplorerDock />}
        {editorSection}
      </div>
```
Esto mantendrá el `ExplorerDock` a la izquierda y el `editorSection` a su derecha.
