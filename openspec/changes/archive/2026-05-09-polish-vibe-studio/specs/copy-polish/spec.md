# Copy Polish Specification

## Purpose

Ensure all user-facing copy and system prompts use Colombian-neutral Spanish — no Argentine voseo — and that the product name "Vibe Studio" is used consistently everywhere.

## Requirements

### Requirement: Colombian-Neutral Spanish

All user-facing strings, system prompts, tooltips, and placeholder text MUST use Colombian-neutral Spanish. Argentine voseo forms (Sos, Usá, tenés, hacé, Podés, Escribí, querés, Abrí) MUST NOT appear anywhere.

#### Scenario: No voseo in UI text

- GIVEN any component renders user-facing text
- WHEN the text contains a verb in second person
- THEN it uses "Escribe" (not "Escribí"), "Abre" (not "Abrí"), "Puedes" (not "Podés")
- AND no form of voseo conjugation is present

#### Scenario: No voseo in system prompts

- GIVEN the pipeline constructs the AI system prompt
- WHEN the identity instruction is built
- THEN the prompt uses "Eres Vibe Studio" (not "Sos Vibe Studio")
- AND all instruction verbs use Colombian/neutral forms (e.g., "Usa" not "Usá")

#### Scenario: No voseo in placeholder text

- GIVEN ChatInput renders its placeholder
- WHEN the input is empty
- THEN the placeholder reads "Escribe en español lo que quieres crear…" (not "Escribí…")

### Requirement: Consistent Product Naming

The product name "Vibe Studio" MUST be the sole name used in all UI surfaces, window titles, HTTP headers, system prompts, and provider configuration. "Vibe-Studio" (hyphenated) and "Opita Vibe" MUST NOT appear.

#### Scenario: Product name is always "Vibe Studio"

- GIVEN any user-facing surface or system configuration
- WHEN the product name is displayed or transmitted
- THEN the exact string "Vibe Studio" is used
- AND no instance of "Vibe-Studio" or "Opita Vibe" exists
