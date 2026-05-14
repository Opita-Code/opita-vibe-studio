# Proposal: vibe-ux-polish

## Intent
Improve the end-to-end user experience for Vibe Studio by introducing a dedicated Landing Page and a polished Empty State inside the IDE. The flow must be "Zero-Friction", welcoming students with the "Glass & Glow" visual identity and guiding them to open a local project without forcing a login.

## Scope

### In Scope
- Create a `LandingPage` component featuring the new logo concept, a hero headline, and a clear Call to Action to enter the studio.
- Implement a simple router (or state-based view switcher) at the root level to toggle between the Landing Page (`/`) and the IDE Shell (`/app`).
- Redesign the Empty State inside `EditorPanel.tsx` (when no project is selected). It should be a centered, glassmorphism card inviting the user to "Abrir Carpeta" with an icon and brief instructions.
- Ensure transitions between the views are smooth.

### Out of Scope
- Full SEO optimization of the landing page (MVP focus is visual flow).
- Multi-page marketing site (Pricing, About, etc. are deferred).

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `guest-first-access`: Add requirement for a dedicated landing page that acts as the primary entry point before accessing the IDE shell. Update empty state requirements to be visually guided.

## Approach
1. **Routing**: Since `react-router-dom` might not be installed, we will use a simple Zustand store or a root-level state in `main.tsx` to render `<LandingPage />` if `window.location.pathname === '/'`, and `<App />` if `'/app'`.
2. **Landing Component**: Create `src/pages/LandingPage.tsx` using Tailwind CSS. It will feature the body's radial gradients and a prominent hero section.
3. **Empty State**: Modify `src/components/editor/EditorPanel.tsx`. If `!activeProject`, render a `<div className="flex-1 flex items-center justify-center">` containing a glass card with the "Abrir Carpeta" button, using `useProjectStore().openProject()`.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/main.tsx` | Modified | Add simple routing logic |
| `src/pages/LandingPage.tsx` | New | The new landing page component |
| `src/components/editor/EditorPanel.tsx` | Modified | Update the empty state visual design |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Routing conflicts with Vite dev server | Low | Use standard `window.location` checks. Vite handles SPA routing gracefully. |

## Rollback Plan
Revert `main.tsx` to directly render `<App />` and delete `LandingPage.tsx`.

## Success Criteria
- [ ] Navigating to `/` shows the Landing Page.
- [ ] Clicking "Entrar al Studio" goes to `/app` and shows the IDE.
- [ ] When the IDE has no project loaded, a polished glass card invites the user to open a folder.
