# Gamification Specification

## Purpose

Sistema de gamificación que recompensa el uso activo del IDE con XP, niveles, misiones diarias, rachas, y bonus de quota de tokens. Diseñado para incentivar aprendizaje progresivo sin ser intrusivo.

## Architecture

- **Engine**: `packages/vibe-ai-backend/src/api/chat.ts` — calcula XP, procesa misiones, actualiza perfil
- **Store**: `src/stores/gamification.ts` — Zustand store con `GamificationProfile`, misiones, y queue de toasts
- **UI**: `src/components/gamification/` — XPBar, MissionPanel, MilestoneToast
- **API**: `GET /usage` retorna perfil de gamificación junto con token usage

## Data Model

### GamificationProfile
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | number | Nivel actual (1+) |
| `totalXP` | number | XP acumulado total |
| `currentLevelXP` | number | XP en el nivel actual |
| `nextLevelXP` | number | XP necesario para subir |
| `streak` | number | Días consecutivos activo |
| `earnedQuota` | number | Tokens diarios extra ganados |
| `dailyQuotaCap` | number | Máximo quota ganable (300K free, 400K est) |

### Mission
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Identificador único |
| `title` | string | Nombre en español |
| `description` | string | Instrucciones |
| `xpReward` | number | XP al completar |
| `quotaReward` | number | Tokens extra al completar |
| `type` | "daily" \| "milestone" | Tipo de misión |
| `completed` | boolean | Estado |
| `progress` | number | Progreso actual |
| `target` | number | Meta |

## Requirements

### Requirement: Passive XP

El sistema MUST otorgar XP pasivo por interacciones naturales del usuario.

#### Scenario: XP por mensaje de chat
- GIVEN el usuario envía un mensaje al AI
- WHEN el AI responde exitosamente (no es retry)
- THEN se llama `awardPassiveXP("chat_message")`
- AND el sistema aplica debounce de 30 segundos para evitar spam

### Requirement: Daily Missions

El sistema MUST ofrecer misiones diarias que otorgan XP y bonus de quota.

#### Scenario: Completar misión
- GIVEN una misión con `progress >= target`
- WHEN el usuario presiona "Completar" en el MissionPanel
- THEN `POST /usage/complete-mission` se ejecuta
- AND el backend actualiza XP, quota, y marca la misión como completada
- AND se muestra un MilestoneToast con la recompensa
- AND se previenen doble-clicks con `completingMissionId` guard

### Requirement: Earned Quota

El sistema MUST mostrar tokens ganados como bonus de la quota base.

#### Scenario: Quota efectiva
- GIVEN un usuario free con 150K base y 50K ganados
- WHEN se calcula `effectiveDailyQuota`
- THEN el resultado es `min(150K + 50K, dailyQuotaCap)` = 200K
- AND el PlanCard muestra "+50K ganados con misiones"
- AND el endpoint `/usage` retorna la quota efectiva

### Requirement: Streak Tracking

El sistema MUST rastrear días consecutivos de actividad.

#### Scenario: Streak incrementa
- GIVEN el usuario usó el IDE ayer
- WHEN el usuario usa el IDE hoy
- THEN `streak` incrementa en 1
- AND se muestra en el Profile Popover del ActivityBar

### Requirement: XP Bar Interaction

El XPBar MUST ser clickable para abrir el MissionPanel.

#### Scenario: Click en XPBar
- GIVEN la XPBar es visible en el layout
- WHEN el usuario hace click
- THEN el MissionPanel se abre
- AND el tooltip muestra nivel, XP actual/siguiente, y racha

### Requirement: Mission Panel UX

El MissionPanel MUST soportar cierre por Escape y prevenir clicks dobles.

#### Scenario: Escape cierra panel
- GIVEN el MissionPanel está abierto
- WHEN el usuario presiona Escape
- THEN el panel se cierra

## Files

- `src/stores/gamification.ts` — GamificationStore (profile, missions, toasts, XP engine)
- `src/components/gamification/XPBar.tsx` — Barra de XP interactiva
- `src/components/gamification/MissionPanel.tsx` — Panel lateral de misiones
- `src/components/gamification/MilestoneToast.tsx` — Toast de recompensas
- `src/components/gamification/index.ts` — Barrel exports
- `src/agent/useAgentHandler.ts` — Hook de passive XP (chat_message)
- `src/components/layout/ActivityBar.tsx` — Profile popover con stats de gamificación
- `packages/vibe-ai-backend/src/api/chat.ts` — Backend XP/mission engine
