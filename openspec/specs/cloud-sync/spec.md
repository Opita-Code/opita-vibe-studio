# Cloud Sync Specification

## Purpose

Gestiona la sincronización en la nube de los proyectos de Vibe Studio. El sistema MUST permitir el respaldo (backup) y la recuperación de proyectos entre dispositivos para usuarios autenticados, utilizando AWS S3 para almacenamiento y DynamoDB para metadatos.

## Architecture

- **Almacenamiento**: AWS S3 (`vibe-studio-projects` bucket).
- **Backend**: `packages/vibe-ai-backend/src/api/storage.ts` — Endpoints para URLs prefirmadas.
- **Frontend**: `src/components/cloud/CloudSyncPanel.tsx` — Interfaz de usuario para sincronización.
- **Store**: `src/stores/cloud.ts` — Estado de sincronización (último backup, estado de red).
- **Límite de Tamaño**: Bloqueo dinámico por plan (5MB Free, 50MB Estudiante, 500MB Pro).

## Requirements

### Requirement: URLs Prefirmadas para Upload/Download

Para evitar sobrecargar el backend, la transferencia de archivos pesados (archivos de proyecto o imágenes) MUST realizarse directamente entre el cliente (frontend) y S3 utilizando URLs prefirmadas generadas por el backend.

#### Scenario: Requesting upload URL
- GIVEN an authenticated user wants to upload an attachment
- WHEN the client calls `POST /storage/presign`
- THEN the backend MUST validate the user's token and plan limits
- AND the backend SHALL generate an S3 presigned PUT URL
- AND the client MUST upload the file directly to S3 using the provided URL.

### Requirement: Cuotas y Límites de Almacenamiento

El sistema MUST hacer cumplir los límites de almacenamiento por proyecto y por archivo según el plan del usuario (definido en Cognito).

#### Scenario: Enforcing storage limits
- GIVEN a user on the Free plan attempts to upload a 6MB file
- WHEN the client calculates the file size
- THEN the client MUST block the upload before requesting the presigned URL
- AND the system MUST trigger the `large_file` purchase intent to suggest upgrading to Vibe Pro.

### Requirement: Respaldo de Proyecto (Backup)

Los usuarios autenticados MUST poder respaldar el estado actual de su proyecto en la nube.

#### Scenario: Project backup
- GIVEN an authenticated user with an open project
- WHEN the user clicks "Sincronizar en la Nube"
- THEN the system MUST compress the project state
- AND request a presigned PUT URL for `project_backup.zip`
- AND upload the archive to S3
- AND the system SHALL update the `lastSyncDate` in the CloudStore.

### Requirement: Indicadores de Sincronización

La interfaz MUST proveer feedback visual continuo sobre el estado de la conexión en la nube.

#### Scenario: Displaying sync status
- GIVEN the CloudSyncPanel is active
- WHEN an upload or download is in progress
- THEN the system MUST display a loading spinner and progress indicator
- AND upon completion, the system SHALL show a "Sincronizado" success mark with a timestamp.

## Files

- `src/stores/cloud.ts` — Estado de conexión y última sincronización.
- `src/components/cloud/CloudSyncPanel.tsx` — Panel lateral de sincronización.
- `packages/vibe-ai-backend/src/api/storage.ts` — Lógica de URLs prefirmadas.
- `sst.config.ts` — Definición de recursos AWS S3.
