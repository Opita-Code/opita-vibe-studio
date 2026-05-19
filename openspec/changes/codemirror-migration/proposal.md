# Migración Monaco → CodeMirror 6

Reemplazar el editor Monaco por CodeMirror 6 para obtener control total sobre la estética visual (cursor, widgets, tema), reducir el bundle ~25x (5MB → 200KB), y eliminar costo muerto de features deshabilitados (TypeScript IntelliSense, workers).

## Decisiones de Diseño

### 1. React Integration: Hook propio vs `@uiwjs/react-codemirror`

**Decisión**: Hook propio (`useCodeEditor`).

- `@uiwjs/react-codemirror` agrega una capa de abstracción innecesaria sobre CM6
- CM6 maneja su propio DOM — React no necesita controlar el árbol del editor
- Un hook simple (`useRef` + `useEffect` para montar/desmontar `EditorView`) es más ligero y nos da control total
- Evitamos dependencia externa para algo que son ~40 líneas de glue code

### 2. Theming: CSS-first

El tema se define con `EditorView.theme({...}, { dark: true })` — CSS puro, sin tokens abstractos.

```typescript
const vibeTheme = EditorView.theme({
  "&": {
    backgroundColor: "#0B0D13",
    color: "#e2e8f0",
    fontSize: "14px",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    caretColor: "#00f0ff",           // vibe-cyan cursor
    padding: "24px 0",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#00f0ff",       // vibe-cyan
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#00f0ff33",     // vibe-cyan 20%
  },
  ".cm-gutters": {
    backgroundColor: "#0B0D13",
    color: "#475569",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#ffffff0a",
  },
  ".cm-activeLine": {
    backgroundColor: "#ffffff0a",
  },
  // Autocomplete / widgets — NO más cuadros blancos
  ".cm-tooltip": {
    backgroundColor: "#0F1118",
    border: "1px solid #ffffff15",
    borderRadius: "8px",
  },
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#0F1118",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#ffffff15",
  },
}, { dark: true });
```

### 3. Language Loading: Dinámico por extensión

En lugar de cargar todos los lenguajes upfront, lazy-load por demanda:

```typescript
async function getLanguageExtension(lang: string): Promise<Extension> {
  switch (lang) {
    case "javascript":
    case "javascriptreact":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true });
    case "typescript":
    case "typescriptreact":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true });
    case "html":
      return (await import("@codemirror/lang-html")).html();
    // ... etc
    default:
      return [];
  }
}
```

### 4. Diff View: `@codemirror/merge`

```typescript
import { MergeView } from "@codemirror/merge";

const mergeView = new MergeView({
  a: { doc: originalContent, extensions: [vibeTheme, ...] },
  b: { doc: modifiedContent, extensions: [vibeTheme, ...] },
  parent: container,
});
```

### 5. Navigate-to-Line: `EditorView.dispatch`

```typescript
// Scroll + cursor + highlight temporal
function navigateToLine(view: EditorView, line: number) {
  const lineInfo = view.state.doc.line(line);
  view.dispatch({
    selection: { anchor: lineInfo.from },
    effects: EditorView.scrollIntoView(lineInfo.from, { y: "center" }),
  });
  // Highlight temporal con StateEffect
}
```

## Componentes

### `CodeEditor.tsx` [NEW]
- Props: `{ path, value, onChange, isDiff?, originalValue?, modifiedValue? }`
- Misma interfaz que `MonacoEditor` → drop-in replacement
- Hook interno `useCodeEditor` maneja lifecycle de `EditorView`
- Escucha `vibe:navigate-to-line` igual que Monaco

### `useCodeEditor.ts` [NEW]
- Crea/destruye `EditorView` en `useEffect`
- Reconfigura extensions cuando cambia `path` (lenguaje) o `isDiff`
- Sincroniza `value` externo ↔ estado interno sin loops

### `vibe-editor-theme.ts` [NEW]
- Exporta `vibeTheme` + `vibeHighlightStyle`
- CSS-first, colores del design system Vibe
- Cursor, selección, gutters, tooltips — todo controlado

### `language-loader.ts` [NEW]
- `getLanguageExtension(langId) → Promise<Extension>`
- Lazy loads por demanda
- Reutiliza `detectLanguage()` existente sin cambios

### `MonacoEditor.tsx` [DELETE]
### `MonacoEditor.stories.tsx` [DELETE]

### `EditorPanel.tsx` [MODIFY]
- Cambiar lazy import de `MonacoEditor` → `CodeEditor`

### `language.ts` [MODIFY]
- Los IDs de lenguaje CM6 son los mismos que Monaco para JS/TS/HTML/CSS/Python/etc.
- Solo ajustar casos edge (`typescriptreact` → sigue siendo válido como clave de lookup)

### `package.json` [MODIFY]
- Remover: `@monaco-editor/react`, `monaco-editor`
- Agregar: `codemirror`, `@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-json`, `@codemirror/lang-markdown`, `@codemirror/lang-python`, `@codemirror/lang-xml`, `@codemirror/lang-yaml`, `@codemirror/merge`, `@lezer/highlight`

## Verificación

1. **Typecheck**: `npx tsc --noEmit` — 0 errores
2. **Tests**: `npx vitest run` — 1290+ tests pasan (Monaco no tiene tests directos)
3. **Visual**: Abrir la app, verificar:
   - Cursor visible y fluido
   - Syntax highlighting JSX/TSX
   - Tema dark consistente (sin cuadros blancos)
   - Diff view funcional
   - Navigate-to-line desde FileRefChip
   - Autocomplete con tema dark
4. **Bundle**: Verificar reducción de bundle size
