# Design: Vibe Studio Polish — Quick Wins Sprint

## Technical Approach

Surgical edits across 8 files — no new components, no state changes, no Rust/Tauri modifications. Four fix categories applied atomically: replace legacy blues with `var(--vibe-indigo)`, correct voseo to Colombian-neutral Spanish, fix broken Tailwind opacity modifiers on CSS custom properties, and add a missing `@keyframes slideInUp` definition.

## Architecture Decisions

### Decision: CSS variable usage pattern for solid colors

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Tailwind `text-indigo-600` | Independent of CSS vars; drifts from brand token | **Reject** |
| `className="text-[var(--vibe-indigo)]"` | Works for text/border/ring; no opacity support | **Accept for text/border/ring** |
| `style={{ color: "var(--vibe-indigo)" }}` | Works everywhere; more verbose per-element | **Accept for bg + hover-opacity pattern** |

**Rationale**: Match existing correct pattern in ChatInput, Sidebar, ErrorBoundary, TipBanner — inline `style={{ backgroundColor: "var(--vibe-indigo)" }}` + `hover:opacity-80 transition-opacity` for buttons. For borders/rings, use `className="border-[var(--vibe-indigo)]"` directly. For hover backgrounds on context menu items (FileTree), use Tailwind `hover:bg-indigo-900/20` since CSS var opacity on pseudo-states is unsupported.

### Decision: Context menu hover background fallback

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline style wrapper div | Correct; adds DOM node per item | **Reject** (over-engineering) |
| `hover:bg-indigo-900/20` | Tailwind native, stays in indigo family | **Accept** |
| Custom CSS class with `:hover { background: var(--vibe-indigo); opacity: 0.2 }` | Correct; requires new CSS file | **Reject** (unnecessary file) |

**Rationale**: `indigo-900` (#312e81) at 20% opacity on `#252526` produces a visually equivalent dark indigo to the original `#094771`. No new CSS required, stays within indigo color family per brand spec.

## File Changes

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/components/chat/ApplyCodeBlock.tsx` | Modify | ~8 lines | Replace `#007acc`/`#0098ff` with `var(--vibe-indigo)` + inline style pattern; fix `Abrí` → `Abre` |
| `src/components/files/FileTree.tsx` | Modify | ~3 lines | Replace `#007acc`/`#094771` with `var(--vibe-indigo)` / `indigo-900/20` |
| `src/components/auth/LoginScreen.tsx` | Modify | ~2 lines | Replace broken `hover:bg-[var(--vibe-indigo)]/80` with inline style + `hover:opacity-80` |
| `src/components/usage/PlanCard.tsx` | Modify | ~2 lines | Replace broken opacity modifiers on badge and upgrade button |
| `src/components/layout/EditorPanel.tsx` | Modify | 1 line | Fix `Abrí` → `Abre` |
| `src/components/layout/ChatPanel.tsx` | Modify | 1 line | Fix `Podés` → `Puedes` |
| `src/lib/tips.ts` | Modify | 1 line | Fix `Definis` → `Defines`, `Podés` → `Puedes` in css-grid explanation |
| `src/index.css` | Modify | +8 lines | Add `@keyframes slideInUp` definition |

## Fix Patterns (concrete)

**Pattern A — Button with solid bg + hover opacity** (ApplyCodeBlock, LoginScreen, PlanCard):
```tsx
// BEFORE
className="bg-[#007acc] text-white hover:bg-[#0098ff] transition-colors"
// AFTER
style={{ backgroundColor: "var(--vibe-indigo)" }}
className="text-white rounded hover:opacity-80 transition-opacity"
```

**Pattern B — Border/ring only** (ApplyCodeBlock dialog, FileTree input):
```tsx
// BEFORE
className="... border-[#007acc]"
// AFTER
className="... border-[var(--vibe-indigo)]"
```

**Pattern C — Hover background on dark surface** (FileTree context menu):
```tsx
// BEFORE
className="... hover:bg-[#094771]"
// AFTER
className="... hover:bg-indigo-900/20"
```

**Pattern D — Text with opacity on hover** (LoginScreen "Continuar sin cuenta"):
```tsx
// BEFORE
className="text-[var(--vibe-indigo)] hover:text-[var(--vibe-indigo)]/80"
// AFTER
style={{ color: "var(--vibe-indigo)" }}
className="hover:opacity-80 transition-opacity"
```

**Pattern E — Badge with low-opacity bg** (PlanCard free badge):
```tsx
// BEFORE
className="bg-[var(--vibe-indigo)]/20 text-[var(--vibe-indigo)]"
// AFTER
style={{ backgroundColor: "var(--vibe-indigo)", opacity: 0.2 }}
className="text-[var(--vibe-indigo)]"
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | All existing 522 tests | `npx vitest run` — must pass unchanged |
| Type | No type regressions | `tsc --noEmit` — zero errors |
| Lint | No lint violations | `npx eslint .` — zero errors |
| Visual | Indigo renders, text reads correctly, slideInUp animates | Manual spot-check in Tauri WebView |

Snapshot tests may need updating if class/color changes affect rendered output. Run `npx vitest run --update` if snapshots fail.

## Migration / Rollout

No migration required. Single atomic commit. Rollback: `git revert`.

## Open Questions

None — all fixes are unambiguous and spec-driven.
