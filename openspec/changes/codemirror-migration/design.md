# Vibe Pad — Diseño Técnico

> Editor de código agent-native, construido sobre CodeMirror 6, diseñado para el ecosistema Vibe Studio.

## Filosofía de Diseño

Vibe Pad no es un "editor de código que también funciona con un agente". Es un **editor que nació para ser controlado por un agente de IA**, donde la edición manual es el modo secundario. Cada decisión de diseño prioriza el flujo: **agente escribe → usuario revisa → usuario ajusta**.

## Paleta Aura

Todos los colores vienen del design system existente:

```
Background:     #09090b  (obsidian-900)
Surface:        #121217  (obsidian-800)
Elevated:       #1c1c21  (obsidian-700)
Cursor:         #06b6d4  (aura-cyan)
Selection:      #06b6d433 (aura-cyan 20%)
Agent Marker:   #a855f7  (aura-purple)
Agent Glow:     #a855f730 (aura-purple 19%)
Error:          #f43f5e  (rose-500)
Warning:        #f59e0b  (amber-500)
Success:        #10b981  (emerald-500)
Text Primary:   #e2e8f0  (slate-200)
Text Secondary: #475569  (slate-600)
Text Muted:     #334155  (slate-700)
```

## Arquitectura de Componentes

```
src/components/editor/
├── VibePad.tsx              ← Componente principal (drop-in replacement)
├── useVibePad.ts            ← Hook: lifecycle de EditorView
├── vibe-pad-theme.ts        ← Tema Aura + syntax highlighting
├── language-loader.ts       ← Lazy-load de grammars por extensión
├── extensions/
│   ├── agent-gutter.ts      ← Gutter con marcadores de cambios del agente
│   ├── navigate-highlight.ts ← Navigate-to-line + highlight temporal
│   └── agent-activity.ts    ← Escucha agentBus, muestra estado en tiempo real
└── VibePadDiff.tsx           ← Vista de diff (MergeView wrapper)
```

## Componentes Detallados

### 1. `VibePad.tsx` — Componente Principal

```typescript
interface VibePadProps {
  /** Ruta del archivo (detecta lenguaje) */
  path: string;
  /** Contenido actual */
  value: string;
  /** Callback de cambios */
  onChange?: (value: string) => void;
  /** Modo diff */
  isDiff?: boolean;
  originalValue?: string;
  modifiedValue?: string;
}
```

- Misma interfaz que `MonacoEditor` → drop-in replacement en `EditorPanel`
- Renderiza un `<div ref={containerRef}>` — CM6 monta su DOM ahí
- Condicional: si `isDiff` → renderiza `<VibePadDiff>` en su lugar

### 2. `useVibePad.ts` — Hook de Lifecycle

Responsabilidades:
- Crear `EditorView` con extensiones configuradas al montar
- Destruir `EditorView` al desmontar
- Reconfigurar extensiones cuando cambia `path` (nuevo lenguaje)
- Sincronizar `value` externo → estado interno SIN loops infinitos
- Escuchar `vibe:navigate-to-line` y despachar scroll + highlight

**Sincronización bidireccional:**
```
value externo cambia → verificar si difiere del doc actual → dispatch changes
usuario edita → onChange callback → padre actualiza value → hook detecta que ya es igual → no-op
```

### 3. `vibe-pad-theme.ts` — Tema Aura

Dos exportaciones:
- `vibePadTheme` — `EditorView.theme({...}, { dark: true })` con TODOS los selectores CSS
- `vibePadHighlight` — `HighlightStyle.define()` para syntax tokens

**Selectores CSS del tema:**

| Selector | Estilo | Propósito |
|----------|--------|-----------|
| `&` | bg obsidian-900, color slate-200 | Root |
| `.cm-content` | JetBrains Mono 14px, caret aura-cyan, padding 24px top | Área de texto |
| `&.cm-focused .cm-cursor` | border-left 2px aura-cyan, box-shadow glow | Cursor visible y limpio |
| `.cm-selectionBackground` | bg aura-cyan 20% | Selección |
| `.cm-gutters` | bg obsidian-900, no border | Gutter limpio |
| `.cm-activeLineGutter` | bg white 4% | Línea activa gutter |
| `.cm-activeLine` | bg white 4% | Línea activa |
| `.cm-tooltip` | bg obsidian-800, border white/10, radius 8px | Tooltips oscuros |
| `.cm-tooltip-autocomplete li[aria-selected]` | bg white/10 | Item seleccionado |
| `.cm-matchingBracket` | bg aura-cyan 15%, border-bottom aura-cyan | Brackets matching |
| `.cm-searchMatch` | bg aura-cyan 25% | Resultados de búsqueda |
| `.cm-foldGutter` | color slate-600 | Fold indicators |

**Syntax Highlighting (HighlightStyle):**

| Token | Color | Ejemplo |
|-------|-------|---------|
| keyword | `#c084fc` (purple-400) | `const`, `return`, `if` |
| string | `#86efac` (green-300) | `"hello"` |
| number | `#fde68a` (amber-200) | `42`, `3.14` |
| comment | `#475569` (slate-600) | `// nota` |
| function | `#67e8f9` (cyan-300) | `myFunc()` |
| typeName | `#7dd3fc` (sky-300) | `interface`, `type` |
| tagName | `#7dd3fc` (sky-300) | `<div>`, `<App>` |
| attributeName | `#c4b5fd` (violet-300) | `className=` |
| operator | `#94a3b8` (slate-400) | `=`, `=>`, `+` |
| variableName | `#e2e8f0` (slate-200) | Variables locales |
| propertyName | `#93c5fd` (blue-300) | `obj.prop` |
| bool | `#fbbf24` (amber-400) | `true`, `false` |
| null | `#f87171` (red-400) | `null`, `undefined` |

### 4. `extensions/agent-gutter.ts` — Agent Gutter

Un gutter decorativo que muestra qué líneas fueron modificadas por el agente:

- Escucha `agentBus` → `file-changed` events
- Cuando el archivo activo coincide con el path del evento, marca las líneas modificadas
- **Indicador visual**: Punto aura-purple (●) en el gutter con sutil glow
- Las marcas se limpian al guardar o después de 30 segundos
- Implementación: `GutterMarker` personalizado + `StateField` que trackea líneas

### 5. `extensions/navigate-highlight.ts` — Navigate to Line

Escucha `vibe:navigate-to-line` CustomEvent y:
1. `scrollIntoView(linePos, { y: "center" })` — centra la línea
2. Aplica `Decoration.line({ class: "cm-vibe-highlight" })` con fade-out CSS
3. Limpia la decoración después de 2500ms

**CSS de highlight:**
```css
.cm-vibe-highlight {
  background: linear-gradient(90deg, #06b6d420 0%, transparent 100%);
  border-left: 3px solid #06b6d4;
  transition: opacity 0.5s ease-out;
}
```

### 6. `extensions/agent-activity.ts` — Agent Activity State

Escucha `agentBus` y refleja el estado del agente en el editor:

| Evento | Efecto Visual |
|--------|---------------|
| `phase: "building"` | Barra superior sutil con shimmer animado |
| `file-changed` (este archivo) | Flash cyan en el gutter del archivo |
| `done` | Gutter marks se consolidan, shimmer desaparece |
| `error` | Flash rojo sutil en la barra superior |

Implementación: `ViewPlugin` que manipula decoraciones basado en el estado del bus.

### 7. `VibePadDiff.tsx` — Diff View

Wrapper sobre `MergeView` de `@codemirror/merge`:
- Dos paneles side-by-side con tema Aura
- Líneas agregadas: fondo emerald-500/10 con borde izquierdo emerald
- Líneas eliminadas: fondo rose-500/10 con borde izquierdo rose
- Header con botones: "Aceptar todos", "Cerrar diff"

### 8. `language-loader.ts` — Dynamic Language Loading

```typescript
export async function loadLanguage(langId: string): Promise<Extension> {
  // Dynamic import — solo carga el grammar necesario
  switch (langId) {
    case "javascript":
    case "javascriptreact":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true });
    case "typescript":
    case "typescriptreact":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true });
    case "html":
      return (await import("@codemirror/lang-html")).html();
    case "css":
    case "scss":
    case "less":
      return (await import("@codemirror/lang-css")).css();
    case "json":
    case "jsonc":
      return (await import("@codemirror/lang-json")).json();
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "python":
      return (await import("@codemirror/lang-python")).python();
    case "xml":
      return (await import("@codemirror/lang-xml")).xml();
    case "yaml":
      return (await import("@codemirror/lang-yaml")).yaml();
    default:
      return []; // plaintext — no grammar needed
  }
}
```

## Extensiones CM6 Base

Cada instancia de Vibe Pad carga:

```typescript
const baseExtensions = [
  // Core
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  history(),
  foldGutter(),
  bracketMatching(),
  closeBrackets(),
  indentOnInput(),

  // Search
  highlightSelectionMatches(),
  searchKeymap,

  // Keymaps
  keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),

  // Theme
  vibePadTheme,
  vibePadHighlight,

  // Agent-native
  agentGutter(),
  navigateHighlight(),
  agentActivity(),

  // Config
  EditorView.lineWrapping,
  indentUnit.of("  "),
  EditorState.tabSize.of(2),
];
```

## Contratos Preservados

| Contrato | Monaco | Vibe Pad |
|----------|--------|----------|
| Props del componente | `path, value, onChange, isDiff, originalValue, modifiedValue` | **Idéntico** |
| Navigate event | `vibe:navigate-to-line` CustomEvent | **Idéntico** |
| Diff trigger | `projectStore.openDiffMode(path)` → `isDiff` prop | **Idéntico** |
| Language detection | `detectLanguage(path)` → Monaco ID | `detectLanguage(path)` → CM6 loader key |
| Ctrl+S | Manejado en EditorPanel | **Sin cambios** |
| Lazy load | `lazy(() => import("./MonacoEditor"))` | `lazy(() => import("./VibePad"))` |

## Impacto en Bundle

| Paquete | Tamaño |
|---------|--------|
| `monaco-editor` (REMOVER) | ~5.2 MB |
| `@monaco-editor/react` (REMOVER) | ~42 KB |
| `codemirror` + core (AGREGAR) | ~180 KB |
| `@codemirror/lang-javascript` (AGREGAR) | ~85 KB |
| Otros `lang-*` (lazy, bajo demanda) | ~15-30 KB c/u |
| `@codemirror/merge` (AGREGAR) | ~25 KB |
| **Ahorro neto** | **~4.8 MB** |
