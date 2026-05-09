# Brand Colors Specification

## Purpose

Defines the Vibe Studio color system through CSS custom properties and Tailwind theme extensions. The brand palette uses indigo `#4f46e5` as primary accent and `#0b0b0c` as primary dark.

## Requirements

### Requirement: CSS Custom Properties

The global stylesheet MUST define brand CSS custom properties on `:root`. The system SHALL expose `--vibe-indigo: #4f46e5`, `--vibe-black: #0b0b0c`, `--vibe-dark-bg: #1e1e1e`, and `--vibe-white: #ffffff`.

#### Scenario: CSS variables resolve in browser

- GIVEN `src/index.css` imports brand CSS
- WHEN the app renders in the browser
- THEN `var(--vibe-indigo)` computes to `#4f46e5`
- AND `var(--vibe-black)` computes to `#0b0b0c`
- AND `var(--vibe-dark-bg)` computes to `#1e1e1e`

### Requirement: Tailwind Theme Extension

The Tailwind configuration MUST expose `vibe-black: '#0b0b0c'` as a theme color. Utility classes like `bg-vibe-black` and `text-vibe-black` SHALL resolve correctly at build time.

#### Scenario: Tailwind classes using vibe-black compile

- GIVEN `tailwind.config.js` includes `vibe` color entries
- WHEN a component uses `bg-vibe-black` class
- THEN the generated CSS includes `background-color: #0b0b0c`

### Requirement: Component Color Migration

Components using hardcoded brand colors SHOULD migrate to CSS custom properties. The hover color `#4338ca` SHALL be replaced with a darker indigo. The link color `#818cf8` SHALL be replaced with brand indigo `#4f46e5`.

#### Scenario: Login screen uses CSS variables for brand colors

- GIVEN `LoginScreen.tsx` is updated
- WHEN it renders interactive elements (buttons, links)
- THEN brand accent colors reference `var(--vibe-indigo)`
- AND hover states use a darker indigo, NOT `#4338ca`
- AND link text uses brand indigo, NOT `#818cf8`

#### Scenario: Status bar uses brand color

- GIVEN the app main window is open
- WHEN the status bar renders
- THEN its background is `#4f46e5` or `#0b0b0c`
- AND it MUST NOT use the legacy `#007acc` (VS Code blue)

#### Scenario: PlanCard and ByokPanel use brand colors

- GIVEN a component renders with interactive elements
- WHEN brand accent colors are applied
- THEN accent backgrounds use `var(--vibe-indigo)` or `#4f46e5`
- AND hover states do NOT use `#4338ca`
- AND link/adornment text does NOT use `#818cf8`

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
