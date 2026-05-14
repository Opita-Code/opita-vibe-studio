# Delta for Settings Panel

## ADDED Requirements

### Requirement: Privacy Controls Tab

The settings panel MUST include a "Privacidad" tab alongside the existing BYOK, Plan, and Tokens tabs. This tab SHALL host GDPR consent toggles, data export, and data deletion controls. The Privacidad tab MUST only be visible and accessible to authenticated users; it SHALL be hidden for guest users.

#### Scenario: Privacy tab visible for authenticated users

- GIVEN the Settings panel is open and the user is authenticated via Supabase Auth
- WHEN the tab bar renders
- THEN "Privacidad" is displayed as the fourth tab, following BYOK, Plan, and Tokens

#### Scenario: Privacy tab hidden for guest users

- GIVEN the Settings panel is open and the user is in guest mode (no Supabase session)
- WHEN the tab bar renders
- THEN "Privacidad" tab is NOT visible in the tab bar

### Requirement: GDPR Consent Toggle

The Privacidad tab MUST include a toggle switch labeled "Compartir datos de uso" for usage data sharing consent. Default state SHALL be OFF (opt-out). Toggling MUST immediately persist the consent state to Supabase.

#### Scenario: User opts in to data sharing

- GIVEN authenticated user in Settings > Privacidad with consent toggle OFF
- WHEN user toggles "Compartir datos de uso" to ON
- THEN consent state is persisted to Supabase as `consent: true` for the user
- AND usage event collection begins

#### Scenario: User opts out of data sharing

- GIVEN authenticated user with consent toggle ON and active data collection
- WHEN user toggles "Compartir datos de uso" to OFF
- THEN consent state is updated to `consent: false` in Supabase
- AND usage event collection stops immediately

### Requirement: Data Export Control

The Privacidad tab MUST include a button labeled "Exportar mis datos" that downloads all cloud-stored data for the authenticated user as a JSON file.

#### Scenario: Export collected data to JSON

- GIVEN authenticated user in Settings > Privacidad with collected data in Supabase
- WHEN user clicks "Exportar mis datos"
- THEN a JSON file is downloaded containing all `cloud_context` rows for the user's `user_id`

### Requirement: Data Deletion Control

The Privacidad tab MUST include a button labeled "Eliminar mis datos" with a confirmation dialog. On confirmation, all cloud-stored data for the authenticated user SHALL be permanently deleted from Supabase.

#### Scenario: Delete all data with confirmation

- GIVEN authenticated user in Settings > Privacidad
- WHEN user clicks "Eliminar mis datos"
- THEN a confirmation dialog appears asking "¿Estás seguro? Esta acción no se puede deshacer."
- AND on confirm, all `cloud_context` rows for this `user_id` are deleted from Supabase
- AND a success message "Tus datos fueron eliminados" is displayed
