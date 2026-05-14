# Proposal: Vibe Studio Polish — Quick Wins Sprint

## Intent

Fix CRITICAL spec violations in the Vibe Studio MVP where code diverges from the brand-colors and brand-copy specifications. This is a targeted, low-risk polish round: replace legacy colors with indigo tokens, remove Argentine voseo forms, fix broken Tailwind opacity modifiers on CSS variables, and add a missing CSS keyframe.

## Scope

### In Scope
- Replace 10 legacy color instances (`#007acc`, `#0098ff`, `#094771`) in ApplyCodeBlock.tsx, FileTree.tsx with `var(--vibe-indigo)` / indigo equivalents
- Fix 4 voseo forms to Colombian-neutral Spanish in ApplyCodeBlock.tsx, EditorPanel.tsx, ChatPanel.tsx, lib/tips.ts
- Fix 4 broken Tailwind CSS opacity modifiers (`/80`, `/20` on `var(--vibe-indigo)` arbitrary-value classes) in LoginScreen.tsx, PlanCard.tsx → inline style + `hover:opacity-80` pattern
- Add `@keyframes slideInUp` definition to index.css (referenced by TipBanner.tsx but never defined)
- Affected files: ApplyCodeBlock.tsx, FileTree.tsx, LoginScreen.tsx, PlanCard.tsx, EditorPanel.tsx, ChatPanel.tsx, lib/tips.ts, index.css

### Out of Scope
- Focus-visible a11y gaps (TerminalPanel, ByokPanel, LoginScreen, FileTree, all buttons) — separate a11y pass
- Empty state consistency, loading state polish, micro-interactions, spacing adjustments — deferred to comprehensive polish round
- New features, behavior changes, backend/Rust changes
- CSS custom property extraction for neutral/surface colors (VS Code grays)

## Capabilities

### New Capabilities
None — this change fixes code to comply with existing specifications.

### Modified Capabilities
None — no specification requirements are being added, removed, or altered.

## Approach

One atomic PR targeting only Approach 1 (Quick Wins) from the exploration. Each file gets targeted, surgical edits:
1. **Color replacements**: `#007acc` / `#0098ff` → `var(--vibe-indigo)`; `#094771` → `var(--vibe-indigo)/20`
2. **Voseo fixes**: `Abrí`/`Podés`/`Definis` → `Abre`/`Puedes`/`Defines`
3. **Opacity fixes**: replace broken Tailwind `bg-[var(--vibe-indigo)]/NN` with inline `style={{ backgroundColor: "var(--vibe-indigo)" }}` + `hover:opacity-80` (matching existing correct pattern in ChatInput, Sidebar, TipBanner, ErrorBoundary)
4. **Keyframe**: add `slideInUp` definition to `index.css` with standard transform/opacity animation

Estimated <100 changed lines across 9 files. Single PR, no chaining required. Run existing 522 tests + quality gates after changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/renderer/components/chat/ApplyCodeBlock.tsx` | Modified | 7 color fixes + 1 voseo fix |
| `src/renderer/components/layout/FileTree.tsx` | Modified | 3 color fixes |
| `src/renderer/components/auth/LoginScreen.tsx` | Modified | 2 opacity fixes |
| `src/renderer/components/settings/PlanCard.tsx` | Modified | 2 opacity fixes |
| `src/renderer/components/editor/EditorPanel.tsx` | Modified | 1 voseo fix |
| `src/renderer/components/chat/ChatPanel.tsx` | Modified | 1 voseo fix |
| `src/renderer/lib/tips.ts` | Modified | 2 voseo fixes |
| `src/renderer/index.css` | Modified | 1 keyframe addition |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Indigo (#4f46e5) is darker/bolder than VS Code blue (#007acc) — ApplyCodeBlock dialogs may shift contrast | Medium | Visual spot-check after changes; brand spec explicitly mandates this shift |
| Snapshot tests may fail on class/color changes | Low | Run full `npx vitest run` suite; update snapshots if needed |
| `slideInUp` keyframe could conflict with existing animations | Very Low | Use standard `translateY`/`opacity` — non-invasive |

## Rollback Plan

Revert the single commit. All changes are atomic, within one PR. No database migrations, no config changes, no irreversible operations.

## Dependencies

- Existing test suite (522 tests, vitest)
- Quality gates: `npx vitest run && npx eslint . && tsc --noEmit`

## Success Criteria

- [ ] Zero instances of `#007acc`, `#0098ff`, `#094771` in component files
- [ ] Zero voseo forms (`Abrí`, `Podés`, `Definis`, `Escribí`, `Usá`) in user-facing strings
- [ ] Zero Tailwind opacity modifiers (`/80`, `/20`) on `var(--vibe-indigo)` arbitrary-value classes
- [ ] `@keyframes slideInUp` is defined and TipBanner animation works
- [ ] Full test suite passes: `npx vitest run`
- [ ] Quality gates pass: `npx eslint . && tsc --noEmit`
