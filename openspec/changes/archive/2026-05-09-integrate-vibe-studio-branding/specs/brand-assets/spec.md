# Brand Visual Assets Specification

## Purpose

Defines the Vibe Studio brand visual asset files (SVG, ICO, CSS) that MUST be present in the project and their required locations for the desktop app and web frontend.

## Requirements

### Requirement: Brand Symbol SVG

The project MUST contain the 4-module Vibe Studio viseme symbol as an SVG file at `src/assets/logo-symbol.svg`. This file SHALL be the primary brand mark used in the login screen and any brand-identifying UI.

#### Scenario: Symbol SVG is available for login screen

- GIVEN the project is built
- WHEN the login screen renders
- THEN the `<img>` tag loads `src/assets/logo-symbol.svg`
- AND the rendered image is the 4-module viseme symbol, NOT the "OV" text placeholder

### Requirement: Brand Lockup SVGs

The project MUST contain horizontal lockup SVGs at `src/assets/logo-horizontal.svg` and `src/assets/logo-horizontal-bg.svg`. The lockup SHALL combine the symbol and "vibe STUDIO" wordmark.

#### Scenario: Lockups present for marketing surfaces

- GIVEN the project source tree
- WHEN listing `src/assets/`
- THEN `logo-horizontal.svg` and `logo-horizontal-bg.svg` exist
- AND both render the full "vibe STUDIO" lockup

### Requirement: Favicon

The project MUST contain a Vibe Studio favicon at `public/favicon.ico`. The favicon SHALL render the brand symbol in the browser tab.

#### Scenario: Favicon renders in browser tab

- GIVEN the app is running in dev mode or served in a browser
- WHEN the page loads
- THEN the browser tab displays the Vibe Studio symbol favicon
- AND the favicon is NOT the default Vite or generic icon

### Requirement: Brand CSS Variables File

The project MUST contain brand CSS custom properties at `src/assets/brand.css`. This file SHALL export `--vibe-indigo`, `--vibe-black`, `--vibe-dark-bg`, and `--vibe-white`.

#### Scenario: Brand CSS variables resolve at runtime

- GIVEN `src/assets/brand.css` is imported by `src/index.css`
- WHEN the app renders in the browser
- THEN `var(--vibe-indigo)` computes to `#4f46e5`
- AND `var(--vibe-black)` computes to `#0b0b0c`
