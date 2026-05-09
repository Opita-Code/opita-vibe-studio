# Design: Integrate Vibe Studio Branding

## Technical Approach

**Approach A (Minimal)**: Atomic string replacement + asset copy + CSS variable integration. Every "Opita Vibe" → "Vibe Studio" in a single pass. Copy 4 SVGs + 1 ICO + 17 PNGs to correct paths. Add `--vibe-*` CSS custom properties to `index.css`. Extend Tailwind config with `vibe` palette. Replace hardcoded indigo hover/link variants with CSS vars. No component abstraction — direct `<img>` for logo.

## Architecture Decisions

| #   | Decision                             | Options                                                                     | Tradeoff                                                                                                             | Choice                                                                    |
| --- | ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | CSS variable vs Tailwind-only colors | A) Add `--vibe-*` vars + Tailwind `vibe` palette B) Only Tailwind           | A gives future flexibility for brand changes without touching components; B is simpler but couples brand to Tailwind | **A**: CSS vars for brand accent, Tailwind `vibe-black` for bg            |
| 2   | StatusBar color                      | A) Indigo `#4f46e5` B) Black `#0b0b0c` C) Keep `#007acc`                    | A is brand-consistent, bright; B is subtle but low contrast on `#1e1e1e`; C is off-brand                             | **A**: `bg-[var(--vibe-indigo)]` — matches accent                         |
| 3   | Icon replacement method              | A) `tauri icon` regenerate B) Manual per-file copy                          | A requires a valid source PNG and extra tooling; B is explicit                                                       | **B**: manual copy — no new deps, fully auditable                         |
| 4   | Logo SVG delivery                    | A) `<img src>` B) Inline `<svg>`                                            | A is simpler, works with Vite asset hashing; B avoids network request, allows CSS styling                            | **A**: `<img>` — matches existing Vite asset pattern                      |
| 5   | ResizeHandle hover color             | A) `hover:bg-vibe-indigo` B) Keep `hover:bg-opita-500` C) Switch to CSS var | A uses the new brand accent directly; B keeps old lighter indigo; C bridges both                                     | **A**: switch to `hover:bg-[var(--vibe-indigo)]` — single source of truth |

## Data Flow

```
Brand Assets (ZIP)          Code (src/)
├── assets/svg/symbol/   ──→ src/assets/logo-symbol.svg   → LoginScreen <img>
├── assets/svg/lockups/  ──→ src/assets/logo-horizontal.svg → Future about page
├── css/brand.css        ──→ src/assets/brand.css          → @import in index.css
├── assets/ico/          ──→ public/favicon.ico            → <link> in index.html
└── assets/png/icons/    ──→ src-tauri/icons/*.png          → Tauri build

index.css @import brand.css → :root { --vibe-indigo, --vibe-black, --vibe-dark-bg }
Components read css vars via className="bg-[var(--vibe-indigo)]" or hover:text-[var(--vibe-indigo)]
```

## File Changes

| File                                                | Action  | Description                                                                                                                                                |
| --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/assets/`                                       | Create  | New directory for brand assets                                                                                                                             |
| `src/assets/logo-symbol.svg`                        | Copy    | 4-module viseme symbol (dark-bg variant)                                                                                                                   |
| `src/assets/logo-horizontal.svg`                    | Copy    | Horizontal lockup (dark-bg variant)                                                                                                                        |
| `src/assets/brand.css`                              | Copy    | CSS custom properties (`--vibe-indigo`, `--vibe-black`)                                                                                                    |
| `public/`                                           | Create  | New directory for static web assets                                                                                                                        |
| `public/favicon.ico`                                | Copy    | Browser tab favicon                                                                                                                                        |
| `src-tauri/icons/icon.png`                          | Replace | Main app icon (512px dark)                                                                                                                                 |
| `src-tauri/icons/icon.ico`                          | Replace | Windows ICO                                                                                                                                                |
| `src-tauri/icons/icon.icns`                         | Replace | macOS icon (PNG copy)                                                                                                                                      |
| `src-tauri/icons/32x32.png`                         | Replace | 32×32 taskbar icon                                                                                                                                         |
| `src-tauri/icons/128x128.png`                       | Replace | 128×128 tile                                                                                                                                               |
| `src-tauri/icons/128x128@2x.png`                    | Replace | Retina tile (same source)                                                                                                                                  |
| `src-tauri/icons/64x64.png`                         | Replace | 64×64                                                                                                                                                      |
| `src-tauri/icons/Square{30,44,71,...}Logo.png` (10) | Replace | Windows tile variants                                                                                                                                      |
| `src-tauri/icons/StoreLogo.png`                     | Replace | MS Store icon                                                                                                                                              |
| `src/index.css`                                     | Modify  | Add `@import './assets/brand.css'` after Tailwind directives                                                                                               |
| `tailwind.config.js`                                | Modify  | Add `vibe: { indigo: '#4f46e5', black: '#0b0b0c', 'dark-bg': '#1e1e1e' }`                                                                                  |
| `index.html`                                        | Modify  | Title `"Vibe-Studio"` → `"Vibe Studio"`; add `<link rel="icon" href="/favicon.ico">`                                                                       |
| `src/components/auth/LoginScreen.tsx`               | Modify  | `<div>OV</div>` → `<img src={logoSvg}>`; `Opita Vibe` → `Vibe Studio`; `Opita Code` → `Vibe Studio`; replace `#4f46e5`, `#4338ca`, `#818cf8` with CSS vars |
| `src/components/chat/StreamingIndicator.tsx`        | Modify  | `"Opita Vibe está escribiendo"` → `"Vibe Studio está escribiendo..."`                                                                                      |
| `src/pipeline/prompts.ts`                           | Modify  | `"Sos Opita Vibe"` → `"Sos Vibe Studio"` (×2)                                                                                                              |
| `src/providers/mock.ts`                             | Modify  | `"soy Opita Vibe"` → `"soy Vibe Studio"`                                                                                                                   |
| `src/providers/openrouter.ts`                       | Modify  | `"X-Title": "Vibe-Studio"` → `"Vibe Studio"`                                                                                                               |
| `src/App.tsx`                                       | Modify  | Spinner: `border-[#4f46e5]` → `border-[var(--vibe-indigo)]`                                                                                                |
| `src/components/layout/StatusBar.tsx`               | Modify  | `bg-[#007acc]` → `bg-[var(--vibe-indigo)]`                                                                                                                 |
| `src/components/usage/PlanCard.tsx`                 | Modify  | Replace `#4338ca` hover → `var(--vibe-indigo)` with opacity; `#818cf8` → `var(--vibe-indigo)`                                                              |
| `src/components/settings/ByokPanel.tsx`             | Modify  | Same hover/link replacements as PlanCard                                                                                                                   |
| `src/components/layout/ResizeHandle.tsx`            | Modify  | `hover:bg-opita-500 active:bg-opita-600` → `hover:bg-[var(--vibe-indigo)] active:bg-[var(--vibe-indigo)]`                                                  |
| `src-tauri/tauri.conf.json`                         | Modify  | `productName`, `title`: `"Vibe-Studio"` → `"Vibe Studio"`; CSP: add `img-src 'self' asset:`                                                                |
| `src-tauri/Cargo.toml`                              | Modify  | Description: `"Vibe-Studio"` → `"Vibe Studio"`                                                                                                             |
| `src-tauri/capabilities/default.json`               | Modify  | Description: `"Vibe-Studio"` → `"Vibe Studio"`                                                                                                             |
| `src-tauri/src/lib.rs`                              | Modify  | Comments + greet string: `"Vibe-Studio"` → `"Vibe Studio"`                                                                                                 |
| `src-tauri/src/commands/*.rs` (3)                   | Modify  | Header comments: `"Vibe-Studio"` → `"Vibe Studio"`                                                                                                         |
| `AGENTS.md`                                         | Modify  | Header `"OPITA Vibe-Studio"` → `"Vibe Studio"`; brand para                                                                                                 |
| `openspec/config.yaml`                              | Modify  | Line 8: palette description update                                                                                                                         |
| `openspec/specs/desktop-shell/spec.md`              | Modify  | `"Vibe-Studio"` → `"Vibe Studio"` (×3)                                                                                                                     |
| `tests/components/auth/LoginScreen.test.tsx`        | Modify  | Assertions: `"Opita Vibe"` → `"Vibe Studio"`; `"Opita Code"` → `"Vibe Studio"`                                                                             |
| `tests/pipeline/pipeline.test.ts`                   | Modify  | Line 373: `"Opita Vibe"` → `"Vibe Studio"`                                                                                                                 |
| `tests/providers/mock.test.ts`                      | Modify  | Line 15: `"Opita Vibe"` → `"Vibe Studio"`                                                                                                                  |
| `tests/providers/openrouter.test.ts`                | Modify  | Line 105: `"Vibe-Studio"` → `"Vibe Studio"`                                                                                                                |

## Interfaces / Contracts

**New CSS custom properties** (exposed via `:root` in `brand.css`):

```css
--vibe-indigo: #4f46e5; /* brand accent — replaces #4338ca/#818cf8 hover/link values */
--vibe-black: #0b0b0c; /* primary dark — new, darker than existing #1e1e1e */
--vibe-dark-bg: #1e1e1e; /* app background — documents existing body bg */
```

**Logo SVG import** (LoginScreen.tsx):

```ts
import logoSvg from "@/assets/logo-symbol.svg";
// Usage: <img src={logoSvg} alt="Vibe Studio" className="h-16 w-16" />
```

## Testing Strategy

| Layer       | What                        | Approach                                                                                              |
| ----------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unit        | String replacements         | Update 4 test files: `LoginScreen.test.tsx`, `pipeline.test.ts`, `mock.test.ts`, `openrouter.test.ts` |
| Integration | Logo renders                | `LoginScreen.test.tsx` already covers render — update assertion to match new alt text                 |
| Visual      | Icons appear correct        | Manual QA: check taskbar icon, browser favicon, login screen logo                                     |
| Build       | Tauri builds with new icons | `npm run build` (includes `tauri build`) — validates icon files exist and are valid PNG               |

All test assertions MUST be updated in the same commit as source changes to prevent CI breakage.

## Migration / Rollout

**No data migration required** — purely static asset and string replacement.

**Rollback plan** (exact steps):

1. `git revert` the branding commit chain
2. Delete `src/assets/` directory
3. Delete `public/favicon.ico` (keep `public/` dir if it existed before)
4. Remove `@import './assets/brand.css'` from `src/index.css`
5. Revert `tailwind.config.js` to remove `vibe` palette
6. Revert `index.html` title and favicon link
7. Run `npm test && npm run typecheck` to confirm rollback clean

## Open Questions

- [ ] Should `iconAsTemplate: true` in `tauri.conf.json` stay or be removed for the new 4-module symbol on macOS? (Windows tray is unaffected; macOS tray treats icon as monochrome mask)
- [ ] Are the `Square*Logo.png` files actually referenced by Tauri v2 or are they legacy from the Tauri v1 template? If not referenced, consider deleting rather than replacing
