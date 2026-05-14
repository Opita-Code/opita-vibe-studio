# Proposal: vibe-visual-identity

## Intent
Opita Vibe Studio needs an independent, dynamic visual identity tailored for students and "vibe-coding". It must diverge from the rigid, enterprise-focused constraints of Opita Studio while remaining premium. We are adopting the "Glass & Glow" aesthetic to achieve a modern, sleek, macOS-inspired UI that reduces cognitive load but maintains vibrant energy.

## Scope

### In Scope
- Define a new dark-mode-first color palette (slate/blue-gray backgrounds, purple/pink gradients).
- Define typography standards (e.g., modern geometric sans-serif for UI, clean monospace for code).
- Implement Glassmorphism styling utilities (translucent frosted glass panels with subtle borders).
- Update the application icon and brand assets specification.
- Apply the base theme to global CSS tokens.

### Out of Scope
- Complete redesign of individual internal components (e.g., settings panel layout). This focuses on the global design system (colors, typography, surface treatments).
- Light mode support (focus is strictly dark mode for MVP).

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `brand-colors`: Replace enterprise palette with the Vibe Studio "Glow" palette.
- `app-icon`: Define the new neon 'V' soundwave/bracket logo.
- `brand-assets`: Update general asset styling to match the new identity.
- `desktop-shell`: Integrate glassmorphism surfaces and gradient backgrounds for the main app container.

## Approach
1. **Design Tokens**: Update `index.css` (or equivalent CSS file) to inject the new CSS variables for colors (backgrounds, surfaces, borders, primary accents).
2. **Tailwind Config**: Extend `tailwind.config.js` to include custom backdrop-blur utilities and gradient animations.
3. **Typography**: Import the selected font (e.g., `Outfit` or `Inter` via Google Fonts) and apply it to the `sans` font family.
4. **Surfaces**: Redefine the base `DesktopShell` styles to use a subtle glowing background with a glassmorphism overlay for the main content areas.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `index.css` | Modified | Root CSS variables for colors and fonts |
| `tailwind.config.js` | Modified | Add glass/glow utilities |
| `index.html` | Modified | Inject new Google Fonts |
| `src/components/DesktopShell.tsx` | Modified | Apply the new background and glass surfaces |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance drop due to heavy `backdrop-filter: blur()` usage | Medium | Use glassmorphism sparingly (only on major layout panels, not on every small card). |
| Contrast accessibility issues with gradients | Low | Ensure text on glass surfaces uses solid, high-contrast colors (white/light gray). |

## Rollback Plan
Revert changes to `index.css`, `tailwind.config.js`, and the shell component using Git.

## Dependencies
- Google Fonts (for typography).

## Success Criteria
- [ ] Vibe Studio features a dark slate background with subtle vibrant gradients.
- [ ] Major layout panels utilize a frosted glass effect.
- [ ] The typography is updated to a modern geometric sans-serif.
- [ ] The app feels distinctively "vibey" and premium compared to standard IDEs.
