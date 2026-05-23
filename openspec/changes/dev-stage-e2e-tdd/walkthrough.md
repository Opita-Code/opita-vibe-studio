# Walkthrough - AWS Dev Stage & E2E Testing Strategy

Hemos implementado y refinado la estrategia de despliegue y pruebas de integración para Vibe Studio, alineando el proyecto con las mejores prácticas arquitectónicas de Opita Code.

## Cambios Realizados

### 1. Estructura de Pipelines CI/CD Aislados
Reestructuramos completamente las acciones de GitHub en `.github/workflows/` para separar los despliegues de desarrollo/staging de los de producción y añadir chequeos automáticos de calidad en cada PR:
- **`ci.yml` (Nuevo)**: Se ejecuta en cada Pull Request y push a `main`. Realiza chequeos de tipos (`typecheck`), pruebas unitarias (`npm run test`) y ejecuta las pruebas E2E locales con Playwright (`npx playwright test --project=chromium`).
- **`deploy-backend-dev.yml` (Nuevo)**: Despliega automáticamente las Lambdas e infraestructura al stage `dev` en AWS (`npx sst deploy --stage dev`) en cada push a `main` que modifique el backend. Realiza una verificación de salud contra `api-dev.opitacode.com`.
- **`deploy-backend-prod.yml` (Nuevo)**: Despliega al stage `prod` de AWS únicamente cuando se empuja un tag `backend/v*`.
- **`deploy-web-app-dev.yml` (Nuevo)**: Construye en modo staging (`npx vite build --mode staging`) y despliega el frontend al bucket de staging `dev.opitacode.com` bajo la ruta `/app/` en cada push a `main` que altere el frontend.
- **`deploy-web-app-prod.yml` (Nuevo)**: Construye en modo producción (`npm run build`) y despliega al bucket de producción (`vibe-landing-728741135483/app/`) únicamente al empujar tags `web/v*`.

### 2. Comandos de Prueba Playwright en `package.json`
Añadimos accesos directos para facilitar la ejecución y el TDD/debugging de pruebas de integración:
- `npm run test:e2e`: Ejecuta las pruebas locales con Chromium.
- `npm run test:e2e:staging`: Ejecuta las pruebas apuntando a `https://dev.opitacode.com`.
- `npm run test:e2e:prod`: Ejecuta las pruebas de humo contra el entorno de producción vivo `https://vibe.opitacode.com`.

### 3. Salvaguarda de Seguridad y Verificación en Manual Deploys
- **`global-setup.ts`**: Eliminamos la contraseña hardcodeada del usuario de pruebas Cognito, reemplazándola por `process.env.TEST_E2E_PASSWORD` con un fallback seguro para desarrollo local.
- **`deploy-web.ps1`**: Refactorizamos el script de despliegue manual para exigir que las pruebas unitarias y de Playwright locales pasen exitosamente antes de compilar y sincronizar con S3. Agregamos el switch `-SkipTests` para situaciones de emergencia justificada.

## Resultados de Pruebas y Validación

- **Chequeo de Tipos**: Las validaciones frontend (`npm run typecheck`) y backend (`npm run typecheck` en packages) pasaron exitosamente.
- **Pruebas Unitarias**: La suite completa de Vitest pasó de forma limpia (1287 pruebas exitosas).
- **Pruebas E2E**: Ejecutamos las pruebas locales de Playwright comprobando que el flujo de invitado, vistas, settings y barras de herramientas cargan y validan correctamente.
