# Brand Polish Specification

## Purpose

Enforce Vibe Studio indigo brand accent (`#4f46e5`) across all interactive surfaces, eliminate legacy VS Code blues, and ensure all hover/focus states use working CSS custom property patterns.

## Requirements

### Requirement: Indigo Accent Enforcement

All accent colors in interactive elements MUST use `var(--vibe-indigo)` (`#4f46e5`). Legacy blues (`#007acc`, `#0098ff`, `#1e4d8c`) MUST NOT appear in any component.

#### Scenario: All accent backgrounds use Vibe indigo

- GIVEN any component renders a button, link, or accent surface
- WHEN the element applies a background color
- THEN the color resolves to `#4f46e5` via `var(--vibe-indigo)`
- AND no element uses `#007acc`, `#0098ff`, or `#1e4d8c`

#### Scenario: Focus rings use Vibe indigo

- GIVEN any interactive element receives keyboard focus
- WHEN the focus ring renders
- THEN the ring color is `var(--vibe-indigo)`
- AND it MUST NOT use `#1e4d8c` or any other blue

### Requirement: Working Hover Patterns on CSS Variables

Hover states that reference `var(--vibe-indigo)` MUST use a pattern that produces visible opacity reduction. Tailwind opacity modifiers (`/80`) on arbitrary-value CSS var classes (`bg-[var(--vibe-indigo)]/80`) MUST NOT be used — they do not apply to custom properties.

#### Scenario: Hover on CSS variable produces visible opacity

- GIVEN a button uses `var(--vibe-indigo)` as background
- WHEN the user hovers over the button
- THEN the background visibly lightens or reduces opacity
- AND the hover effect works in all supported browsers

### Requirement: CSS Custom Property References

All brand-critical colors in component styles MUST reference CSS custom properties. Hardcoded hex values for brand colors (`#4f46e5`, `#0b0b0c`, `#1e1e1e`) in component classes SHALL be replaced with `var(--vibe-*)` references.

#### Scenario: No hardcoded brand hex values in component styles

- GIVEN a component uses brand colors for backgrounds or borders
- WHEN inspecting the element's styles
- THEN brand color values reference `var(--vibe-indigo)`, `var(--vibe-black)`, or `var(--vibe-dark-bg)`
- AND no `className` contains the literal `#4f46e5`
