# Automated AWS Dev Stage & E2E Testing Strategy Refinement

Refine the staging deployment and testing strategy for Vibe Studio. This plan establishes a dedicated AWS `dev` stage backend, restructures the CI/CD workflows on GitHub to isolate `dev` (continuous on main push) and `prod` (tag-based), guards manual deploys with local tests, adds direct E2E test commands, and eliminates security risks related to hardcoded E2E credentials.

## User Review Required

> [!IMPORTANT]
> **Separation of Concerns for Pushes to `main`**:
> Currently, pushing to the `main` branch deploys directly to production for the web app (`deploy-web-app.yml`). Under this refined architecture, pushes to `main` will instead automatically deploy to the **Staging / Dev** environment (`dev.opitacode.com` and `dev` backend stack), and production deployments will be triggered **strictly by tag pushes** (`web/v*` and `backend/v*`). This ensures a solid, safe staging gate.

> [!WARNING]
> **Cognito Credentials Protection**:
> We will remove the hardcoded E2E test password from `tests/e2e/global-setup.ts` and read it from `process.env.TEST_E2E_PASSWORD`. To prevent breaking local developer tests, we will provide a safe local fallback to the default password, but CI will require the password to be set via a secure GitHub Secret.

---

## Open Questions

- *No open questions at this time.*

---

## Proposed Changes

### Scripts & Local Configuration

#### [MODIFY] [deploy-web.ps1](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/scripts/deploy-web.ps1)
- Add verification gate running unit tests (`npm run test`) and local E2E tests (`npx playwright test --project=chromium`) before triggering the build.
- Implement a `-SkipTests` switch to allow bypassing this gate for emergency manual hotfixes.

#### [MODIFY] [package.json](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/package.json)
- Add E2E testing scripts:
  - `"test:e2e": "playwright test --project=chromium"` (Runs E2E locally using headless chromium and automated local dev server start)
  - `"test:e2e:staging": "playwright test --project=staging"` (Runs E2E against the `https://dev.opitacode.com` staging environment)
  - `"test:e2e:prod": "playwright test --project=production"` (Runs E2E against the `https://vibe.opitacode.com` production environment)

---

### E2E Test Authentication

#### [MODIFY] [global-setup.ts](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/tests/e2e/global-setup.ts)
- Refactor to load the password dynamically from the environment `process.env.TEST_E2E_PASSWORD`.
- Keep a local string fallback to the existing password for developer convenience so local E2E commands continue to work out of the box.

---

### CI/CD Workflows Restructuring

#### [NEW] [ci.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/ci.yml)
- Create a PR / push integration pipeline:
  - Trigger: every Pull Request to `main`, and push to `main`.
  - Runs frontend typechecking (`npm run typecheck`), unit tests (`npm run test`), backend typechecking, and local E2E tests (`npx playwright test --project=chromium`).

#### [DELETE] [deploy-backend.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/deploy-backend.yml)
- Remove the legacy monolith backend deploy.

#### [NEW] [deploy-backend-prod.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/deploy-backend-prod.yml)
- Deploy backend to production:
  - Trigger: push of tags `backend/v*` or manual trigger.
  - Command: `npx sst deploy --stage prod`.
  - Runs post-deploy health check against production base URL (`https://api.opitacode.com`).

#### [NEW] [deploy-backend-dev.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/deploy-backend-dev.yml)
- Deploy backend to dev stage:
  - Trigger: push to `main` (filtered by paths: `packages/vibe-ai-backend/**`, `sst.config.ts`, or the workflow file itself) or manual trigger.
  - Command: `npx sst deploy --stage dev`.
  - Runs post-deploy health check against dev base URL (`https://api-dev.opitacode.com`).

#### [DELETE] [deploy-web-app.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/deploy-web-app.yml)
- Remove the legacy web app deploy which mixed staging and production environments.

#### [NEW] [deploy-web-app-prod.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/deploy-web-app-prod.yml)
- Deploy frontend web app to production:
  - Trigger: push of tags `web/v*` or manual trigger.
  - Target S3: `s3://vibe-landing-728741135483/app/`.
  - CloudFront Distribution: `EONGVOV3BDAVI`.

#### [NEW] [deploy-web-app-dev.yml](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/.github/workflows/deploy-web-app-dev.yml)
- Deploy frontend web app to staging:
  - Trigger: push to `main` (filtered by frontend paths) or manual trigger.
  - Command: `npx vite build --mode staging` (configures frontend to target dev Lambda URLs).
  - Target S3: `s3://dev.opitacode.com/app/`.
  - CloudFront Distribution: `EHQLGHNKD091K`.

---

## Verification Plan

### Automated Tests
- Validate local E2E test runs with the new script:
  `npm run test:e2e`
- Run local typechecking and unit tests to ensure no regressions:
  `npm run typecheck && npm run test`

### Manual Verification
- Review generated GitHub action files locally or via dry run.
- Prompt the user to push to `main` and verify that the dev backend and frontend deploy automatically to staging, followed by running the tests.
