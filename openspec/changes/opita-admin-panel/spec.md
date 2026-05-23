# Spec: Acoplamiento Dinámico en Opita Sync (Ops Hub)

## S1: Acoplamiento de Proyectos (`couple_project`)

### S1.1: Carga y Validación de Manifiesto
- **GIVEN** un proyecto del ecosistema (ej. `vibe-studio`) con un archivo `opita-ops.json` válido en su raíz
- **WHEN** el administrador le ordena a Opita Sync: *"Acopla vibe-studio"*
- **THEN** la IA MUST invocar la herramienta de acoplamiento, leer el archivo `opita-ops.json`, validar su estructura
- **AND** MUST registrar el proyecto en el archivo de proyectos activos acoplados (`coupled-projects.json`).

### S1.2: Registro Dinámico de Herramientas
- **GIVEN** que el acoplamiento fue exitoso
- **WHEN** se inicia la siguiente interacción o turno de conversación
- **THEN** el sistema MUST cargar las capacidades (`capabilities`) definidas en el manifiesto e inyectar dinámicamente sus esquemas de parámetros como nuevas `tools` disponibles para el LLM.

---

## S2: Desacoplamiento de Proyectos (`decouple_project`)

### S2.1: Remoción del Registro
- **GIVEN** un proyecto acoplado en el sistema
- **WHEN** el administrador ordena: *"Desacopla vibe-studio"*
- **THEN** la IA MUST invocar la herramienta de desacoplamiento y eliminar el ID del proyecto de `coupled-projects.json`.

### S2.2: Descarga de Herramientas
- **GIVEN** que el desacoplamiento se completó
- **WHEN** se evalúa el prompt del sistema
- **THEN** las `tools` dinámicas del proyecto desacoplado MUST ser removidas del contexto del LLM inmediatamente, previniendo cualquier acceso o ejecución posterior.

---

## S3: Ejecución de Capacidades Gobernadas

### S3.1: Resolución Dinámica de Recursos
- **GIVEN** una instrucción operativa sobre un proyecto (ej: *"lístame los usuarios de vibe-studio"*)
- **WHEN** el LLM decide ejecutar la herramienta asignada a esa capacidad
- **THEN** el motor de ejecución de Opita Sync MUST mapear las tablas y recursos especificados en el manifiesto del proyecto (ej. buscando el parámetro `/opita-account/${stage}/users-table-name` en AWS SSM)
- **AND** realizar la consulta sobre el recurso físico real de stage/producción correspondiente.
