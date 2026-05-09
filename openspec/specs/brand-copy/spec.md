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
