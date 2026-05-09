# Brand Copy Specification

## Purpose

Defines the wordmark and naming conventions for all user-facing copy. The brand name is "Vibe Studio" (with space). All legacy "Opita Vibe" and "Vibe-Studio" (hyphenated) strings MUST be replaced.

## Requirements

### Requirement: User-Facing Product Name

All user-facing UI strings MUST display "Vibe Studio". The system MUST NOT render "Opita Vibe" or "Vibe-Studio" anywhere visible to the user.

#### Scenario: Login screen shows correct product name

- GIVEN the app starts and the user is not authenticated
- WHEN the login screen renders
- THEN the heading displays "Vibe Studio"
- AND no text contains "Opita Vibe"

#### Scenario: Streaming indicator shows correct name

- GIVEN the AI is generating a response
- WHEN the streaming indicator is visible
- THEN the label displays "Vibe Studio está escribiendo"
- AND it MUST NOT display "Opita Vibe está escribiendo"

#### Scenario: System prompts identify as Vibe Studio

- GIVEN a pipeline builds the system prompt
- WHEN ENTENDER_BASE or CONSTRUIR_BASE is constructed
- THEN the AI identity string is "Vibe Studio"
- AND it MUST NOT contain "Opita Vibe"

#### Scenario: Mock provider greeting uses correct name

- GIVEN the mock provider generates a greeting
- WHEN the greeting text is returned
- THEN it contains "Vibe Studio"
- AND it MUST NOT contain "Opita Vibe"

### Requirement: Config and Metadata Names

Configuration files SHALL use "Vibe Studio" for human-readable names. The `productName` in `tauri.conf.json` MUST be "Vibe Studio". The `X-Title` HTTP header in OpenRouter requests MUST be "Vibe Studio".

#### Scenario: Tauri window title is Vibe Studio

- GIVEN `tauri.conf.json` is configured
- WHEN the app launches
- THEN `productName` is "Vibe Studio"
- AND the window `title` is "Vibe Studio"

#### Scenario: OpenRouter requests have correct X-Title

- GIVEN an OpenRouter API call is made
- WHEN the HTTP headers are constructed
- THEN `X-Title` is "Vibe Studio"
- AND it MUST NOT be "Vibe-Studio"

### Requirement: Legacy String Removal

The source tree MUST NOT contain any user-facing instance of "Opita Vibe". The string "Vibe-Studio" (hyphenated) MUST NOT appear in user-facing surfaces.

#### Scenario: No Opita Vibe in source files

- GIVEN a full-text search of all source files under `src/`
- WHEN searching for the string "Opita Vibe"
- THEN zero results are returned in user-facing code

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
