# Centralized Multi-Project Operations Hub (Opita Sync Coupling Architecture)

## Goal Description
Rediseñar el panel de administración para consolidarlo dentro del ecosistema de **Opita Sync** como un centro de control y gobernanza unificado (AI Ops Hub). La inteligencia artificial de Opita Sync podrá interactuar, configurar e inspeccionar múltiples aplicaciones independientes (Vibe Studio, Opita Trabajos, etc.) de manera dinámica. 

Para lograr esto, diseñamos una arquitectura basada en microkernel con **manifiestos de operación auto-describibles**, estandarizando el proceso de acoplar y desacoplar proyectos sin alterar el núcleo de Opita Sync.

---

## User Review Required

> [!IMPORTANT]
> **Definición del Manifiesto (`opita-ops.json`)**:
> Cada aplicación del ecosistema Opita Code (ej: `vibe-studio`, `opita-trabajos`) expondrá un archivo de manifiesto estándar en su raíz que declare sus recursos en la nube y las capacidades de administración permitidas para que Opita Sync las consuma de manera dinámica.

> [!WARNING]
> **Permisos de AWS IAM**:
> Al acoplar dinámicamente bases de datos, el rol de la Lambda de Opita Sync necesitará permisos comodín sobre recursos específicos (ej. `arn:aws:dynamodb:*:*:table/Users-*`) o resolver los permisos a través de asunción de roles cruzados (Cross-Account IAM Roles) si los proyectos viven en cuentas de AWS distintas.

---

## Open Questions

- *No open questions at this time.*

---

## Proposed Changes

### Core Integration / Specifications

#### [MODIFY] [spec.md](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/openspec/changes/opita-admin-panel/spec.md)
- Modificar las especificaciones para definir las reglas GIVEN-WHEN-THEN del proceso de acoplamiento (`couple_project` y `decouple_project`) y la carga dinámica de capacidades en el chat de operaciones.

#### [MODIFY] [design.md](file:///C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio/openspec/changes/opita-admin-panel/design.md)
- Actualizar el diseño para estructurar el formato del manifiesto `opita-ops.json` y el flujo de inyección dinámica de herramientas en la SDK de Vercel AI en `opita-sync`.

---

## Verification Plan

### Automated Tests
- Validar el test de carga del registro de proyectos:
  `npm run test:registry`
- Correr la suite de pruebas unitarias sobre el inyector dinámico de herramientas:
  `npm run test:tools`

### Manual Verification
- Solicitar al operador que envíe los comandos:
  - *"Acopla vibe-studio"* (debe leer el manifiesto y registrar las herramientas del proyecto).
  - *"Lístame los usuarios de vibe-studio"* (debe consultar la tabla de DynamoDB asignada en el manifiesto).
  - *"Desacopla vibe-studio"* (debe desvincular el acceso y deshabilitar los comandos del proyecto).
