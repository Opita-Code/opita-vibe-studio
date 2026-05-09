# Tasks: Integrate Vibe Studio Branding

## Review Workload Forecast

| Field                   | Value           |
| ----------------------- | --------------- |
| Estimated changed lines | ~115            |
| 400-line budget risk    | Low             |
| Chained PRs recommended | No              |
| Suggested split         | Single PR       |
| Delivery strategy       | auto-chain      |
| Chain strategy          | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Phase 1: Foundation — Brand Assets

- [x] 1.1 Create `src/assets/`; copy `vibe-symbol-dark-bg.svg` → `src/assets/logo-symbol.svg`, `vibe-horizontal-dark-bg.svg` → `src/assets/logo-horizontal.svg` (~40 lines)
- [x] 1.2 Copy `vibe-studio-brand.css` → `src/assets/brand.css` (~22 lines)
- [x] 1.3 Copy `favicon.ico` → `public/favicon.ico` (binary)
- [x] 1.4 Replace all 19 `src-tauri/icons/*` with dark-variant brand PNGs from `assets/png/icons/vibe-app-icon-dark-*.png` (binary)

## Phase 2: TDD RED — Update Test Assertions

- [x] 2.1 `LoginScreen.test.tsx`: `"Opita Vibe"` → `"Vibe Studio"`, `"Opita Code"` → `"Vibe Studio"` (~2 lines)
- [x] 2.2 `pipeline.test.ts` L373: `"Opita Vibe"` → `"Vibe Studio"` (~1 line)
- [x] 2.3 `mock.test.ts` L15: `"Opita Vibe"` → `"Vibe Studio"` (~1 line)
- [x] 2.4 `openrouter.test.ts` L105: `"Vibe-Studio"` → `"Vibe Studio"` (~1 line)

## Phase 3: GREEN — Source Code Modifications

- [x] 3.1 `LoginScreen.tsx`: `<div>OV</div>` → `<img src={logoSvg}>`; `"Opita Vibe"` → `"Vibe Studio"`; replace `#4f46e5`/`#4338ca`/`#818cf8` with CSS vars (~12 lines)
- [x] 3.2 `StreamingIndicator.tsx`: `"Opita Vibe"` → `"Vibe Studio"` (~1 line)
- [x] 3.3 `prompts.ts`: `"Sos Opita Vibe"` → `"Sos Vibe Studio"` ×2 (~2 lines)
- [x] 3.4 `mock.ts`: `"soy Opita Vibe"` → `"soy Vibe Studio"` (~1 line)
- [x] 3.5 `openrouter.ts`: `"X-Title": "Vibe-Studio"` → `"Vibe Studio"` (~1 line)
- [x] 3.6 `App.tsx`: `border-[#4f46e5]` → `border-[var(--vibe-indigo)]` (~1 line)
- [x] 3.7 `StatusBar.tsx`: `bg-[#007acc]` → `bg-[var(--vibe-indigo)]` (~1 line)
- [x] 3.8 `PlanCard.tsx`: replace `#4338ca`/`#818cf8` with CSS vars (~4 lines)
- [x] 3.9 `ByokPanel.tsx`: same color replacements as PlanCard (~4 lines)
- [x] 3.10 `ResizeHandle.tsx`: `hover:bg-opita-500` → `hover:bg-[var(--vibe-indigo)]` (~1 line)

## Phase 4: Config, Metadata & Docs

- [x] 4.1 `index.html`: title `"Vibe-Studio"` → `"Vibe Studio"`; add `<link rel="icon">` (~3 lines)
- [x] 4.2 `src/index.css`: add `@import './assets/brand.css'` after Tailwind directives (~1 line)
- [x] 4.3 `tailwind.config.js`: add `vibe` palette (`indigo`, `black`, `dark-bg`) (~6 lines)
- [x] 4.4 `tauri.conf.json`: `productName`/`title` → `"Vibe Studio"`; CSP add `img-src 'self' asset:` (~3 lines)
- [x] 4.5 `Cargo.toml`: description `"Vibe-Studio"` → `"Vibe Studio"` (~1 line)
- [x] 4.6 `capabilities/default.json`: description `"Vibe-Studio"` → `"Vibe Studio"` (~1 line)
- [x] 4.7 `AGENTS.md`: update header branding reference (~2 lines)
- [x] 4.8 `openspec/config.yaml`: palette description update (~1 line)
- [x] 4.9 `desktop-shell/spec.md`: `"Vibe-Studio"` → `"Vibe Studio"` ×3 (~3 lines)

## Phase 5: Verification

- [x] 5.1 `npx vitest run` — all branding tests pass (same 10 pre-existing failures, 0 new), zero "Opita Vibe" references in assertions
- [x] 5.2 `tsc --noEmit` — typecheck passes
- [x] 5.3 Grep `src/` for "Opita Vibe" — zero results
- [ ] 5.4 Manual QA: login screen renders SVG symbol, favicon loads, status bar brand indigo
