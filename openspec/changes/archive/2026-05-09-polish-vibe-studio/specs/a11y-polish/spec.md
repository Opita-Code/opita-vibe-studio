# Accessibility Polish Specification

## Purpose

Close critical accessibility gaps: add aria metadata to icon-only controls, ensure visible focus-visible states on all interactive elements, and associate labels with form inputs.

## Requirements

### Requirement: Aria Labels on Icon-Only Controls

Every interactive element that lacks visible text content MUST have an `aria-label` attribute describing its action. This includes icon buttons, toggle buttons, and tab controls without text labels.

#### Scenario: Icon button exposes accessible name

- GIVEN a button renders only an SVG icon with no visible text
- WHEN a screen reader inspects the element
- THEN the button has `aria-label` describing its action (e.g., "Abrir proyecto", "Alternar vista previa")
- AND the label is in Colombian-neutral Spanish

#### Scenario: File tab controls expose aria roles

- GIVEN FileTabs renders open file tabs
- WHEN a screen reader navigates the tab list
- THEN each tab has `role="tab"` and `aria-selected` reflecting active state
- AND the tab list container has `role="tablist"`

### Requirement: Visible Focus Indicators

All interactive elements (buttons, inputs, selects, textareas, tab controls) MUST render a visible focus indicator when receiving keyboard focus via `:focus-visible`. The focus ring MUST use `var(--vibe-indigo)` and have sufficient contrast against the dark background.

#### Scenario: Keyboard focus is visible on all inputs

- GIVEN the user presses Tab to navigate
- WHEN focus lands on any input, button, or select element
- THEN a visible ring (≥2px) appears in `var(--vibe-indigo)`
- AND no interactive element relies solely on `outline-none` without a `focus-visible` fallback

#### Scenario: Resize handle exposes separator role

- GIVEN the layout resize handle is rendered
- WHEN a screen reader inspects it
- THEN the handle has `role="separator"` and `aria-orientation="vertical"`

### Requirement: Form Input Labels

Every form input (text, select, textarea) MUST have an associated label, either via a visible `<label>` element with `htmlFor` or via `aria-label`/`aria-labelledby` on the input itself.

#### Scenario: Form inputs have accessible labels

- GIVEN any form contains input elements
- WHEN inspecting each input's accessibility tree
- THEN every input has an accessible name from a `<label>`, `aria-label`, or `aria-labelledby`
- AND no input lacks a programmatically associated label
