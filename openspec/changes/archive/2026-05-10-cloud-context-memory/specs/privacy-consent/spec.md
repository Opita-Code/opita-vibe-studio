# privacy-consent Specification

## Purpose

GDPR-compliant consent management. Users must opt in before any metadata collection occurs. Privacy policy accessible from the app. Users can view, export, and delete their collected data.

## Requirements

### Requirement: GDPR Opt-In

The system MUST NOT collect any usage metadata until the user explicitly opts in via the Privacy settings toggle. Default state SHALL be opt-out (consent OFF).

#### Scenario: First launch — zero collection

- GIVEN new user or existing user who has not opted in
- WHEN the app runs
- THEN zero usage events are sent to Supabase
- AND `cloud_context` table has no rows for this user's `user_id`

#### Scenario: User opts in

- GIVEN authenticated user in Settings > Privacidad
- WHEN user toggles "Compartir datos de uso" to ON
- THEN consent is recorded in Supabase
- AND future usage events begin syncing to `cloud_context`

#### Scenario: User opts out later

- GIVEN authenticated user previously opted in with collected data
- WHEN user toggles consent to OFF
- THEN collection stops immediately
- AND previously collected data remains (deletable via separate action)

### Requirement: Privacy Policy Access

A privacy policy page MUST be accessible from Settings > Privacidad and during onboarding. The policy SHALL be linked from the app footer.

#### Scenario: Access privacy policy from settings

- GIVEN Settings > Privacidad tab is open
- WHEN user clicks "Política de Privacidad"
- THEN the privacy policy opens in the system browser (or in-app if rendered locally)

### Requirement: Data Export

Authenticated users MUST be able to export all their cloud-stored data as a downloadable JSON file.

#### Scenario: Export collected data

- GIVEN authenticated user with collected data in `cloud_context`
- WHEN user clicks "Exportar mis datos" in Settings > Privacidad
- THEN a JSON file downloads containing all `cloud_context` rows for their `user_id`

### Requirement: Data Deletion

Authenticated users MUST be able to request deletion of all their cloud-stored data. Deletion SHALL require explicit confirmation before execution.

#### Scenario: Delete all data with confirmation

- GIVEN authenticated user in Settings > Privacidad
- WHEN user clicks "Eliminar mis datos"
- THEN a confirmation dialog appears
- AND on confirm, all `cloud_context` rows for this `user_id` are deleted from Supabase
- AND confirmation message "Tus datos fueron eliminados" is shown
