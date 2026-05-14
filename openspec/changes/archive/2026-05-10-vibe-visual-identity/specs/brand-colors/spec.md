# Delta Spec: brand-colors (vibe-visual-identity)

## Modified Requirements

### Requirement: Vibe "Glass & Glow" Palette
Vibe Studio MUST replace the corporate Opita Studio color palette with a vibrant, student-focused "Glass & Glow" palette.

#### Scenario: App renders in Dark Mode
- GIVEN the application loads
- WHEN the base theme is applied
- THEN the main background SHALL be a deep slate/blue-gray (e.g., `#0f172a` / Tailwind `slate-900`)
- AND subtle, glowing ambient gradients (purple `#a855f7`, cyan `#06b6d4`, pink `#ec4899`) SHALL exist behind the main content panels
- AND text MUST remain high-contrast (e.g., `#f8fafc` / `slate-50`) to ensure readability.
