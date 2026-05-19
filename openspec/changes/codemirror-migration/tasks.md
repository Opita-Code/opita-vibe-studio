# Vibe Pad — Tasks de Implementación

> Delivery: auto-chain (2 PRs stacked to main)
> Strict TDD: active

## PR 1: `feat(editor): Vibe Pad core — CM6 migration` ✅ COMPLETE

- [x] T1.1 — Instalar dependencias CM6 (18 packages)
- [x] T1.2 — Crear `vibe-pad-theme.ts` (tema Aura + syntax highlighting)
- [x] T1.3 — Crear `language-loader.ts` (dynamic imports)
- [x] T1.4 — Crear `extensions/navigate-highlight.ts`
- [x] T1.5 — Crear `useVibePad.ts` (hook lifecycle)
- [x] T1.6 — Crear `VibePad.tsx` + `VibePadDiff.tsx`
- [x] T1.7 — Actualizar `EditorPanel.tsx` (swap import)
- [x] T1.8 — Remover Monaco (delete files + uninstall deps)
- [x] T1.9 — Verificación visual ✅

## PR 2: `feat(editor): Vibe Pad agent extensions` ✅ COMPLETE

- [x] T2.1 — Crear `extensions/agent-gutter.ts` (purple dot markers)
- [x] T2.2 — Crear `extensions/agent-activity.ts` (shimmer + flash)
- [x] T2.3 — Mejorar `VibePadDiff.tsx` (emerald/rose diff colors)
- [x] T2.4 — Integrar extensiones en `useVibePad.ts`
- [x] T2.5 — Verificación completa ✅

**Quality Gates (ambos PRs):**
- [x] `npx tsc --noEmit` — limpio
- [x] `npx vitest run` — 1290 passed, 0 failed
- [x] Visual: cursor cyan, syntax correcto, CERO cuadros blancos
