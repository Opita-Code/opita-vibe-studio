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
