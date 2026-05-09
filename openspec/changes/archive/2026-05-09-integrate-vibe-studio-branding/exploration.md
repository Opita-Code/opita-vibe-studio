# Exploration: Integrate Vibe Studio Branding

## Current State

The codebase currently uses **placeholder branding** from the MVP phase:

- A hardcoded "OV" letter-mark in an indigo square as the logo (LoginScreen)
- The name "Opita Vibe" throughout the UI, system prompts, and tests
- Old Tailwind indigo palette (`opita` colors: 500:#6366f1, 600:#4f46e5, etc.)
- Generic Tauri starter icons (the "OV" placeholder icon.png)
- Window title "Vibe-Studio", product name "Vibe-Studio", identifier `com.opita.vibe-studio`

The **new Vibe Studio brand** introduces:

- A 4-module viseme symbol (rounded capsules forming a diamond negative space, one indigo accent)
- The wordmark: "vibe STUDIO" (lowercase primary + uppercase secondary)
- Updated color tokens: indigo #4f46e5 (matches opita-600), black #0b0b0c (new, darker)
- CSS variables and design tokens JSON
- Production-ready SVG/PNG/ICO assets at all required sizes
- Brand constraints: no gradients, no glow, no shadows, no robot heads, no sparkles, etc.

## Affected Areas

### 1. LoginScreen.tsx — Logo placeholder

- **File**: `src/components/auth/LoginScreen.tsx`
- **Current**: Lines 77-79 — hardcoded `<div>` with "OV" text on `bg-[#4f46e5]`
- **Needs**: Replace with SVG `<img>` referencing the new symbol SVG, or inline the SVG element directly
- **Also**: Line 80 `<h1>Opita Vibe</h1>` → `<h1>Vibe Studio</h1>`

### 2. LoginScreen.tsx — Tagline

- **File**: `src/components/auth/LoginScreen.tsx`
- **Current**: Line 82 — `"Vibecodea en español. Aprende sin darte cuenta."`
- **Needs**: **NO CHANGE** — the tagline stays the same per brand specs

### 3. LoginScreen.tsx — Brand colors

- **File**: `src/components/auth/LoginScreen.tsx`
- **Current**: Lines 77, 99, 111 use `#4f46e5` (brand indigo), line 111 hover uses `#4338ca`, lines 135, 143 use `#818cf8`
- **Needs**: `#4f46e5` is correct (matches new indigo). `#4338ca` (hover) should change to `#3c38a5` (indigo-700) or just darken by ~10%. `#818cf8` links → should use `#4f46e5` or the CSS `--vibe-indigo` variable
- **Also**: Replace all hardcoded `#4f46e5` with CSS custom properties `var(--vibe-indigo)` for maintainability

### 4. StatusBar.tsx — Status bar color

- **File**: `src/components/layout/StatusBar.tsx`
- **Current**: Line 18 — `bg-[#007acc]` (VS Code blue, not brand color)
- **Needs**: Should use brand indigo `#4f46e5` or black `#0b0b0c` for brand consistency
- **Decision needed**: Dark UI uses `#007acc` for status bar as VS Code convention. The new brand's `#0b0b0c` (nearly black) could work. Indigo `#4f46e5` is the accent. Choose either black status bar (`bg-[#0b0b0c]`) or indigo (`bg-[#4f46e5]`).

### 5. App.tsx — Loading spinner

- **File**: `src/App.tsx`
- **Current**: Line 68 — spinner uses `border-[#4f46e5]`
- **Needs**: Replace with `var(--vibe-indigo)` when CSS variables are available, or keep `#4f46e5` (correct value)

### 6. App.tsx — "Cargando..." text

- **File**: `src/App.tsx`
- **Current**: Line 69 — `Cargando...`
- **Needs**: **NO CHANGE** — generic loading text

### 7. Tailwind config — opita palette

- **File**: `tailwind.config.js`
- **Current**: Full `opita` palette from indigo-50 through indigo-950 (standard Tailwind indigo scale)
- **Needs**:
  - **Add** a new `vibe` palette section: `vibe: { indigo: '#4f46e5', black: '#0b0b0c', 'dark-bg': '#1e1e1e' }`
  - **OR** add key colors to existing `opita` palette plus `vibe-black`
  - The new brand uses exactly `#4f46e5` (which is already `opita-600`), so the palette is mostly correct
  - New color: `#0b0b0c` (brand black) — needs to be added

### 8. index.html — Title and favicon

- **File**: `index.html`
- **Current**: Line 6 — `<title>Vibe-Studio</title>`, no favicon link
- **Needs**:
  - Title: `Vibe-Studio` → `Vibe Studio` (consistent with new brand)
  - Add `<link rel="icon" href="/favicon.ico">` referencing the new ICO

### 9. index.html — CSP policy

- **File**: `index.html` (actually in tauri.conf.json line 26)
- **Current**: `default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; ...`
- **Needs**: Add `img-src 'self' asset:` if assets are loaded from Tauri's asset protocol

### 10. tauri.conf.json — Window title, productName, identifier

- **File**: `src-tauri/tauri.conf.json`
- **Current**: Line 3 `"productName": "Vibe-Studio"`, line 5 `"identifier": "com.opita.vibe-studio"`, line 15 `"title": "Vibe-Studio"`
- **Needs**:
  - `productName` → `"Vibe Studio"` (match new brand wordmark)
  - `title` → `"Vibe Studio"` (match)
  - `identifier` → **KEEP** `com.opita.vibe-studio` (bundle identifier, stable)
  - `trayIcon.iconPath` → same path but icon file will be replaced

### 11. Cargo.toml — Package description

- **File**: `src-tauri/Cargo.toml`
- **Current**: Line 4 — `description = "Vibe-Studio — Vibecodea en español. Aprende sin darte cuenta."`
- **Needs**: `Vibe-Studio` → `Vibe Studio`

### 12. src-tauri/icons/ — App icons (19 files)

- **File**: `src-tauri/icons/` directory
- **Current**: 19 placeholder icon files (icon.png showing "OV", icon.ico, icon.icns, 32x32.png, 128x128.png, etc.)
- **Needs**: **Replace all** with new brand icons from the asset package.
  - New assets provide dark and light PNG icons at 16, 24, 32, 48, 64, 128, 192, 512px
  - Tauri requires specific filenames: `icon.png` (main), `32x32.png`, `128x128.png`, `128x128@2x.png`, `64x64.png`, `icon.ico`, `icon.icns`
  - Also Windows-specific: `Square30x30Logo.png`, `Square44x44Logo.png`, etc.
  - **Recommendation**: Use dark variant icons (app runs in dark theme). The light variant symbol on transparent background may be invisible on dark desktops.

### 13. index.css — Global styles

- **File**: `src/index.css`
- **Current**: No brand CSS variables, only Tailwind directives. `body` background `#1e1e1e` and color `#d4d4d4`
- **Needs**: Integrate `vibe-studio-brand.css` variables. The new brand CSS provides:

  ```css
  --vibe-indigo: #4f46e5;
  --vibe-black: #0b0b0c;
  --vibe-white: #ffffff;
  --vibe-dark-bg: #1e1e1e;
  ```

  - `#1e1e1e` body background matches `--vibe-dark-bg` ✓

### 14. StreamingIndicator.tsx — "Opita Vibe está escribiendo"

- **File**: `src/components/chat/StreamingIndicator.tsx`
- **Current**: Line 7 — `"Opita Vibe está escribiendo"`
- **Needs**: `"Opita Vibe"` → `"Vibe Studio"` (or just `"Vibe Studio está escribiendo..."`)

### 15. prompts.ts — System prompt identity

- **File**: `src/pipeline/prompts.ts`
- **Current**: Lines 9, 28 — `"Sos Opita Vibe, un asistente de programación para estudiantes colombianos..."`
- **Needs**: `"Opita Vibe"` → `"Vibe Studio"` in system prompts (ENTENDER_BASE and CONSTRUIR_BASE)

### 16. mock.ts — Mock provider greeting

- **File**: `src/providers/mock.ts`
- **Current**: Line 9 — `"Hola, soy Opita Vibe. ¿En qué te puedo ayudar?"`
- **Needs**: `"Opita Vibe"` → `"Vibe Studio"`

### 17. openrouter.ts — HTTP headers

- **File**: `src/providers/openrouter.ts`
- **Current**: Lines 59-60 — `"HTTP-Referer": "https://vibe-studio.opita.co"`, `"X-Title": "Vibe-Studio"`
- **Needs**: `"X-Title"` → `"Vibe Studio"`. `HTTP-Referer` — keep `vibe-studio.opita.co` until a real domain exists.

### 18. AGENTS.md — Brand description

- **File**: `AGENTS.md`
- **Current**: Lines 1, 7 — `"# AGENTS.md — OPITA Vibe-Studio"`, `"Opita Vibe-Studio is an Opita Code product"`
- **Needs**: Update header and description to reflect "Vibe Studio" as the product name while keeping "Opita Code" as the parent brand

### 19. openspec/config.yaml — Styling reference

- **File**: `openspec/config.yaml`
- **Current**: Line 8 — `"custom 'opita' palette (indigo tones)"`
- **Needs**: Update to mention Vibe Studio branding

### 20. ResizeHandle.tsx — Tailwind opita class

- **File**: `src/components/layout/ResizeHandle.tsx`
- **Current**: Line 67 — `hover:bg-opita-500 active:bg-opita-600`
- **Needs**: These are Tailwind utility classes referencing the `opita` palette. `opita-500` = `#6366f1`, `opita-600` = `#4f46e5`. The `opita-600` value matches new indigo. `opita-500` is slightly lighter. **RECOMMENDATION**: Keep `opita-600` for active state. Change `opita-500` to `vibe-indigo` or a darker hover. Or add `vibe` palette and use `hover:bg-vibe-indigo`.

### 21. PlanCard.tsx — Brand accent colors

- **File**: `src/components/usage/PlanCard.tsx`
- **Current**: Line 55 — `bg-[#4f46e5]/20 text-[#818cf8]`, line 106 — `bg-[#4f46e5] hover:bg-[#4338ca]`
- **Needs**: Same as LoginScreen — `#4f46e5` is correct. `#4338ca` hover → `#3c38a5` (darker indigo) or use CSS variable. `#818cf8` → `#4f46e5` for consistency.

### 22. ByokPanel.tsx — Multiple brand color references

- **File**: `src/components/settings/ByokPanel.tsx`
- **Current**: Lines 213, 265, 319, 343, 365, 375, 397 — uses `#4f46e5`, `#818cf8`, `#4338ca`
- **Needs**: Same pattern — `#4f46e5` stays, `#4338ca` → darker, `#818cf8` → `#4f46e5`

### 23. src-tauri/capabilities/default.json — Description

- **File**: `src-tauri/capabilities/default.json`
- **Current**: Line 3 — `"Default capability set for Vibe-Studio"`
- **Needs**: `Vibe-Studio` → `Vibe Studio`

### 24. package.json — name field

- **File**: `package.json`
- **Current**: Line 2 — `"name": "vibe-studio"`
- **Needs**: **NO CHANGE** — npm package name stays as `vibe-studio` (technical identifier)

### 25. Test files — Brand string assertions

All tests that reference "Opita Vibe" need updating:

- `tests/components/chat/ChatInput.test.tsx` — check for "Opita Vibe"
- `tests/pipeline/pipeline.test.ts` line 373 — `expect(msgs[0].content).toContain("Opita Vibe")`
- `tests/providers/mock.test.ts` line 15 — `expect(fullText).toBe("Hola, soy Opita Vibe...")`
- `tests/providers/openrouter.test.ts` lines 104-105 — expects old headers
- `tests/components/auth/LoginScreen.test.tsx` line 25 — `expect(screen.getByText("Opita Vibe"))`
- Test files using `@opita.co` emails: **NO CHANGE** — these are mock data, domain-independent

### 26. sso.ts — Mock user domain

- **File**: `src/auth/sso.ts`
- **Current**: Lines 151, 168 — `"usuario@opita.co"`
- **Needs**: **NO CHANGE** — mock placeholder domain

### 27. lib/types.ts — ProviderTier

- **File**: `src/lib/types.ts`
- **Current**: Line 40 — `export type ProviderTier = "free" | "byok" | "opita"`
- **Needs**: **NO CHANGE** — `"opita"` here is a tier name (Opita Code's own provider tier), not the product brand name

### 28. openspec specs — "Opita Vibe" references

- **Files**: `openspec/specs/desktop-shell/spec.md` lines 14, 26, 32 — "Vibe-Studio" window title and "Abrir Vibe-Studio" tray
- **Files**: `openspec/changes/archive/2026-05-04-vibe-studio-mvp/` — archived artifacts (DO NOT modify)
- **Needs**: Update live specs. Archive is historical — no changes.

## Assets to Copy

### src/assets/ (CREATE DIRECTORY)

| Source                                           | Destination                         | Purpose                             |
| ------------------------------------------------ | ----------------------------------- | ----------------------------------- |
| `assets/svg/symbol/vibe-symbol-dark.svg`         | `src/assets/logo-symbol.svg`        | Login screen logo                   |
| `assets/svg/lockups/vibe-horizontal-dark.svg`    | `src/assets/logo-horizontal.svg`    | Horizontal lockup (about/page)      |
| `assets/svg/lockups/vibe-horizontal-dark-bg.svg` | `src/assets/logo-horizontal-bg.svg` | Lockup on dark bg                   |
| `css/vibe-studio-brand.css`                      | `src/assets/brand.css`              | CSS variables (import in index.css) |

### src-tauri/icons/ (REPLACE all 19 files)

Tauri requires specific filenames. Map new icons to Tauri convention:
| New Asset | Tauri Destination | Size |
|-----------|-------------------|------|
| `vibe-app-icon-dark-32.png` | `src-tauri/icons/32x32.png` | 32×32 |
| `vibe-app-icon-dark-128.png` | `src-tauri/icons/128x128.png` | 128×128 |
| `vibe-app-icon-dark-128.png` | `src-tauri/icons/128x128@2x.png` | 128×128 (retina) |
| `vibe-app-icon-dark-64.png` | `src-tauri/icons/64x64.png` | 64×64 |
| `vibe-app-icon-dark-512.png` | `src-tauri/icons/icon.png` | 512×512 (main) |
| `assets/ico/favicon.ico` | `src-tauri/icons/icon.ico` | ICO format |
| `vibe-app-icon-dark-512.png` | `src-tauri/icons/icon.icns` | macOS (PNG fallback) |
| `vibe-app-icon-dark-128.png` | `src-tauri/icons/Square142x142Logo.png` | Windows tile |
| `vibe-app-icon-dark-256.png` (n/a) | `src-tauri/icons/Square150x150Logo.png` | Windows tile |
| And similar for other Square\* files... | | |

> **Note**: `vibe-app-icon-dark-*.png` icons are the symbol on dark background — suitable for the app's dark theme. Use **dark variant** throughout since the app ships as dark-first.

### public/ or root

| Source                   | Destination          | Purpose          |
| ------------------------ | -------------------- | ---------------- |
| `assets/ico/favicon.ico` | `public/favicon.ico` | Browser tab icon |

## Color Migration Plan

The old Tailwind `opita` palette uses standard indigo with these key colors used in code:

- `#4f46e5` (opita-600) → **KEEP** (matches new indigo exactly)
- `#4338ca` (opita-700) → **REPLACE** with `#3c38a5` or `#0b0b0c` for hover states
- `#818cf8` (opita-400) → **REPLACE** with `#4f46e5` or `#6b7280` (label) for link text
- `#6366f1` (opita-500) → **REPLACE** with `#4f46e5` for consistency

New brand colors to add to Tailwind config:

- `vibe-black: '#0b0b0c'` — primary dark, used for text on light, background on dark
- `vibe-panel: '#f8fafc'` — soft panel background (light theme only)
- `vibe-border: '#e5e7eb'` — border color (light theme only)

## Files NOT to Touch

- `package.json` — `"name": "vibe-studio"` is fine as npm identifier
- `src/lib/types.ts` — `ProviderTier` includes `"opita"` as tier name
- `src/lib/tokens.ts` — plan names and features are product-level, not brand
- `src/auth/sso.ts` — mock email domain is placeholder
- `src/auth/verification.ts` — verification logic, no brand strings
- `src/stores/*` — state management, no brand references
- `src/components/editor/*` — editor components, no brand references
- `src/components/files/*` — file tree, no brand references
- `src/components/preview/*` — live preview, no brand references
- `src/components/learning/*` — learning tips, no brand references
- `src/components/chat/MessageList.tsx` — no brand strings (delegates to child components)
- `src/components/chat/ChatInput.tsx` — no brand strings
- `src/components/ErrorBoundary.tsx` — generic error component
- `src/main.tsx` — entry point, no brand
- `src-tauri/Cargo.toml` name field — `"vibe-studio"` is fine as crate name
- `src-tauri/build.rs` — build script
- All `openspec/changes/archive/*` — historical, immutable
- Test files using `@opita.co` emails — mock data, not branding
- `openspec/specs/ai-providers/spec.md` — `"opita"` tier references are functional, not branding

## Approaches

### Approach A: Minimal string replacement (Recommended)

- Replace "Opita Vibe" → "Vibe Studio" in all visible UI strings
- Copy new SVG/PNG/ICO assets to correct locations
- Add CSS variables from brand CSS to index.css
- Update Tailwind config with new `vibe-black` color
- Replace hardcoded `#4f46e5`, `#4338ca`, `#818cf8` with CSS custom properties
- Update window title, product name, cargo description
- **Pros**: Minimal scope, low risk, fast
- **Cons**: Color system not fully systematic (mixes CSS vars with Tailwind classes)
- **Effort**: Low

### Approach B: Full design token integration

- All of Approach A, PLUS:
  - Convert all hardcoded colors to design token references
  - Create a proper `tailwind.config.js` vibe palette
  - Add `font-family` matching brand typography (Nunito Sans, Inter)
  - Theme-aware logo selection (light logo on dark bg, dark logo on light bg)
- **Pros**: Complete brand system, future-proof
- **Cons**: Larger scope, touches many CSS files, risk of visual regressions
- **Effort**: Medium

### Approach C: Component-based brand system

- Build a `<BrandLogo>` component that selects correct variant by context
- Centralize all brand tokens in a `src/brand/` feature folder
- Create typed brand config (colors, assets, typography)
- All components reference brand through this single module
- **Pros**: Clean architecture, single source of truth
- **Cons**: Over-engineering for current scale (only ~6 components use brand)
- **Effort**: High

## Recommendation

**Approach A** with **selective improvements from B**:

1. Replace all string references ("Opita Vibe" → "Vibe Studio")
2. Copy all assets to correct locations
3. Integrate CSS variables
4. Add `vibe-black` to Tailwind config
5. Replace hardcoded colors in the specific components identified above with CSS variables
6. Keep Tailwind's `opita` palette for layout/structure colors that aren't brand-specific

This hits the sweet spot: complete brand integration without over-engineering.

## Risks

- **Icon breakage**: Tauri's icon system requires specific filenames. Wrong sizes or missing files could break Windows app icon generation. Mitigation: verify with `tauri icon` or manual QA.
- **Contrast issues**: The new brand black (`#0b0b0c`) is very dark. On the app's `#1e1e1e` background, it may be barely visible. The status bar should use indigo, not black.
- **Test failures**: ~6 test files assert "Opita Vibe" strings. All must be updated atomically to prevent CI breakage.
- **Tray icon visibility**: `iconAsTemplate: true` in tauri.conf.json means the icon is treated as a mask — the new 4-module symbol may not render well as a macOS template icon. Windows tray works differently.

## Ready for Proposal

**Yes** — the exploration is complete and covers all touchpoints. The orchestrator should launch `sdd-propose` next with the change name `integrate-vibe-studio-branding`.
