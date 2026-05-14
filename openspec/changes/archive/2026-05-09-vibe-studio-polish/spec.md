# Spec: Vibe Studio Polish — Quick Wins Sprint

## Purpose

Fix 4 categories of CRITICAL spec violations where code diverges from `brand-colors` and `brand-copy` specifications. No new capabilities. No modified requirements.

## Referenced Specs

| Spec | Section Violated |
|------|-----------------|
| [brand-colors](../specs/brand-colors/spec.md) | Indigo Accent Enforcement, Working Hover Patterns, CSS Custom Property References |
| [brand-copy](../specs/brand-copy/spec.md) | Colombian-Neutral Spanish |

---

## Violation 1: Legacy Color Instances

**Spec requirement**: `brand-colors` § Indigo Accent Enforcement — all accent colors MUST use `var(--vibe-indigo)` (`#4f46e5`). Legacy blues (`#007acc`, `#0098ff`, `#094771`) MUST NOT appear.

**Violations**: 10 instances across 2 files (`ApplyCodeBlock.tsx`: 7x `#007acc`/`#0098ff`, `FileTree.tsx`: 1x `#007acc` + 2x `#094771`).

### Scenario: Zero legacy blues after fix

- GIVEN the fix has been applied
- WHEN grep searches for `#007acc`, `#0098ff`, or `#094771` in `src/renderer/`
- THEN zero results are returned
- AND all accent colors resolve via `var(--vibe-indigo)`

---

## Violation 2: Voseo Forms

**Spec requirement**: `brand-copy` § Colombian-Neutral Spanish — voseo forms (`Abrí`, `Podés`, `Definis`, `Escribí`, `Usá`) MUST NOT appear.

**Violations**: 4 instances across 4 files: `ApplyCodeBlock.tsx` (`Abrí`), `EditorPanel.tsx` (`Abrí`), `ChatPanel.tsx` (`Podés`), `lib/tips.ts` (`Definis`, `Podés`).

### Scenario: Zero voseo forms after fix

- GIVEN the fix has been applied
- WHEN grep searches for `Abrí`, `Podés`, `Definis`, `Escribí`, `Usá` in `src/renderer/`
- THEN zero matches exist in user-facing strings
- AND all second-person verbs use Colombian-neutral forms (`Abre`, `Puedes`, `Defines`)

---

## Violation 3: Broken Tailwind Opacity Modifiers on CSS Variables

**Spec requirement**: `brand-colors` § Working Hover Patterns on CSS Variables — Tailwind opacity modifiers (`/80`, `/20`) on arbitrary-value CSS var classes MUST NOT be used. They do not apply to custom properties.

**Violations**: 4 instances across 2 files.

| File | Broken Pattern | Fix Pattern |
|------|---------------|-------------|
| `LoginScreen.tsx` | `hover:bg-[var(--vibe-indigo)]/80` | `style={{ backgroundColor: "var(--vibe-indigo)" }}` + `hover:opacity-80` |
| `LoginScreen.tsx` | `hover:text-[var(--vibe-indigo)]/80` | Same inline-style + opacity pattern |
| `PlanCard.tsx` | `bg-[var(--vibe-indigo)]/20` | Inline style + opacity |
| `PlanCard.tsx` | `hover:bg-[var(--vibe-indigo)]/80` | Inline style + `hover:opacity-80` |

### Scenario: Zero broken opacity modifiers after fix

- GIVEN the fix has been applied
- WHEN grep searches for `/80` or `/20` adjacent to `var(--vibe-indigo)` in `src/renderer/`
- THEN zero matches are returned
- AND all hover transparency uses the inline-style + `hover:opacity-80` pattern

### Scenario: Hover opacity works visually

- GIVEN a user hovers over a brand-accent button in LoginScreen or PlanCard
- WHEN the hover state activates
- THEN the button visibly lightens to approximately 80% opacity
- AND the effect renders correctly in the Tauri WebView (Chromium)

---

## Violation 4: Missing CSS Keyframe

**Spec context**: `TipBanner.tsx` references `animation: "slideInUp 0.3s ease-out"` but no `@keyframes slideInUp` is defined in `index.css`.

### Scenario: slideInUp animation renders after fix

- GIVEN `index.css` defines `@keyframes slideInUp` with `translateY(1rem) → translateY(0)` and `opacity: 0 → 1`
- WHEN the TipBanner component mounts
- THEN the banner visibly slides up from 1rem below over 0.3s ease-out
- AND the animation completes without console errors

---

## Verification Gate

All of the following MUST pass after fixes are applied.

### Scenario: Full test suite passes

- GIVEN all 4 violation categories are fixed
- WHEN `npx vitest run` executes
- THEN all 522+ tests pass
- AND snapshot tests are updated if class or color changes affect them

### Scenario: Quality gates pass

- GIVEN the fix is applied
- WHEN `npx eslint .` and `tsc --noEmit` run
- THEN zero lint errors exist
- AND zero type errors exist

### Scenario: Visual brand compliance confirmed

- GIVEN the app renders after all fixes
- WHEN inspecting any interactive UI element
- THEN no legacy blue (`#007acc`, `#0098ff`, `#094771`) is visible
- AND no voseo form appears in any UI text
- AND hover on brand-accent buttons produces visible opacity reduction
