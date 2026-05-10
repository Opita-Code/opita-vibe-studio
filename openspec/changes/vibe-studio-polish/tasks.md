# Tasks: Vibe Studio Polish — Quick Wins Sprint

## 1. Implementation

### 1.1 Fix legacy color instances in ApplyCodeBlock.tsx
- [x] 1.1.1 Replace `bg-[#007acc]` + `hover:bg-[#0098ff]` on "Aplicar" floating button (line 164-166) with inline `style={{ backgroundColor: "var(--vibe-indigo)" }}` + `hover:opacity-80 transition-opacity`, change `focus:ring-[#007acc]` to `focus-visible:ring-[var(--vibe-indigo)]`
- [x] 1.1.2 Replace `border-[#007acc]` on save dialog container (line 184) with `border-[var(--vibe-indigo)]`
- [x] 1.1.3 Replace `bg-[#007acc]` + `hover:bg-[#0098ff]` on "Reintentar" button (line 214-215) with inline style + `hover:opacity-80 transition-opacity` pattern
- [x] 1.1.4 Replace `focus:border-[#007acc]` on filename input (line 237) with `focus:border-[var(--vibe-indigo)]`
- [x] 1.1.5 Replace `bg-[#007acc]` + `hover:bg-[#0098ff]` on "Guardar" button (line 249) with inline style + `hover:opacity-80 transition-opacity` pattern

### 1.2 Fix legacy color instances in FileTree.tsx
- [x] 1.2.1 Replace `border-[#007acc]` on InlineCreateInput (line 140) with `border-[var(--vibe-indigo)]`
- [x] 1.2.2 Replace `hover:bg-[#094771]` on context menu "Nuevo archivo" button (line 188) with `hover:bg-indigo-900/20`
- [x] 1.2.3 Replace `hover:bg-[#094771]` on context menu "Nueva carpeta" button (line 197) with `hover:bg-indigo-900/20`

### 1.3 Fix voseo forms
- [x] 1.3.1 Replace `"Abrí un proyecto primero"` with `"Abre un proyecto primero"` in ApplyCodeBlock.tsx (line 74)
- [x] 1.3.2 Replace `"Abrí un archivo"` with `"Abre un archivo"` in EditorPanel.tsx (line 104)
- [x] 1.3.3 Replace `"Podés:\n"` with `"Puedes:\n"` in ChatPanel.tsx (line 62)
- [x] 1.3.4 Replace `"Definis filas"` → `"Defines filas"` and `"Podés usar"` → `"Puedes usar"` in tips.ts css-grid tip explanation (line 170)

### 1.4 Fix broken Tailwind opacity modifiers
- [x] 1.4.1 Replace `hover:bg-[var(--vibe-indigo)]/80` on LoginScreen SSO button (line 112) with inline `style={{ backgroundColor: "var(--vibe-indigo)" }}` + `hover:opacity-80`, change `transition-all` to `transition-opacity`
- [x] 1.4.2 Replace `hover:text-[var(--vibe-indigo)]/80` on LoginScreen guest button (line 136) with `style={{ color: "var(--vibe-indigo)" }}` + `hover:opacity-80 transition-opacity`
- [x] 1.4.3 Replace `bg-[var(--vibe-indigo)]/20` on PlanCard free badge (line 57) with `style={{ backgroundColor: "var(--vibe-indigo)", opacity: 0.2 }}`
- [x] 1.4.4 Replace `hover:bg-[var(--vibe-indigo)]/80` on PlanCard upgrade button (line 108) with inline `style={{ backgroundColor: "var(--vibe-indigo)" }}` + `hover:opacity-80`, change `transition-colors` to `transition-opacity`

### 1.5 Add missing keyframe
- [x] 1.5.1 Add `@keyframes slideInUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }` to `src/index.css` (after line 40, before closing)

## 2. Verification

### 2.1 Test suite
- [x] 2.1.1 Run `npx vitest run` — all 522+ tests must pass (525/525 passed)
- [x] 2.1.2 If snapshot tests fail due to class/color changes, run `npx vitest run --update` to regenerate

### 2.2 Quality gates
- [x] 2.2.1 Run `tsc --noEmit` — zero type errors
- [x] 2.2.2 Run `npx eslint .` — zero lint errors (0 errors, 1 pre-existing warning)
- [x] 2.2.3 Run `npx prettier --check .` — formatting compliant

### 2.3 Spec compliance verification
- [x] 2.3.1 Grep for `#007acc`, `#0098ff`, `#094771` in `src/` — zero results
- [x] 2.3.2 Grep for `/80` or `/20` adjacent to `var(--vibe-indigo)` in `src/` — zero results
- [x] 2.3.3 Grep for `Abrí`, `Podés`, `Definis`, `Escribí`, `Usá` in user-facing strings — zero results
- [x] 2.3.4 Visual check: indigo accent renders on buttons, slideInUp animation plays on TipBanner

---

**Decision needed before apply**: No
**Chained PRs recommended**: No
**400-line budget risk**: Low — estimated <100 changed lines across 8 files
