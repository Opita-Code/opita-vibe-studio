# Code Polish Specification

## Purpose

Remove production debug noise, eliminate unused code, and enforce strict TypeScript typing in source files. Tests are exempt from `any`-type restrictions.

## Requirements

### Requirement: Production Debug Cleanup

Source files MUST NOT contain `console.log` statements in production code paths. `console.warn` and `console.error` are acceptable for operational logging and error paths.

#### Scenario: No debug logs in source files

- GIVEN the linter runs on `src/`
- WHEN scanning for `console.log` calls
- THEN zero `console.log` statements exist in production source files
- AND informational token-usage messages use an appropriate logging level or are removed

#### Scenario: Operational warnings are preserved

- GIVEN a provider failover or session-persist warning
- WHEN the warning logic executes
- THEN `console.warn` calls remain untouched
- AND error-boundary `console.error` calls remain untouched

### Requirement: Unused Import Removal

Source files MUST NOT import modules, types, or values that are never referenced in the file. Dead code (unreachable branches, unused variables) MUST be removed.

#### Scenario: Linter passes with no unused-import warnings

- GIVEN `npm run lint` executes
- WHEN ESLint checks all source files
- THEN zero `no-unused-vars` or `unused-imports/no-unused-imports` errors exist
- AND all imports in each file are referenced at least once

### Requirement: No `any` Types in Source

Source files under `src/` MUST NOT use the `any` type annotation. Use `unknown`, proper interfaces, generics, or type assertions instead. Test files under `tests/` are exempt from this restriction.

#### Scenario: TypeScript compiles with no explicit any

- GIVEN `tsc --noEmit` runs
- WHEN type-checking all source files
- THEN no `any` type appears in `src/` files
- AND ESLint `@typescript-eslint/no-explicit-any` reports zero errors
- AND test files may use `any` for mock objects without violation
