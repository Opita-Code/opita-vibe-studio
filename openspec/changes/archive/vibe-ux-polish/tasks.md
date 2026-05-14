# Tasks: vibe-ux-polish

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

## Tasks

- [ ] 1. **Create Landing Page (`src/pages/LandingPage.tsx`)**:
  - Implement a full-page hero layout utilizing the global dark body theme.
  - Add the `Vibe Studio` glowing logo/text, a subheadline, and a primary CTA "Abrir el Studio".
  - The CTA triggers `window.history.pushState({}, '', '/app'); window.dispatchEvent(new Event('popstate'));`.

- [ ] 2. **Create Root Router (`src/Root.tsx`)**:
  - Implement a simple component listening to `popstate`.
  - Maintain `currentPath` state.
  - Return `<LandingPage />` if `currentPath === '/'`, else `<App />`.

- [ ] 3. **Update Main Entry (`src/main.tsx`)**:
  - Render `<Root />` instead of `<App />`.

- [ ] 4. **Enhance Editor Empty State (`src/components/layout/EditorPanel.tsx`)**:
  - Import `getFileSystemBackend` and add a `handleOpenFolder` function.
  - Read `rootPath = useProjectStore((s) => s.rootPath)`.
  - If `!rootPath`, render the new Glassmorphism empty state card: `bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-10`.
  - Add an "Abrir Carpeta Local" button that triggers `handleOpenFolder`.
  - If `rootPath` exists but `!activeTab`, keep the existing "Abre un archivo del explorador" state.
