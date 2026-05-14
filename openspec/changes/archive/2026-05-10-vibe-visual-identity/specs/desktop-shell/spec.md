# Delta Spec: desktop-shell (vibe-visual-identity)

## Modified Requirements

### Requirement: Glassmorphism Surfaces
The primary layout panels of the Desktop Shell (Sidebar, Header, Main Editor container) MUST utilize a "frosted glass" visual effect to overlay the ambient background gradients without obscuring content.

#### Scenario: Rendering the main layout
- GIVEN the desktop shell renders the sidebar and header
- WHEN the panels are displayed
- THEN their backgrounds MUST be semi-transparent (e.g., `bg-slate-900/60` or `rgba(15, 23, 42, 0.6)`)
- AND they MUST apply a backdrop blur filter (`backdrop-blur-md` or `backdrop-blur-lg`)
- AND they SHOULD have a very subtle, semi-transparent border (e.g., `border-white/10`) to define their edges clearly against the background glow.
