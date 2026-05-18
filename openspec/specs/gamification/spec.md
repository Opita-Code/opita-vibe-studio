# Gamification Specification

## Purpose

Sistema de gamificación que recompensa el uso activo del IDE con XP, niveles, misiones diarias/semanales, rachas, milestones, y bonus de quota de tokens. Diseñado para incentivar aprendizaje progresivo sin ser intrusivo. Backend engine separado con generación de misiones por IA.

## Architecture

- **Backend Engine**: `packages/vibe-ai-backend/src/api/gamification.ts` — XP tracking, missions, streaks, milestones, quota decay.
- **Store**: `src/stores/gamification.ts` — Zustand store con `GamificationProfile`, misiones, y queue de toasts.
- **UI**: `src/components/gamification/` — XPBar, MissionPanel, MilestoneToast.
- **Data Storage**: DynamoDB `TokenUsage` table with sort key patterns:
  - `sk: "xp#profile"` → XP profile
  - `sk: "mission#YYYY-MM-DD"` → Daily missions
  - `sk: "mission#weekly#YYYY-WNN"` → Weekly missions
  - `sk: "milestone#{level}"` → Unlocked milestones

## Data Model

### XPProfile
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `totalXp` | number | XP acumulado total |
| `level` | number | Nivel actual (`floor(sqrt(totalXp/100))`) |
| `streakDays` | number | Días consecutivos activo |
| `lastActiveDate` | string | Última fecha activa (YYYY-MM-DD) |
| `earnedQuota` | number | Tokens extra ganados (con decay) |
| `effectiveDailyQuota` | number | Calculado: `min(basePlan + earnedQuota, cap)` |
| `achievements` | array | Milestones desbloqueados |

### XP Actions
| Acción | XP Base | Descripción |
|--------|---------|-------------|
| `chat_message` | 5 | Mensaje enviado al AI |
| `template_use` | 25 | Uso de plantilla |
| `project_create` | 50 | Creación de proyecto |
| `feature_explore` | 10 | Exploración de feature |
| `daily_login` | 15 | Login diario |

### Plan Multipliers
| Plan | Multiplicador |
|------|--------------|
| Free | 1x |
| Estudiante | 1.5x |
| Pro | 2x |

### Milestones
| Nivel | Badge | Label | Quota Boost |
|-------|-------|-------|-------------|
| 3 | 🌱 | Semilla | +20K |
| 5 | 🔍 | Explorador | +30K |
| 10 | 🔨 | Constructor | +50K |
| 15 | ⚡ | Veloz | +40K |
| 25 | 🏗️ | Arquitecto | +60K |
| 50 | 👑 | Maestro | +100K |

## Requirements

### Requirement: XP Award System

The backend MUST award XP for defined actions, applying plan-based multipliers. Level is calculated as `floor(sqrt(totalXp / 100))`.

#### Scenario: XP por mensaje de chat
- GIVEN el usuario envía un mensaje al AI
- WHEN `awardXP(email, "chat_message", plan)` es llamado
- THEN el sistema MUST calcular `5 * planMultiplier` XP
- AND actualizar `totalXp` y `level` en DynamoDB
- AND retornar `AwardResult` con `xpAwarded`, `leveledUp`, y `newMilestone`.

### Requirement: AI-Generated Daily Missions

El sistema MUST generar 3 misiones diarias (una de cada tipo: aprender, construir, explorar) usando IA (Gemini 2.5 Flash). Si la generación falla, MUST usar el pool estático de fallback.

#### Scenario: Misiones generadas por IA
- GIVEN un usuario solicita sus misiones diarias
- WHEN `getMissions(email, plan)` es llamado y no existen misiones para hoy
- THEN el sistema MUST llamar `generateObject()` con schema de 3 misiones
- AND guardarlas en DynamoDB con TTL de 3 días
- AND la dificultad MUST basarse en el nivel: `< 5` → novato, `< 15` → intermedio, `≥ 15` → avanzado.

### Requirement: Weekly Missions

El sistema MUST generar 1 misión semanal extrema con recompensas 5-10x mayores (500 XP, 50K quota).

#### Scenario: Misión semanal generada
- GIVEN no existe misión semanal para la semana ISO actual
- WHEN `getMissions()` es llamado
- THEN el sistema MUST generar una misión con `type: "semanal"`, `period: "weekly"`
- AND guardarla con TTL de 14 días.

### Requirement: Mission Completion

#### Scenario: Completar misión
- GIVEN una misión con `completed === false`
- WHEN `completeMission(email, missionId, plan)` es llamado
- THEN el sistema MUST marcar la misión como completada
- AND llamar `awardXP()` con la acción correspondiente
- AND sumar `quotaReward` a `earnedQuota` (atómico con `UpdateCommand`)
- AND verificar streak bonuses (3, 7, 14, 30 días).

### Requirement: Quota Decay

El sistema MUST aplicar decay de 10% por día de inactividad a `earnedQuota`, con floor en la quota base del plan.

#### Scenario: Decay por inactividad
- GIVEN un usuario free con 200K `earnedQuota` y 3 días inactivo
- WHEN `getProfile()` es llamado
- THEN `earnedQuota` MUST ser `max(150K, 200K * 0.9^3)` = `max(150K, 145.8K)` = 150K
- AND el decay MUST persistirse en DynamoDB.

### Requirement: Streak Tracking

El sistema MUST rastrear días consecutivos de actividad. Si el usuario no fue activo ayer, el streak se resetea a 1.

#### Scenario: Streak incrementa
- GIVEN `lastActiveDate` es ayer
- WHEN `awardXP()` es llamado hoy
- THEN `streakDays` MUST incrementar en 1.

#### Scenario: Streak bonus quota
- GIVEN `streakDays` alcanza 7
- WHEN una misión es completada
- THEN el sistema MUST sumar `QUOTA_REWARDS["streak_7"]` (25K) a `earnedQuota`.

### Requirement: Effective Quota for Chat System

`getEffectiveQuota(email, plan)` MUST retornar la quota efectiva (`basePlan + earnedQuota`, capped) para que `chat.ts` ajuste los límites de tokens dinámicamente.

### Requirement: XPBar Interaction

El XPBar MUST ser clickable para abrir el MissionPanel. El tooltip MUST mostrar nivel, XP actual/siguiente, y racha.

## Files

- `packages/vibe-ai-backend/src/api/gamification.ts` — Backend engine (XP, missions, streaks, milestones, quota decay).
- `src/stores/gamification.ts` — GamificationStore (profile, missions, toasts).
- `src/components/gamification/XPBar.tsx` — Barra de XP interactiva.
- `src/components/gamification/MissionPanel.tsx` — Panel lateral de misiones.
- `src/components/gamification/MilestoneToast.tsx` — Toast de recompensas.
- `src/agent/useAgentHandler.ts` — Hook de passive XP (chat_message).
- `packages/vibe-ai-backend/src/api/chat.ts` — Calls `getEffectiveQuota()` for dynamic limits.
