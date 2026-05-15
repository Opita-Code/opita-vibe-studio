# Billing Specification

## Purpose

Gestiona la integración de pagos para conversiones y actualizaciones de planes en Vibe Studio. El sistema MUST utilizar Wompi como pasarela de pagos mediante la estrategia "Purchase Intent" (Intención de Compra) para evitar modales bloqueantes e intrusivos.

## Architecture

- **Pasarela de Pagos**: Wompi Widget (inyección dinámica de `widget.js`).
- **Backend (Firma)**: `packages/vibe-ai-backend/src/api/billing.ts` — `GET /checkout-sign`.
- **Backend (Webhook)**: `packages/vibe-ai-backend/src/api/billing.ts` — `POST /webhook` (actualización de DynamoDB `Users`).
- **Frontend (Intención)**: `src/hooks/usePurchaseIntent.ts` — Estado global para disparadores de compra.
- **Frontend (UI)**: `src/components/usage/WompiModal.tsx` — Modal contenedor del widget.

## Requirements

### Requirement: Generación de Firma Segura

Para inicializar la pasarela Wompi, el sistema MUST generar una firma criptográfica en el backend utilizando `WOMPI_INTEGRITY_SECRET`.

#### Scenario: Requesting checkout signature
- GIVEN a user initiates a purchase intent
- WHEN the `WompiModal` mounts
- THEN the system MUST call `GET /checkout-sign?product=VIBE_PRO&userId=...`
- AND the backend MUST return the `publicKey`, `currency`, `amountInCents`, `reference`, and `signature`
- AND the modal MUST inject the Wompi `<script>` using these attributes.

### Requirement: Purchase Intent Triggers

El sistema MUST interceptar acciones que requieran un plan superior y convertirlas en una intención de compra (`purchase_intent`), previniendo errores duros.

#### Scenario: Locked Pro Model Selection
- GIVEN the user is on the Free or Estudiante plan
- WHEN the user selects `Opita Reasoner` (Pro model)
- THEN the system MUST NOT throw an error
- AND the system MUST call `setIntent('pro_model')`
- AND the `AuraNudgeBar` MUST display an upgrade prompt.

#### Scenario: Large File Upload Attempt
- GIVEN the user is on the Free or Estudiante plan
- WHEN the user attempts to attach a file larger than 5MB
- THEN the system MUST NOT upload the file
- AND the system MUST call `setIntent('large_file')`
- AND the `AuraNudgeBar` MUST display an upgrade prompt.

### Requirement: Webhook Synchronization

El backend MUST procesar los webhooks de Wompi para actualizar el plan del usuario de forma asíncrona tras un pago exitoso.

#### Scenario: Successful Payment Webhook
- GIVEN a successful transaction on Wompi
- WHEN Wompi sends a `POST /webhook` with the event data
- THEN the backend MUST validate the event signature using `WOMPI_WEBHOOK_SECRET`
- AND upon valid signature, the system MUST update the `plan` attribute in the DynamoDB `Users` table to `pro` (or the purchased tier)
- AND the backend SHALL return a `200 OK` response.

## Files

- `packages/vibe-ai-backend/src/api/billing.ts` — Endpoints `/checkout-sign` y `/webhook`.
- `src/hooks/usePurchaseIntent.ts` — Lógica de triggers.
- `src/components/chat/AuraNudgeBar.tsx` — Notificaciones contextuales de intención.
- `src/components/usage/WompiModal.tsx` — Contenedor del widget de Wompi.
