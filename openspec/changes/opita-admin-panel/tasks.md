# Tasks: Acoplamiento Dinámico en Opita Sync (Ops Hub)

## Review Workload Forecast
- **Estimated changed lines**: ~700 across 3 PRs
- **400-line budget risk**: Low (each PR < 300 lines)
- **Chained PRs recommended**: Yes (3 PRs)
- **Decision needed before apply**: No (auto-chain cached)

---

## PR 1: Manifiestos de Proyectos y Gestor de Registro (~200 líneas)

### T1.1: Manifiesto opita-ops.json en vibe-studio
- **File**: `vibe-studio/opita-ops.json` [NEW]
- **Action**: Crear el manifiesto inicial autodescribiendo las tablas de DynamoDB y capacidades básicas (list_users, update_user_plan) del proyecto Vibe Studio.

### T1.2: Manager de Registro en opita-sync
- **File**: `opita-sync/packages/opita-office-sandbox/src/registry.ts` [NEW]
- **Action**: Implementar funciones de lectura/escritura sobre el registro `coupled-projects.json` para acoplar y desacoplar directorios de proyectos.

---

## PR 2: Carga e Inyección Dinámica de Herramientas AI (~250 líneas)

### T2.1: Lógica de Inyección en admin.ts (vibe-ai-backend)
- **File**: `vibe-studio/packages/vibe-ai-backend/src/api/admin.ts`
- **Action**: Modificar `getAdminTools` para que cargue los manifiestos de los proyectos acoplados e inyecte dinámicamente sus capacidades en el objeto de herramientas de Vercel AI SDK.

### T2.2: Parseador de Esquemas JSON a Zod
- **File**: `vibe-studio/packages/vibe-ai-backend/src/api/admin.ts`
- **Action**: Crear una función utilitaria para parsear los esquemas de parámetros del manifiesto en validaciones compatibles con Vercel AI SDK en tiempo de ejecución.

---

## PR 3: Ejecutor de Capacidades y Resolución de AWS (~250 líneas)

### T3.1: Ejecutor Gobernado executeGovernedCapability
- **File**: `vibe-studio/packages/vibe-ai-backend/src/api/admin.ts`
- **Action**: Implementar el enrutador de ejecución que resuelva los recursos dinámicos (tablas DynamoDB en SSM) y ejecute comandos sobre AWS según el proyecto objetivo.

### T3.2: Suite de Pruebas Unitarias
- **File**: `vibe-sync-testing` / `vibe-studio/packages/vibe-ai-backend/src/api/__tests__/admin-dynamic.test.ts` [NEW]
- **Action**: Escribir pruebas unitarias que validen:
  - El correcto acoplamiento/desacoplamiento de un proyecto mock.
  - La resolución correcta de tablas DynamoDB basadas en SSM y Stage.
  - La denegación de ejecución de capacidades cuando el proyecto es desacoplado.

---

## Dependency Graph
```
T1.1 (manifest) ──┬── T1.2 (registry manager)
                  └── T2.1 (dynamic injection logic) ── T2.2 (json-to-zod parser)
                                                       └── T3.1 (dynamic AWS executor) ── T3.2 (unit tests)
```
