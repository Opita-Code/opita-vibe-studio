# Checklist for Staging Stage & E2E Testing Strategy

## Phase 1: Local Scripts & Configuration
- [x] Add Playwright E2E npm scripts to `package.json` (`test:e2e`, `test:e2e:staging`, `test:e2e:prod`).
- [x] Refactor `scripts/deploy-web.ps1` to verify unit and local E2E tests before deploying, adding the `-SkipTests` switch.
- [x] Refactor `tests/e2e/global-setup.ts` to read the Cognito E2E password from `process.env.TEST_E2E_PASSWORD` with a local fallback.

## Phase 2: Restructuring GitHub CI/CD Pipelines
- [x] Create `.github/workflows/ci.yml` to run typecheck, unit, and local E2E tests on PRs and pushes to `main`.
- [x] Remove legacy `.github/workflows/deploy-backend.yml` and `.github/workflows/deploy-web-app.yml`.
- [x] Create `.github/workflows/deploy-backend-dev.yml` (stage: dev, continuous on main backend changes).
- [x] Create `.github/workflows/deploy-backend-prod.yml` (stage: prod, tag-based).
- [x] Create `.github/workflows/deploy-web-app-dev.yml` (stage: dev, continuous on main frontend changes).
- [x] Create `.github/workflows/deploy-web-app-prod.yml` (stage: prod, tag-based).

## Phase 3: Local Verification & Commits
- [x] Verify local tests run cleanly with `npm run test` and `npm run test:e2e`.
- [x] Commit all changes following conventional commit naming rules (`tipo(scope): descripción` in Spanish).
