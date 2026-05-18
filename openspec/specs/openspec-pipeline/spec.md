# OpenSpec Pipeline Specification

## Purpose

Three-phase pipeline engine (Entender → Construir → Verificar) that transforms user prompts into code artifacts. The pipeline runs invisibly — the user only sees result artifacts. Includes Vibe Pro Engine (subagent mode) for paid plans and intelligent intent detection.

## Architecture

- **Engine**: `src/pipeline/engine.ts` — State machine orchestrating the 3 phases with retry loop.
- **Phases**:
  - `src/pipeline/entender.ts` — Parse intent, generate file plan.
  - `src/pipeline/construir.ts` — Generate code files from plan.
  - `src/pipeline/verificar.ts` — Validate output against requirements.
- **Prompts**: `src/pipeline/prompts.ts` — System prompts for each phase.
- **Types**: `src/pipeline/types.ts` — PipelineEvent, PipelinePhase, FileOutput, ConstruirOutput.
- **Modes**: `src/modes/index.ts` — Execution mode system.

## Pipeline Flow

```
User Message → detectCodeRequest()
  → [YES] runPipeline()
    → Entender: parse intent, generate file plan
      → [interactive mode] phase_confirm → wait for user OK
    → [Pro/Estudiante + subagent] Subagente Autónomo
      → routeRequest(action: "subagent") → tool execution loop (max 15 iterations)
    → [else] Construir: generate code, write files
      → Verificar: validate output
        → [error, retries < 3] → loop back to Construir
        → [error, retries >= 3] → surface error to user
        → [ok] → emit result
  → [NO] fallback to agent chat
```

## Requirements

### Requirement: Code Request Detection

`detectCodeRequest(text, hasProjectOpen)` MUST detect when a user prompt requires the pipeline (vs. a simple chat response).

#### Scenario: Pipeline activation
- GIVEN the user sends "Crear una landing page con 3 secciones"
- WHEN `detectCodeRequest()` evaluates the message
- THEN it MUST return `true` because it contains action ("crear") AND object ("landing page") keywords.

#### Scenario: Question bypasses pipeline
- GIVEN the user sends "¿Qué es React?"
- WHEN `detectCodeRequest()` evaluates the message
- THEN it MUST return `false` because it matches question patterns.

#### Scenario: Conversational intent bypasses pipeline
- GIVEN the user sends "Muéstrame cómo se hace un login"
- WHEN `detectCodeRequest()` evaluates the message
- THEN it MUST return `false` because it matches conversational intent patterns ("muéstrame").

### Requirement: Three-Phase Pipeline

The engine MUST implement: Entender (plan) → Construir (code) → Verificar (validate).

#### Scenario: Full pipeline execution
- GIVEN the user sends "Quiero una página de portafolio con 3 secciones"
- WHEN the pipeline processes the prompt
- THEN Entender generates a file plan (invisible)
- AND Construir generates code files and writes them to disk via `tryWriteFiles()`
- AND Verificar checks the output
- AND the user sees code in editor + files created.

### Requirement: Error Loopback

If Verificar detects an error, the pipeline SHALL loop back to Construir with the error context. Maximum `MAX_VERIFY_RETRIES` (3) attempts.

#### Scenario: Retry on verification failure
- GIVEN Construir generated code with errors
- WHEN Verificar reports status `"error"` with reason
- THEN the pipeline MUST re-run Construir with `"Correcciones necesarias: {reason}"`
- AND emit `{ type: "retry", attempt, reason }`
- AND after 3 failures, surface the error and show the last generated code.

### Requirement: Interactive Mode Plan Confirmation

In interactive mode, after Entender generates a plan, the pipeline MUST pause and wait for user confirmation before proceeding.

#### Scenario: Plan confirmation
- GIVEN `executionMode === "interactive"` and Entender produced a plan different from the original message
- WHEN the plan is ready
- THEN the pipeline MUST emit `{ type: "phase_confirm" }` and set `pendingConfirmation` in the store
- AND poll every 200ms until confirmation or cancellation.

### Requirement: Vibe Pro Engine (Subagent Mode)

For Pro and Estudiante users with `useSubagent` enabled, the pipeline MUST use autonomous subagent mode instead of the standard 3-phase pipeline.

#### Scenario: Subagent execution
- GIVEN plan is `"pro"` or `"estudiante"` and `useSubagent` is enabled
- WHEN the pipeline runs
- THEN it MUST route via `routeRequest(action: "subagent", subagentId: "sdd-apply")`
- AND run a tool execution loop (max 15 iterations)
- AND execute tools locally via `executeTool()`
- AND stream content to the UI via `{ type: "subagent_stream" }` events.

### Requirement: Delivery Estimation

After Construir generates files, if total lines exceed `DELIVERY_LINE_THRESHOLD`, the pipeline MUST emit `{ type: "delivery_estimate", suggestSplit: true }`.

### Requirement: VibeLens Preview Integration

If the generated code contains `<vibe-action type="preview-component" value="..."/>` and VibeLens is enabled, the pipeline MUST set the preview target automatically.

## Files

- `src/pipeline/engine.ts` — Pipeline state machine, `runPipeline()`, `detectCodeRequest()`.
- `src/pipeline/entender.ts` — Intent parsing, file plan generation.
- `src/pipeline/construir.ts` — Code generation, response parsing.
- `src/pipeline/verificar.ts` — Output validation.
- `src/pipeline/prompts.ts` — Phase-specific system prompts.
- `src/pipeline/types.ts` — PipelineEvent, PipelinePhase, FileOutput.
- `src/modes/index.ts` — Execution mode definitions and configuration.
