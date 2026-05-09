# Test Branding Specification

## Purpose

Defines test assertion updates required to match the new Vibe Studio branding. All tests referencing legacy "Opita Vibe" strings or asserting old brand patterns MUST be updated.

## Requirements

### Requirement: Test String Assertions Updated

All test assertions referencing "Opita Vibe" MUST be updated to "Vibe Studio". Tests asserting the old "OV" logo placeholder SHALL be updated to assert the new brand symbol. `npm test` MUST pass with zero failures after branding changes.

#### Scenario: Pipeline test asserts Vibe Studio in system prompt

- GIVEN the pipeline test runs
- WHEN `pipeline.test.ts` asserts system prompt identity
- THEN `expect(msgs[0].content).toContain("Vibe Studio")` passes
- AND it MUST NOT assert "Opita Vibe"

#### Scenario: Mock provider test asserts Vibe Studio greeting

- GIVEN the mock provider test runs
- WHEN `mock.test.ts` asserts the greeting text
- THEN the assertion expects "Vibe Studio"
- AND it MUST NOT expect "Opita Vibe"

#### Scenario: Login screen test asserts Vibe Studio name and symbol

- GIVEN the login screen test runs
- WHEN `LoginScreen.test.tsx` asserts product identity
- THEN `screen.getByText("Vibe Studio")` finds the heading
- AND the test asserts the brand symbol SVG is rendered
- AND it MUST NOT assert "Opita Vibe" or the "OV" placeholder

#### Scenario: OpenRouter test asserts updated X-Title header

- GIVEN the OpenRouter test runs
- WHEN `openrouter.test.ts` asserts HTTP headers
- THEN the `X-Title` header value is "Vibe Studio"
- AND it MUST NOT be "Vibe-Studio"

### Requirement: Full Test Suite Passes

After all branding changes are applied, the full test suite MUST pass. Zero test files SHALL fail due to branding string mismatches.

#### Scenario: npm test passes after branding update

- GIVEN all source files and test files are updated with new branding
- WHEN `npm test` is executed
- THEN all tests pass with zero failures
- AND zero tests fail due to "Opita Vibe" or "Vibe-Studio" string mismatches
