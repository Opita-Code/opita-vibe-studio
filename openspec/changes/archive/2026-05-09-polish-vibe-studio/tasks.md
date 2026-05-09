# Tasks: Polish Vibe Studio

## Review Workload Forecast

| Field                   | Value                                            |
| ----------------------- | ------------------------------------------------ |
| Estimated changed lines | ~200                                             |
| 400-line budget risk    | Low                                              |
| Chained PRs recommended | Yes                                              |
| Suggested split         | PR 1 (Brand + Code Quality) → PR 2 (Copy + A11y) |
| Delivery strategy       | auto-chain                                       |
| Chain strategy          | stacked-to-main                                  |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                        | Likely PR | Base |
| ---- | --------------------------- | --------- | ---- |
| 1    | Brand colors + code quality | PR 1      | main |
| 2    | Copy/voseo + a11y           | PR 2      | main |

## Phase 1: Brand Colors (~20 lines, 4 files)

- [x] 1.1 `src/components/chat/ChatInput.tsx` — Replace `bg-[#1e4d8c]`/`hover:bg-[#2a5fa8]` with `bg-[var(--vibe-indigo)]` + opacity hover; replace `focus:ring-[#1e4d8c]` with `focus-visible:ring-[var(--vibe-indigo)]`
- [x] 1.2 `src/components/chat/MessageBubble.tsx` — Replace user bubble `bg-[#1e4d8c]` with `bg-[var(--vibe-indigo)]`
- [x] 1.3 `src/components/layout/Sidebar.tsx` — Replace CTA button `bg-[#007acc]`/`hover:bg-[#0098ff]` with vibe tokens + inline style hover pattern
- [x] 1.4 `src/components/settings/ByokPanel.tsx` — Fix `hover:bg-[var(--vibe-indigo)]/80` with inline style + opacity class pattern

## Phase 2: Copy/Voseo (~80 lines, 4 src files + 4 test files)

- [x] 2.1 `src/components/chat/ChatInput.tsx` — Neutralize placeholder: `"Escribí en español lo que querés crear..."` → `"Escribe en español lo que quieres crear..."`
- [x] 2.2 `src/pipeline/prompts.ts` — Replace voseo in 3 system prompts: `Sos`→`Eres`, `Respondé`→`Responde`, `Generá`→`Genera`, `Usá`→`Usa`, `Revisá`→`Revisa`, `analizá`→`analiza`, `Comentá`→`Comenta`
- [x] 2.3 `src/components/terminal/TerminalPanel.tsx` — Neutralize empty state (`Escribí`→`Escribe`, `seleccioná`→`selecciona`) and input placeholder (`Escribí`→`Escribe`)
- [x] 2.4 `src/components/settings/ByokPanel.tsx` — Neutralize `Verificá`→`Verifica`, `Configurá`→`Configura`, `Ingresá`→`Ingresa`
- [x] 2.5 Update test expectations: `tests/components/chat/ChatInput.test.tsx`, `tests/components/chat/a11y.test.tsx`, `tests/components/TerminalPanel.test.tsx`, `tests/pipeline/pipeline.test.ts` — match new neutral copy

## Phase 3: A11y (~65 lines, 5 component files + test updates)

- [x] 3.1 `src/components/layout/Sidebar.tsx` — Add `aria-label="Abrir carpeta"` to icon-only open-folder button
- [x] 3.2 `src/components/editor/FileTabs.tsx` — Convert close glyph `<span>` to `<button>` with `aria-label="Cerrar {filename}"`; add `role="tablist"`/`role="tab"`/`aria-selected`
- [x] 3.3 `src/components/layout/EditorPanel.tsx` — Add `aria-label` to preview toggle ("Alternar vista previa") and reload button ("Recargar vista previa")
- [x] 3.4 `src/components/terminal/TerminalPanel.tsx` — Add `aria-label` to toolbar buttons (Presets, Clear, confirm dialog), ensure danger buttons have distinguishable labels
- [x] 3.5 `src/components/settings/ByokPanel.tsx` — Add `htmlFor`/`id` pairs to form labels and inputs; add `aria-label` to icon-only action buttons (Probar, Eliminar, Confirmar, Cancelar)
- [x] 3.6 Update a11y tests: `tests/components/chat/a11y.test.tsx` — add queries for new aria labels

## Phase 4: Code Quality (~35 lines, 6 source files + test updates)

- [x] 4.1 `src/providers/deepseek.ts` — Remove `console.log` token-telemetry block (lines 72–75)
- [x] 4.2 `src/providers/openai.ts` — Remove `console.log` token-telemetry block (lines 78–80)
- [x] 4.3 `src/providers/gemini.ts` — Remove `console.log` token-telemetry block (lines 80)
- [x] 4.4 `src/providers/custom.ts` — Remove `console.log` token-telemetry block (lines 78–80)
- [x] 4.5 `src/providers/openrouter.ts` — Remove `console.log` token-telemetry block (lines 76–78)
- [x] 4.6 `src/components/preview/LivePreview.tsx` — Expand CSP in `buildSrcdoc()`: add `img-src * data:; font-src * data:; connect-src *;` to allow common remote assets
- [x] 4.7 `tests/components/preview/LivePreview.test.tsx` — Update CSP assertion string to match expanded policy
