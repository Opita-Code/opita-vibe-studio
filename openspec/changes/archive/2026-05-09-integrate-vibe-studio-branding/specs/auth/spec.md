# Delta for Auth

## ADDED Requirements

### Requirement: Login Screen Brand Presence

The login screen MUST render the Vibe Studio brand symbol and product name. The legacy "OV" text placeholder SHALL NOT appear. Brand colors on the login screen MUST use CSS custom properties from the brand system.

#### Scenario: Brand symbol renders on login screen

- GIVEN the app is not authenticated
- WHEN the login screen renders
- THEN the 4-module Vibe Studio viseme symbol SVG is displayed
- AND the "OV" text placeholder is NOT present
- AND the product name heading displays "Vibe Studio"

#### Scenario: Login interactive elements use brand colors

- GIVEN the login screen is rendered
- WHEN interactive elements (buttons, links) are visible
- THEN the primary button uses branding indigo (`var(--vibe-indigo)` or `#4f46e5`)
- AND link text uses brand indigo, NOT `#818cf8`
- AND hover states use a darker indigo, NOT `#4338ca`

#### Scenario: Login screen preserves existing tagline

- GIVEN the login screen renders with new branding
- WHEN the tagline is displayed
- THEN it still shows "Vibecodea en español. Aprende sin darte cuenta."
- AND the tagline text is unchanged from the pre-branding version
