# Delta Spec: brand-assets (vibe-visual-identity)

## Modified Requirements

### Requirement: Typography System
The typography system MUST shift from corporate to friendly/modern to better suit a student audience.

#### Scenario: Rendering UI text
- GIVEN any UI component containing text
- WHEN the component renders
- THEN it SHALL use a modern geometric sans-serif font (e.g., `Outfit`, `Inter`, or `Plus Jakarta Sans`) as the primary `font-sans` family
- AND monospaced fonts (for code) SHALL remain clean and legible (e.g., `JetBrains Mono` or `Fira Code`).
