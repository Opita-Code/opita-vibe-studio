# Delta for Learning Layer

## ADDED Requirements

### Requirement: Contextual Micro-Explanations

The system MUST display "¿Sabías que...?" tips triggered by specific code events: file creation, AI code generation, or user saving a file. Tips SHALL be in Colombian Spanish, non-intrusive (toast/banner, dismissible), and relevant to the code just generated.

#### Scenario: Tip appears after AI generates CSS flexbox

- GIVEN the AI generates `display: flex` in `styles.css`
- WHEN the file is saved
- THEN a toast appears: "¿Sabías que...? Flexbox te permite alinear elementos sin usar floats ni tablas."
- AND the tip auto-dismisses after 8 seconds or on click

#### Scenario: Tip does not repeat the same concept

- GIVEN the user has already seen the flexbox tip
- WHEN flexbox code is generated again
- THEN the same tip does NOT appear (deduplicated via seen-tips set in local state)

### Requirement: Tip Library

The system SHALL maintain a tip library of at least 20 pre-written Spanish tips covering: HTML structure, CSS layout (flexbox, grid, selectors), JS basics (variables, functions, events, DOM). Tips MUST be stored as static data (JSON) loadable from the frontend; no backend call required.

#### Scenario: Tip library is queryable by concept tag

- GIVEN the tip library is loaded
- WHEN code generation yields a file tagged `css-flexbox`
- THEN the learning layer queries tips by tag and renders the relevant one
- AND if no tip matches, no toast appears (graceful no-op)
