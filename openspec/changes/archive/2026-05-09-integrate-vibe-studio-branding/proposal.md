# Proposal: Integrate Vibe Studio Branding

## Intent

Replace placeholder MVP branding (hardcoded "OV" logo, "Opita Vibe" name, generic indigo palette) with the new Vibe Studio brand identity: the 4-module viseme symbol, "vibe STUDIO" wordmark, and updated color token system (`#4f46e5`, `#0b0b0c`, `#1e1e1e`). The codebase currently reflects a pre-brand MVP — this aligns every visible touchpoint with the approved brand direction.

## Scope

### In Scope

- Replace "Opita Vibe" → "Vibe Studio" in 9 source files (UI, system prompts, headers, config)
- Replace "OV" placeholder logo with new SVG symbol in LoginScreen
- Copy SVG lockups to `src/assets/`, favicon.ico to `public/`
- Replace all 19 Tauri icon files in `src-tauri/icons/` with dark-variant brand PNGs
- Integrate brand CSS custom properties (`--vibe-indigo`, `--vibe-black`, `--vibe-dark-bg`) into `src/index.css`
- Add `vibe-black: '#0b0b0c'` to Tailwind config
- Replace hardcoded hover/link colors (`#4338ca`, `#818cf8`) with CSS variables across 4 components
- Update window title, productName, Cargo description, CSP description
- Update 6 test assertions referencing old branding strings
- Update `desktop-shell` spec strings (`"Vibe-Studio"` → `"Vibe Studio"`)

### Out of Scope

- Package name (stays `vibe-studio`); bundle identifier stays `com.opita.vibe-studio`
- Typography changes (Nunito Sans, Inter)
- Full design token system or brand component abstraction
- Business logic, features, architecture changes
- `@opita.co` mock email domains (placeholder data, not branding)
- `ProviderTier` `"opita"` tier name (functional, not product branding)
- Archived change artifacts (historical, immutable)

## Capabilities

### New Capabilities

None — this is a branding integration, not a new feature.

### Modified Capabilities

- **desktop-shell**: Window title `"Vibe-Studio"` → `"Vibe Studio"`; tray menu `"Abrir Vibe-Studio"` → `"Abrir Vibe Studio"`

## Approach

**Approach A**: Minimal string replacement with CSS variable integration. Replace every "Opita Vibe" string atomically, copy brand assets to correct paths, integrate CSS custom properties, and add `vibe-black` to Tailwind. Keep the existing `opita` palette for structural colors that aren't brand-specific. No component abstraction — direct `<img>` tag for the logo SVG.

## Affected Areas

| Area             | Impact       | Files                                                                                              |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| UI strings       | Modified     | `LoginScreen.tsx`, `StreamingIndicator.tsx`, `prompts.ts`, `mock.ts`, `openrouter.ts`              |
| Config/metadata  | Modified     | `tauri.conf.json`, `Cargo.toml`, `capabilities/default.json`, `AGENTS.md`, `openspec/config.yaml`  |
| Assets           | New/Replaced | `src/assets/` (new), `src-tauri/icons/` (19 files), `public/favicon.ico`                           |
| CSS/Tailwind     | Modified     | `index.css`, `tailwind.config.js`, `index.html`                                                    |
| Component colors | Modified     | `LoginScreen.tsx`, `StatusBar.tsx`, `PlanCard.tsx`, `ByokPanel.tsx`, `ResizeHandle.tsx`, `App.tsx` |
| Tests            | Modified     | `LoginScreen.test.tsx`, `pipeline.test.ts`, `mock.test.ts`, `openrouter.test.ts`                   |
| Specs            | Modified     | `desktop-shell/spec.md`                                                                            |

## Risks

| Risk                                                                | Likelihood | Mitigation                                                           |
| ------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| Tauri icon filename mismatch breaks Windows icon generation         | Med        | Verify exact filenames per Tauri convention; `tauri icon` validation |
| `#0b0b0c` on `#1e1e1e` has poor contrast for status bar             | Low        | Use brand indigo `#4f46e5` for status bar, not black                 |
| 6 test files break if strings not updated atomically                | High       | Update all source + test strings in same commit; run `npm test`      |
| Tray `iconAsTemplate: true` may not render new symbol well on macOS | Low        | Keep template mode; test visually; Windows unaffected                |
| SVG loaded via Tauri asset protocol may hit CSP                     | Low        | Add `img-src 'self' asset:` if needed                                |

## Rollback Plan

1. `git revert` the branding commit chain
2. Restore `src-tauri/icons/` from git (all old icons are versioned)
3. Delete `src/assets/` directory
4. Remove CSS variable block from `src/index.css`
5. Revert `tailwind.config.js` to remove `vibe` palette
6. Run `npm test && npm run typecheck` to confirm rollback is clean

## Dependencies

- Brand asset package at `C:\Users\nicou\AppData\Local\Temp\opencode\vibe-studio-dev-assets\vibe-studio-dev-assets\`
- No external API or service dependencies

## Success Criteria

- [ ] All 9 source files show "Vibe Studio", zero occurrences of "Opita Vibe" remain
- [ ] Login screen renders the new 4-module SVG symbol instead of text "OV"
- [ ] All 19 Tauri icon files are new brand PNGs, `tauri build` succeeds
- [ ] `tailwind.config.js` includes `vibe-black` and CSS variables resolve in dev build
- [ ] Favicon shows Vibe Studio symbol in browser tab
- [ ] `npm test` passes — all 6 branding-affected tests updated
- [ ] `npm run typecheck` passes with zero errors
- [ ] Desktop-shell spec reflects "Vibe Studio" consistently
