# Delta for OpenSpec Pipeline

## ADDED Requirements

### Requirement: Three-Phase Pipeline

The system MUST implement a simplified 3-phase pipeline: **Entender** (parse intent, ask clarifying questions), **Construir** (generate code files), **Verificar** (validate output via live preview and linting). The pipeline SHALL run invisibly — the user only sees result artifacts (code + preview), not pipeline state transitions.

#### Scenario: User prompt flows through full pipeline

- GIVEN the user sends "Quiero una página de portafolio con 3 secciones"
- WHEN the pipeline processes the prompt
- THEN Entender parses intent and generates a file plan (invisible)
- AND Construir generates `index.html`, `styles.css`, `script.js` and writes them to disk
- AND Verificar checks the preview renders and reports errors if any
- AND the user sees: code in editor + live preview (no pipeline UI shown)

### Requirement: Error Loopback

If Verificar detects an error (lint failure, preview render error), the pipeline SHALL loop back to Construir with the error description. After 3 retry attempts, the system MUST surface the error to the user rather than loop indefinitely.

#### Scenario: AI-generated code fails lint; auto-retries

- GIVEN Construir generated JavaScript with a missing closing brace
- WHEN Verificar runs linting and detects the syntax error
- THEN the pipeline feeds the error back to Construir for a new generation attempt
- AND if the 3rd attempt still fails, the error is shown to the user: "No se pudo corregir: falta '}' en script.js línea 12"

### Requirement: Phase Boundaries

The pipeline phases SHALL be independent and testable in isolation. Phase transitions MUST happen through typed messages: `{ phase: 'entender' | 'construir' | 'verificar', status: 'in_progress' | 'done' | 'error', data: Record<string, unknown> }`. The pipeline state is NEVER exposed in the UI for MVP.

#### Scenario: Phase transition emits typed message

- GIVEN Entender completes successfully
- WHEN the pipeline transitions to Construir
- THEN a typed message `{ phase: 'construir', status: 'in_progress', data: { plan: [...] } }` is emitted
- AND Zustand stores MAY consume this for internal tracking
- AND the UI layer does NOT render phase information
