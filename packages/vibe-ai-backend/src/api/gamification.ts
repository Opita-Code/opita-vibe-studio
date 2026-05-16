/**
 * Gamification Engine — Backend
 *
 * Handles XP tracking, daily missions, streak management, and quota rewards.
 * Reuses the TokenUsage DynamoDB table with different sort key patterns.
 *
 * Data model (all under pk = "user#{email}"):
 *   sk: "xp#profile"       → XP profile (totalXp, level, streak, earnedQuota)
 *   sk: "mission#YYYY-MM-DD" → Daily missions
 *   sk: "milestone#{level}" → Unlocked milestones
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource as SSTResource } from "sst";

const Resource = SSTResource as any;

import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./chat.js";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// ─── Constants (mirrored from frontend xp-constants.ts) ─────────

const XP_ACTIONS: Record<string, number> = {
  chat_message: 5,
  template_use: 25,
  project_create: 50,
  feature_explore: 10,
  daily_login: 15,
  mission_complete_novato: 100,
  mission_complete_intermedio: 200,
  mission_complete_avanzado: 350,
  streak_3_bonus: 50,
  streak_7_bonus: 150,
  streak_14_bonus: 300,
  streak_30_bonus: 500,
};

const QUOTA_REWARDS: Record<string, number> = {
  mission_novato: 5_000,
  mission_intermedio: 10_000,
  mission_avanzado: 15_000,
  streak_3: 10_000,
  streak_7: 25_000,
  streak_14: 40_000,
  streak_30: 75_000,
};

const PLAN_MULTIPLIERS: Record<string, number> = {
  free: 1,
  estudiante: 1.5,
  pro: 2,
};

const QUOTA_CAPS: Record<string, number> = {
  free: 300_000,
  estudiante: 400_000,
  pro: 1_000_000,
};

const QUOTA_DECAY_RATE = 0.10;

const QUOTA_DECAY_FLOOR: Record<string, number> = {
  free: 150_000,
  estudiante: 250_000,
  pro: 1_000_000,
};

const MILESTONES = [
  { level: 3, badge: "🌱", label: "Semilla", quotaBoost: 20_000 },
  { level: 5, badge: "🔍", label: "Explorador", quotaBoost: 30_000 },
  { level: 10, badge: "🔨", label: "Constructor", quotaBoost: 50_000 },
  { level: 15, badge: "⚡", label: "Veloz", quotaBoost: 40_000 },
  { level: 25, badge: "🏗️", label: "Arquitecto", quotaBoost: 60_000 },
  { level: 50, badge: "👑", label: "Maestro", quotaBoost: 100_000 },
];

function calculateLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}

// ─── Mission Templates ──────────────────────────────────────────

interface MissionTemplate {
  type: "aprender" | "construir" | "explorar";
  title: string;
  description: string;
  validationHint: string;
  completionCriteria: {
    eventType: string;
    count: number;
    within?: number;
    filter?: Record<string, string>;
  };
}

const MISSION_POOL: Record<string, MissionTemplate[]> = {
  novato: [
    { type: "aprender", title: "Chatea con la IA", description: "Envía un mensaje al chat para explorar cómo funciona la IA.", validationHint: "chat_about_components", completionCriteria: { eventType: "chat_sent", count: 1 } },
    { type: "construir", title: "Crea tu primer archivo", description: "Crea un nuevo archivo en tu proyecto para empezar a construir.", validationHint: "create_card_component", completionCriteria: { eventType: "file_created", count: 1 } },
    { type: "explorar", title: "Vista previa en vivo", description: "Abre la vista previa y observa cómo tu código se renderiza en tiempo real.", validationHint: "use_preview", completionCriteria: { eventType: "preview_opened", count: 1 } },
    { type: "aprender", title: "Haz 3 preguntas", description: "Pregúntale a la IA sobre cualquier concepto de programación — 3 mensajes.", validationHint: "chat_about_state", completionCriteria: { eventType: "chat_sent", count: 3 } },
    { type: "construir", title: "Edita un componente", description: "Modifica un archivo existente para mejorar tu proyecto.", validationHint: "create_counter", completionCriteria: { eventType: "file_edited", count: 1 } },
    { type: "explorar", title: "Exporta tu proyecto", description: "Descarga tu proyecto como ZIP y revisa la estructura de archivos.", validationHint: "export_zip", completionCriteria: { eventType: "project_exported", count: 1 } },
  ],
  intermedio: [
    { type: "aprender", title: "Sesión de aprendizaje", description: "Envía 5 mensajes al chat para profundizar en un tema.", validationHint: "chat_about_effects", completionCriteria: { eventType: "chat_sent", count: 5 } },
    { type: "construir", title: "Crea 3 archivos", description: "Construye un proyecto multi-archivo con al menos 3 componentes.", validationHint: "create_form", completionCriteria: { eventType: "file_created", count: 3 } },
    { type: "explorar", title: "Vista previa × 3", description: "Abre la vista previa 3 veces — itera sobre tu diseño.", validationHint: "use_vibelens", completionCriteria: { eventType: "preview_opened", count: 3 } },
    { type: "aprender", title: "Diálogo profundo", description: "Mantén una conversación de 8 mensajes sobre un concepto.", validationHint: "chat_about_patterns", completionCriteria: { eventType: "chat_sent", count: 8 } },
    { type: "construir", title: "Edición intensiva", description: "Edita 5 archivos para refinar tu proyecto.", validationHint: "create_filtered_list", completionCriteria: { eventType: "file_edited", count: 5 } },
    { type: "explorar", title: "Usa una plantilla", description: "Inicia un proyecto desde una plantilla prediseñada.", validationHint: "configure_byok", completionCriteria: { eventType: "template_used", count: 1 } },
  ],
  avanzado: [
    { type: "aprender", title: "Masterclass con IA", description: "Sesión avanzada — 10 mensajes profundizando en arquitectura.", validationHint: "chat_about_architecture", completionCriteria: { eventType: "chat_sent", count: 10 } },
    { type: "construir", title: "Proyecto completo", description: "Crea 5+ archivos para un proyecto multi-componente.", validationHint: "create_dashboard", completionCriteria: { eventType: "file_created", count: 5 } },
    { type: "explorar", title: "Modo agente", description: "Usa el motor de agentes para que la IA cree código autónomamente.", validationHint: "use_agent_mode", completionCriteria: { eventType: "agent_used", count: 1 } },
    { type: "aprender", title: "Sprint de preguntas", description: "15 mensajes en una sesión — aprendizaje acelerado.", validationHint: "chat_about_performance", completionCriteria: { eventType: "chat_sent", count: 15 } },
    { type: "construir", title: "Refactoring masivo", description: "Edita 10+ archivos para refactorizar tu proyecto.", validationHint: "create_animation", completionCriteria: { eventType: "file_edited", count: 10 } },
    { type: "explorar", title: "Exporta y despliega", description: "Exporta tu proyecto terminado — listo para producción.", validationHint: "multi_file_project", completionCriteria: { eventType: "project_exported", count: 1 } },
  ],
};

// ─── Profile Operations ─────────────────────────────────────────

export interface XPProfile {
  totalXp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string;
  earnedQuota: number;
  /** Computed: effective daily quota after decay */
  effectiveDailyQuota: number;
  achievements?: Array<{ level: number; badge: string; label: string; unlockedAt: string }>;
}

export async function getProfile(email: string, plan: string): Promise<XPProfile> {
  const pk = `user#${email}`;
  const result = await docClient.send(new GetCommand({
    TableName: Resource.TokenUsage.name,
    Key: { pk, sk: "xp#profile" },
  }));

  const item = result.Item;
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (!item) {
    // First-time user — create profile
    const profile: XPProfile = {
      totalXp: 0,
      level: 0,
      streakDays: 0,
      lastActiveDate: today,
      earnedQuota: 0,
      effectiveDailyQuota: QUOTA_DECAY_FLOOR[plan] ?? 150_000,
    };
    await saveProfile(email, profile);
    return profile;
  }

  // Calculate quota decay based on inactivity
  const lastActive = item.lastActiveDate as string;
  const daysInactive = lastActive
    ? Math.max(0, Math.floor(
        (new Date(today).getTime() - new Date(lastActive).getTime()) / (86400 * 1000),
      ) - 1) // -1 because today doesn't count as inactive
    : 0;

  let earnedQuota = (item.earnedQuota as number) || 0;
  const floor = QUOTA_DECAY_FLOOR[plan] ?? 150_000;

  if (daysInactive > 0 && earnedQuota > floor) {
    earnedQuota = Math.max(
      floor,
      Math.round(earnedQuota * Math.pow(1 - QUOTA_DECAY_RATE, daysInactive)),
    );
    // Persist decayed quota
    await docClient.send(new UpdateCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: "xp#profile" },
      UpdateExpression: "SET earnedQuota = :eq, lastActiveDate = :today",
      ExpressionAttributeValues: { ":eq": earnedQuota, ":today": today },
    }));
  }

  const totalXp = (item.totalXp as number) || 0;

  const cap = QUOTA_CAPS[plan] ?? QUOTA_CAPS.free;
  const baseFloor = QUOTA_DECAY_FLOOR[plan] ?? 150_000;

  // Fetch achievements (milestones)
  let achievements = [];
  try {
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const milestonesResult = await docClient.send(new QueryCommand({
      TableName: Resource.TokenUsage.name,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": pk,
        ":skPrefix": "milestone#",
      },
    }));
    achievements = (milestonesResult.Items || []).map(m => ({
      level: parseInt(m.sk.replace("milestone#", ""), 10),
      badge: m.badge,
      label: m.label,
      unlockedAt: m.unlockedAt,
    })).sort((a, b) => a.level - b.level);
  } catch (e) {
    console.error("Error fetching achievements:", e);
  }

  return {
    totalXp,
    level: calculateLevel(totalXp),
    streakDays: (item.streakDays as number) || 0,
    lastActiveDate: lastActive || today,
    earnedQuota,
    // Effective = base plan quota + earned (capped at plan ceiling)
    effectiveDailyQuota: Math.min(baseFloor + earnedQuota, cap),
    achievements,
  };
}

async function saveProfile(email: string, profile: Omit<XPProfile, "effectiveDailyQuota">): Promise<void> {
  const pk = `user#${email}`;
  await docClient.send(new PutCommand({
    TableName: Resource.TokenUsage.name,
    Item: {
      pk,
      sk: "xp#profile",
      totalXp: profile.totalXp,
      level: profile.level,
      streakDays: profile.streakDays,
      lastActiveDate: profile.lastActiveDate,
      earnedQuota: profile.earnedQuota,
    },
  }));
}

// ─── XP Award ───────────────────────────────────────────────────

interface AwardResult {
  xpAwarded: number;
  newTotalXp: number;
  newLevel: number;
  previousLevel: number;
  leveledUp: boolean;
  quotaAwarded: number;
  newEarnedQuota: number;
  newMilestone?: { level: number; badge: string; label: string };
}

export async function awardXP(
  email: string,
  action: string,
  plan: string,
): Promise<AwardResult> {
  const profile = await getProfile(email, plan);
  const baseXP = XP_ACTIONS[action] ?? 0;
  if (baseXP === 0) {
    return {
      xpAwarded: 0,
      newTotalXp: profile.totalXp,
      newLevel: profile.level,
      previousLevel: profile.level,
      leveledUp: false,
      quotaAwarded: 0,
      newEarnedQuota: profile.earnedQuota,
    };
  }

  const multiplier = PLAN_MULTIPLIERS[plan] ?? 1;
  const xpAwarded = Math.round(baseXP * multiplier);
  const newTotalXp = profile.totalXp + xpAwarded;
  const previousLevel = profile.level;
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > previousLevel;

  // Update streak
  const today = new Date().toISOString().split("T")[0];
  let streakDays = profile.streakDays;
  if (profile.lastActiveDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    streakDays = profile.lastActiveDate === yesterdayStr
      ? profile.streakDays + 1
      : 1; // Reset streak if missed a day
  }

  // Check for milestone
  let newMilestone: AwardResult["newMilestone"];
  let milestoneQuotaBoost = 0;
  if (leveledUp) {
    for (const m of MILESTONES) {
      if (m.level === newLevel) {
        newMilestone = { level: m.level, badge: m.badge, label: m.label };
        milestoneQuotaBoost = m.quotaBoost;
        // Record milestone
        await docClient.send(new PutCommand({
          TableName: Resource.TokenUsage.name,
          Item: {
            pk: `user#${email}`,
            sk: `milestone#${m.level}`,
            badge: m.badge,
            label: m.label,
            unlockedAt: new Date().toISOString(),
            quotaBoost: m.quotaBoost,
          },
        }));
        break;
      }
    }
  }

  // Calculate quota changes
  const cap = QUOTA_CAPS[plan] ?? QUOTA_CAPS.free;
  const quotaAwarded = milestoneQuotaBoost;
  const newEarnedQuota = Math.min(cap, profile.earnedQuota + quotaAwarded);

  // Save updated profile
  await saveProfile(email, {
    totalXp: newTotalXp,
    level: newLevel,
    streakDays,
    lastActiveDate: today,
    earnedQuota: newEarnedQuota,
  });

  return {
    xpAwarded,
    newTotalXp,
    newLevel,
    previousLevel,
    leveledUp,
    quotaAwarded,
    newEarnedQuota,
    newMilestone,
  };
}

// ─── Missions ───────────────────────────────────────────────────

interface Mission {
  id: string;
  type: "aprender" | "construir" | "explorar" | "semanal";
  period?: "daily" | "weekly";
  title: string;
  description: string;
  xpReward: number;
  quotaReward: number;
  difficulty: string;
  completed: boolean;
  completedAt?: string;
  completionCriteria?: {
    eventType: string;
    count: number;
    within?: number;
    filter?: Record<string, string>;
  };
}

export async function getMissions(
  email: string,
  plan: string,
): Promise<Mission[]> {
  const today = new Date().toISOString().split("T")[0];
  const pk = `user#${email}`;
  const skDaily = `mission#${today}`;
  
  // Calculate ISO week string (e.g. "2026-W20")
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const currentWeek = `${date.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
  const skWeekly = `mission#weekly#${currentWeek}`;

  const resultDaily = await docClient.send(new GetCommand({
    TableName: Resource.TokenUsage.name,
    Key: { pk, sk: skDaily },
  }));

  const resultWeekly = await docClient.send(new GetCommand({
    TableName: Resource.TokenUsage.name,
    Key: { pk, sk: skWeekly },
  }));

  let dailyMissions: Mission[] = resultDaily.Item?.missions || [];
  let weeklyMissions: Mission[] = resultWeekly.Item?.missions || [];

  const profile = await getProfile(email, plan);
  const level = profile.level;
  const difficulty = level < 5 ? "novato" : level < 15 ? "intermedio" : "avanzado";
  
  const aiModel = getModel("gemini", undefined, "gemini-2.5-flash");

  // 1. Generate Daily Missions if missing
  if (dailyMissions.length === 0) {
    try {
      const { object } = await generateObject({
        model: aiModel as any,
        schema: z.object({
          missions: z.array(
            z.object({
              type: z.enum(["aprender", "construir", "explorar"]),
              title: z.string().max(50),
              description: z.string().max(120),
              completionCriteria: z.object({
                eventType: z.enum(["chat_sent", "template_used", "project_exported", "preview_opened", "agent_used"]),
                count: z.number().int().positive(),
              }),
            })
          ).length(3),
        }),
        prompt: `Genera 3 misiones diarias (una de cada tipo: 'aprender', 'construir', 'explorar') para un desarrollador nivel ${difficulty} (Nivel ${level}) en un IDE web. Responde en español con títulos épicos.`,
      });

      const quotaRewardKey = `mission_${difficulty}` as keyof typeof QUOTA_REWARDS;
      const xpRewardKey = `mission_complete_${difficulty}` as keyof typeof XP_ACTIONS;

      dailyMissions = object.missions.map((m) => ({
        id: `${today}-${m.type}`,
        type: m.type,
        period: "daily",
        title: m.title,
        description: m.description,
        xpReward: XP_ACTIONS[xpRewardKey] ?? 100,
        quotaReward: QUOTA_REWARDS[quotaRewardKey] ?? 5_000,
        difficulty,
        completed: false,
        completionCriteria: m.completionCriteria,
      }));
    } catch (error) {
      console.error("Error generating daily missions:", error);
      const pool = MISSION_POOL[difficulty] || MISSION_POOL.novato;
      const types: Array<"aprender" | "construir" | "explorar"> = ["aprender", "construir", "explorar"];
      for (const type of types) {
        const candidates = pool.filter((m) => m.type === type);
        if (candidates.length === 0) continue;
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        dailyMissions.push({
          id: `${today}-${type}`,
          type: picked.type,
          period: "daily",
          title: picked.title,
          description: picked.description,
          xpReward: 100,
          quotaReward: 5000,
          difficulty,
          completed: false,
          completionCriteria: picked.completionCriteria,
        });
      }
    }

    const ttlDaily = Math.floor(Date.now() / 1000) + 3 * 86400; // 3-day TTL
    await docClient.send(new PutCommand({
      TableName: Resource.TokenUsage.name,
      Item: { pk, sk: skDaily, missions: dailyMissions, generatedAt: new Date().toISOString(), difficulty, expiresAt: ttlDaily },
    }));
  }

  // 2. Generate Weekly Mission if missing
  if (weeklyMissions.length === 0) {
    try {
      const { object } = await generateObject({
        model: aiModel as any,
        schema: z.object({
          mission: z.object({
            title: z.string().max(50),
            description: z.string().max(120),
            completionCriteria: z.object({
              eventType: z.enum(["chat_sent", "project_create", "agent_used"]),
              count: z.number().int().positive(),
            }),
          }),
        }),
        prompt: `Genera 1 misión semanal muy difícil para un desarrollador nivel ${difficulty} en un IDE.
        El evento debe requerir mucha actividad, por ejemplo:
        - chat_sent: count entre 20 y 50
        - agent_used: count entre 10 y 20
        - project_create: count entre 3 y 5
        Responde en español con un título majestuoso y épico.`,
      });

      weeklyMissions = [{
        id: `${currentWeek}-semanal`,
        type: "semanal",
        period: "weekly",
        title: object.mission.title,
        description: object.mission.description,
        xpReward: 500, // 5x regular
        quotaReward: 50_000, // 10x regular
        difficulty: "extremo",
        completed: false,
        completionCriteria: object.mission.completionCriteria,
      }];
    } catch (error) {
      console.error("Error generating weekly mission:", error);
      weeklyMissions = [{
        id: `${currentWeek}-semanal`,
        type: "semanal",
        period: "weekly",
        title: "Maratón de Código",
        description: "Usa el Agente IA intensamente a lo largo de la semana para completar tu cuota de desarrollo.",
        xpReward: 500,
        quotaReward: 50000,
        difficulty: "extremo",
        completed: false,
        completionCriteria: { eventType: "agent_used", count: 15 },
      }];
    }

    const ttlWeekly = Math.floor(Date.now() / 1000) + 14 * 86400; // 14-day TTL
    await docClient.send(new PutCommand({
      TableName: Resource.TokenUsage.name,
      Item: { pk, sk: skWeekly, missions: weeklyMissions, generatedAt: new Date().toISOString(), difficulty: "extremo", expiresAt: ttlWeekly },
    }));
  }

  return [...dailyMissions, ...weeklyMissions];
}

export async function completeMission(
  email: string,
  missionId: string,
  plan: string,
): Promise<{
  success: boolean;
  xpAwarded: number;
  quotaAwarded: number;
  newLevel?: number;
  leveledUp: boolean;
  newMilestone?: { level: number; badge: string; label: string };
  streakDays: number;
}> {
  const today = new Date().toISOString().split("T")[0];
  const pk = `user#${email}`;
  const sk = `mission#${today}`;

  const result = await docClient.send(new GetCommand({
    TableName: Resource.TokenUsage.name,
    Key: { pk, sk },
  }));

  if (!result.Item?.missions) {
    return { success: false, xpAwarded: 0, quotaAwarded: 0, leveledUp: false, streakDays: 0 };
  }

  const missions = result.Item.missions as DailyMission[];
  const mission = missions.find((m) => m.id === missionId);

  if (!mission || mission.completed) {
    return { success: false, xpAwarded: 0, quotaAwarded: 0, leveledUp: false, streakDays: 0 };
  }

  // Mark as completed
  mission.completed = true;
  mission.completedAt = new Date().toISOString();

  // Save updated missions
  await docClient.send(new PutCommand({
    TableName: Resource.TokenUsage.name,
    Item: { ...result.Item, missions },
  }));

  // Award XP (this also updates streak and checks milestones)
  const xpAction = `mission_complete_${mission.difficulty}`;
  const xpResult = await awardXP(email, xpAction, plan);

  // Award quota boost (permanent) — use atomic ADD to prevent race conditions
  const quotaReward = mission.quotaReward;
  const cap = QUOTA_CAPS[plan] ?? QUOTA_CAPS.free;

  // Read current profile AFTER xpAward (which already updated streak/xp)
  const updatedProfile = await getProfile(email, plan);
  let totalQuotaBoost = quotaReward;

  // Check streak bonuses (use streakDays from the freshly updated profile)
  const streakDays = updatedProfile.streakDays;
  const streakMilestones = [3, 7, 14, 30] as const;
  for (const ms of streakMilestones) {
    if (streakDays === ms) {
      const key = `streak_${ms}` as keyof typeof QUOTA_REWARDS;
      totalQuotaBoost += QUOTA_REWARDS[key] ?? 0;
    }
  }

  // Single atomic update for earned quota
  const newEarnedQuota = Math.min(cap, updatedProfile.earnedQuota + totalQuotaBoost);
  await docClient.send(new UpdateCommand({
    TableName: Resource.TokenUsage.name,
    Key: { pk, sk: "xp#profile" },
    UpdateExpression: "SET earnedQuota = :eq",
    ExpressionAttributeValues: { ":eq": newEarnedQuota },
  }));

  return {
    success: true,
    xpAwarded: xpResult.xpAwarded,
    quotaAwarded: totalQuotaBoost,
    newLevel: xpResult.leveledUp ? xpResult.newLevel : undefined,
    leveledUp: xpResult.leveledUp,
    newMilestone: xpResult.newMilestone,
    streakDays,
  };
}

// ─── Earned Quota for Chat System ───────────────────────────────

/**
 * Returns the user's effective daily quota (base + earned - decay).
 * Called by chat.ts to adjust token limits dynamically.
 */
export async function getEffectiveQuota(
  email: string,
  plan: string,
): Promise<number> {
  try {
    const profile = await getProfile(email, plan);
    return profile.effectiveDailyQuota;
  } catch {
    // Fallback to base quota if gamification fails
    return QUOTA_DECAY_FLOOR[plan] ?? 150_000;
  }
}
