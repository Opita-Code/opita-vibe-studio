# Billing Specification

## Purpose

Gestiona la integración de pagos (Wompi), trials de 7 días, y el ciclo de vida de suscripciones para Vibe Studio. Usa la estrategia "Purchase Intent" para conversiones no intrusivas y auto-expiration via EventBridge cron.

## Architecture

- **Pasarela de Pagos**: Wompi Widget (inyección dinámica de `widget.js`).
- **Backend (Firma)**: `packages/vibe-ai-backend/src/api/billing.ts` — `GET /checkout-sign`.
- **Backend (Webhook)**: `packages/vibe-ai-backend/src/api/billing.ts` — `POST /webhook`.
- **Frontend (Intención)**: `src/hooks/usePurchaseIntent.ts` — Estado global para disparadores de compra.
- **Frontend (UI)**: `src/components/usage/WompiModal.tsx` — Modal contenedor del widget.
- **Auto-Expiration**: EventBridge cron + Lambda (daily scan of expired trials/subscriptions).

## Requirements

### Requirement: Generación de Firma Segura

Para inicializar la pasarela Wompi, el sistema MUST generar una firma criptográfica en el backend utilizando `WOMPI_INTEGRITY_SECRET`.

#### Scenario: Requesting checkout signature
- GIVEN a user initiates a purchase intent
- WHEN `GET /billing/checkout-sign?product=VIBE_PRO&userId=...` is called
- THEN the backend MUST return `{ publicKey, currency, amountInCents, reference, signature }`.

### Requirement: Purchase Intent Triggers

El sistema MUST interceptar acciones que requieran un plan superior y convertirlas en una intención de compra.

#### Scenario: Locked Pro Model Selection
- GIVEN the user is on Free or Estudiante plan
- WHEN the user selects a Pro-only model
- THEN `setIntent('pro_model')` MUST be called
- AND the AuraNudgeBar MUST display an upgrade prompt.

### Requirement: Webhook Synchronization

El backend MUST procesar webhooks de Wompi para actualizar el plan del usuario tras un pago exitoso.

#### Scenario: Successful Payment Webhook
- GIVEN a successful Wompi transaction
- WHEN `POST /billing/webhook` receives the event
- THEN the backend MUST validate the signature with `WOMPI_WEBHOOK_SECRET`
- AND update `plan` to `"pro"` in DynamoDB Users table
- AND set `subscription_ends_at` to 30 days from now.

### Requirement: 7-Day Trial System

El sistema MUST soportar trials de 7 días que otorgan acceso Pro temporalmente.

#### Scenario: Trial provisioning
- GIVEN an admin or system triggers trial for a user
- WHEN the trial is provisioned
- THEN `plan` MUST be set to `"pro"` in DynamoDB
- AND `trial_ends_at` MUST be set to 7 days from now
- AND a branded trial email MUST be sent via SES.

### Requirement: Auto-Expiration

El sistema MUST ejecutar un cron diario (EventBridge) que escanea usuarios con trials/suscripciones expiradas y los downgrade automáticamente.

#### Scenario: Trial expires
- GIVEN a user has `trial_ends_at` in the past
- WHEN the expiration cron runs
- THEN `plan` MUST be downgraded to `"free"`
- AND `trial_ends_at` MUST remain for historical record.

#### Scenario: Subscription expires
- GIVEN a user has `subscription_ends_at` in the past and no active renewal
- WHEN the expiration cron runs
- THEN `plan` MUST be downgraded to `"free"`.

### Requirement: DynamoDB User Schema (Billing Fields)

| Field | Type | Description |
|-------|------|-------------|
| `plan` | string | Current tier: free, estudiante, pro |
| `trial_ends_at` | string (ISO) | Trial expiration date |
| `subscription_ends_at` | string (ISO) | Paid subscription expiration |
| `last_modified_by` | string | Email of admin who last changed plan |

## Files

- `packages/vibe-ai-backend/src/api/billing.ts` — Endpoints `/checkout-sign` y `/webhook`.
- `src/hooks/usePurchaseIntent.ts` — Purchase intent triggers.
- `src/components/chat/AuraNudgeBar.tsx` — Contextual upgrade notifications.
- `src/components/usage/WompiModal.tsx` — Wompi widget container.
