# Tasks: vibe-visual-identity

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~45 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

## Tasks

- [ ] 1. **Typography Import**: In `index.html`, add `<link>` tags for `Outfit` and `JetBrains Mono` from Google Fonts.
- [ ] 2. **Tailwind Config**: In `tailwind.config.js`, extend `theme.fontFamily` to set `sans` to `['Outfit', 'sans-serif']` and `mono` to `['JetBrains Mono', 'monospace']`.
- [ ] 3. **Global CSS**: In `src/index.css`, update the `body` selector to use `background-color: #0f172a;` (slate-900) and add the ambient glowing radial gradients.
- [ ] 4. **Shell Glassmorphism**: In `src/App.tsx`:
      - Remove the hardcoded `bg-[#1e1e1e]` from the root wrapper so the `body` glow shows through.
      - Update the `<header>` element to use `bg-slate-900/60 backdrop-blur-md border-white/10` instead of solid `#2d2d2d`.
      - Update base text colors from `#d4d4d4` to Tailwind slate text (`text-slate-200` or `slate-50`).
