/**
 * Gamification API — unit tests.
 *
 * Mocks DynamoDB, sst, "ai" (generateObject) and "./chat.js" (getModel).
 * Exercises getProfile / awardXP / getMissions / completeMission / getEffectiveQuota.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const generateObject = vi.fn();
  const getModel = vi.fn();
  class BaseCmd {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  const GetCommand = class GetCommand extends BaseCmd {};
  const PutCommand = class PutCommand extends BaseCmd {};
  const UpdateCommand = class UpdateCommand extends BaseCmd {};
  const QueryCommand = class QueryCommand extends BaseCmd {};
  return {
    send,
    generateObject,
    getModel,
    GetCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
  };
});

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    constructor(_config?: unknown) {}
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: hoisted.send }) },
  GetCommand: hoisted.GetCommand,
  PutCommand: hoisted.PutCommand,
  UpdateCommand: hoisted.UpdateCommand,
  QueryCommand: hoisted.QueryCommand,
}));

vi.mock("sst", () => ({ Resource: { TokenUsage: { name: "token-usage" } } }));

vi.mock("./chat.js", () => ({ getModel: hoisted.getModel }));

vi.mock("ai", () => ({ generateObject: hoisted.generateObject }));

import { getProfile, awardXP, getMissions, completeMission, getEffectiveQuota } from "./gamification.js";

const TODAY = new Date().toISOString().split("T")[0];
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
})();

function profileItem(overrides: Record<string, unknown> = {}) {
  return {
    totalXp: 0,
    level: 0,
    streakDays: 0,
    lastActiveDate: TODAY,
    earnedQuota: 0,
    ...overrides,
  };
}

function missionItem(overrides: Record<string, unknown> = {}) {
  return { missions: [], ...overrides };
}

interface RouterConfig {
  profile?: Record<string, unknown>;
  daily?: Record<string, unknown>;
  weekly?: Record<string, unknown>;
  milestones?: any[];
  profileError?: Error;
}

function routeDdb(cfg: RouterConfig) {
  hoisted.send.mockImplementation(async (cmd: any) => {
    if (cmd instanceof hoisted.GetCommand) {
      const sk = cmd.input.Key?.sk;
      if (sk === "xp#profile") {
        if (cfg.profileError) throw cfg.profileError;
        return cfg.profile ? { Item: cfg.profile } : {};
      }
      if (sk && sk.startsWith("mission#")) {
        const isWeekly = sk.includes("weekly");
        const item = isWeekly ? cfg.weekly : cfg.daily;
        return item ? { Item: item } : {};
      }
      return {};
    }
    if (cmd instanceof hoisted.QueryCommand) {
      return { Items: cfg.milestones || [] };
    }
    return {};
  });
}

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.generateObject.mockReset();
  hoisted.getModel.mockReset();
  hoisted.getModel.mockReturnValue({ generateText: () => {} });
});

describe("getProfile", () => {
  it("crea perfil por defecto cuando no existe item", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) return {};
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const profile = await getProfile("a@b.c", "free");
    expect(profile.totalXp).toBe(0);
    expect(profile.level).toBe(0);
    expect(profile.effectiveDailyQuota).toBe(150_000);
    expect(updates.length).toBe(1);
  });

  it("retorna datos del item sin decay cuando lastActiveDate es hoy", async () => {
    routeDdb({
      profile: profileItem({ totalXp: 400, streakDays: 2, earnedQuota: 30_000 }),
    });
    const profile = await getProfile("a@b.c", "pro");
    expect(profile.totalXp).toBe(400);
    expect(profile.level).toBe(2);
    expect(profile.streakDays).toBe(2);
    expect(profile.effectiveDailyQuota).toBe(Math.min(1_000_000 + 30_000, 1_000_000));
    expect(profile.effectiveDailyQuota).toBe(1_000_000);
  });

  it("decae earnedQuota cuando hay inactividad", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") {
          return {
            Item: profileItem({
              totalXp: 100,
              earnedQuota: 500_000,
              lastActiveDate: (() => {
                const d = new Date();
                d.setDate(d.getDate() - 6);
                return d.toISOString().split("T")[0];
              })(),
            }),
          };
        }
        return {};
      }
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const profile = await getProfile("a@b.c", "free");
    expect(profile.earnedQuota).toBeLessThan(500_000);
    expect(updates.length).toBe(1);
    expect(updates[0].UpdateExpression).toContain("earnedQuota");
  });

  it("no decae cuando earnedQuota está bajo el floor", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk === "xp#profile") {
        return {
          Item: profileItem({
            totalXp: 100,
            earnedQuota: 10_000,
            lastActiveDate: (() => {
              const d = new Date();
              d.setDate(d.getDate() - 6);
              return d.toISOString().split("T")[0];
            })(),
          }),
        };
      }
      return {};
    });
    const profile = await getProfile("a@b.c", "free");
    expect(profile.earnedQuota).toBe(10_000);
  });

  it("incluye achievements ordenados por nivel", async () => {
    routeDdb({
      profile: profileItem({ totalXp: 900 }),
      milestones: [
        { sk: "milestone#10", badge: "b", label: "B", unlockedAt: "x" },
        { sk: "milestone#3", badge: "a", label: "A", unlockedAt: "x" },
      ],
    });
    const profile = await getProfile("a@b.c", "free");
    expect(profile.achievements!.map((a) => a.level)).toEqual([3, 10]);
  });

  it("tolera errores al buscar achievements", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk === "xp#profile") {
        return { Item: profileItem({ totalXp: 900 }) };
      }
      if (cmd instanceof hoisted.QueryCommand) throw new Error("query down");
      return {};
    });
    const profile = await getProfile("a@b.c", "free");
    expect(profile.achievements).toEqual([]);
  });
});

describe("awardXP", () => {
  it("acción desconocida → resultado cero", async () => {
    routeDdb({ profile: profileItem({ totalXp: 100 }) });
    const res = await awardXP("a@b.c", "not_an_action", "free");
    expect(res.xpAwarded).toBe(0);
    expect(res.leveledUp).toBe(false);
    expect(res.quotaAwarded).toBe(0);
  });

  it("aplica XP con streak consecutivo (ayer) y no level-up", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk === "xp#profile") {
        return { Item: profileItem({ totalXp: 50, streakDays: 2, lastActiveDate: YESTERDAY }) };
      }
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const res = await awardXP("a@b.c", "daily_login", "pro");
    expect(res.xpAwarded).toBe(30);
    expect(res.newTotalXp).toBe(80);
    expect(res.leveledUp).toBe(false);
    const profileUpdate = updates.find((u) => u.Key.sk === "xp#profile");
    expect(profileUpdate.ExpressionAttributeValues[":streak"]).toBe(3);
  });

  it("reinicia streak cuando se pierde un día", async () => {
    routeDdb({
      profile: profileItem({
        totalXp: 50,
        streakDays: 5,
        lastActiveDate: (() => {
          const d = new Date();
          d.setDate(d.getDate() - 3);
          return d.toISOString().split("T")[0];
        })(),
      }),
    });
    const res = await awardXP("a@b.c", "chat_message", "free");
    expect(res.newTotalXp).toBe(55);
    const profileUpdate = hoisted.send.mock.calls
      .map((c: any) => c[0])
      .filter((c: any) => c instanceof hoisted.UpdateCommand && c.input.Key.sk === "xp#profile");
    expect(profileUpdate[0].input.ExpressionAttributeValues[":streak"]).toBe(1);
  });

  it("mantiene streak cuando lastActiveDate es hoy", async () => {
    routeDdb({ profile: profileItem({ totalXp: 50, streakDays: 4 }) });
    const res = await awardXP("a@b.c", "chat_message", "free");
    expect(res.newTotalXp).toBe(55);
    expect(res.leveledUp).toBe(false);
  });

  it("level-up otorga milestones y quota boost", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk === "xp#profile") {
        return { Item: profileItem({ totalXp: 800 }) };
      }
      if (cmd instanceof hoisted.PutCommand) puts.push(cmd.input);
      return {};
    });
    const res = await awardXP("a@b.c", "mission_complete_avanzado", "pro");
    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBe(3);
    expect(res.quotaAwarded).toBe(20_000);
    expect(res.newMilestone).toEqual({ level: 3, badge: "🌱", label: "Semilla" });
    expect(puts.some((p) => p.Item.sk === "milestone#3")).toBe(true);
  });
});

describe("getMissions", () => {
  it("usa misiones diarias y semanales ya existentes", async () => {
    routeDdb({
      profile: profileItem({ totalXp: 100 }),
      daily: missionItem({ missions: [{ id: "d1" }] }),
      weekly: missionItem({ missions: [{ id: "w1" }] }),
    });
    const missions = await getMissions("a@b.c", "free");
    expect(missions.map((m) => m.id)).toEqual(["d1", "w1"]);
    expect(hoisted.generateObject).not.toHaveBeenCalled();
  });

  it("genera misiones diarias con IA cuando faltan", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ totalXp: 100 }) };
        if (sk && sk.startsWith("mission#")) {
          return sk.includes("weekly") ? { Item: missionItem({ missions: [{ id: "w1" }] }) } : {};
        }
        return {};
      }
      if (cmd instanceof hoisted.PutCommand) puts.push(cmd.input);
      return {};
    });
    hoisted.generateObject.mockResolvedValueOnce({
      object: {
        missions: [
          { type: "aprender", title: "T1", description: "D1", completionCriteria: { eventType: "chat_sent", count: 1 } },
          { type: "construir", title: "T2", description: "D2", completionCriteria: { eventType: "file_created", count: 1 } },
          { type: "explorar", title: "T3", description: "D3", completionCriteria: { eventType: "preview_opened", count: 1 } },
        ],
      },
    });
    const missions = await getMissions("a@b.c", "free");
    expect(missions.length).toBe(4); // 3 daily + 1 weekly existente
    expect(hoisted.generateObject).toHaveBeenCalledTimes(1);
    const dailyPut = puts.find((p) => p.Item.sk.startsWith("mission#") && !p.Item.sk.includes("weekly"));
    expect(dailyPut.Item.difficulty).toBe("novato");
    expect(dailyPut.Item.missions[0].xpReward).toBe(100);
  });

  it("genera misiones diarias del pool cuando la IA falla", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ totalXp: 100 }) };
        if (sk && sk.startsWith("mission#")) {
          return sk.includes("weekly") ? { Item: missionItem({ missions: [{ id: "w1" }] }) } : {};
        }
        return {};
      }
      return {};
    });
    hoisted.generateObject.mockRejectedValueOnce(new Error("ai down"));
    const missions = await getMissions("a@b.c", "free");
    expect(missions.length).toBe(4);
    const dailies = missions.filter((m) => m.period === "daily");
    expect(dailies).toHaveLength(3);
    expect(new Set(dailies.map((m) => m.type))).toEqual(
      new Set(["aprender", "construir", "explorar"]),
    );
  });

  it("genera misión semanal con IA cuando falta", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ totalXp: 100 }) };
        if (sk && sk.startsWith("mission#")) {
          return sk.includes("weekly") ? {} : { Item: missionItem({ missions: [{ id: "d1" }] }) };
        }
        return {};
      }
      return {};
    });
    hoisted.generateObject.mockResolvedValueOnce({
      object: {
        mission: { title: "Semanal", description: "Desc", completionCriteria: { eventType: "agent_used", count: 15 } },
      },
    });
    const missions = await getMissions("a@b.c", "free");
    expect(missions.length).toBe(2);
    const weekly = missions.find((m) => m.period === "weekly");
    expect(weekly!.title).toBe("Semanal");
    expect(weekly!.difficulty).toBe("extremo");
  });

  it("genera misión semanal por defecto cuando la IA falla", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ totalXp: 100 }) };
        if (sk && sk.startsWith("mission#")) {
          return sk.includes("weekly") ? {} : { Item: missionItem({ missions: [{ id: "d1" }] }) };
        }
        return {};
      }
      return {};
    });
    hoisted.generateObject.mockRejectedValueOnce(new Error("ai down"));
    const missions = await getMissions("a@b.c", "free");
    const weekly = missions.find((m) => m.period === "weekly");
    expect(weekly!.title).toBe("Maratón de Código");
  });

  it("misionero intermedio según nivel", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ totalXp: 20000 }) };
        if (sk && sk.startsWith("mission#")) {
          return sk.includes("weekly") ? { Item: missionItem({ missions: [{ id: "w1" }] }) } : {};
        }
        return {};
      }
      return {};
    });
    hoisted.generateObject.mockResolvedValueOnce({
      object: {
        missions: [
          { type: "aprender", title: "T1", description: "D1", completionCriteria: { eventType: "chat_sent", count: 1 } },
          { type: "construir", title: "T2", description: "D2", completionCriteria: { eventType: "file_created", count: 1 } },
          { type: "explorar", title: "T3", description: "D3", completionCriteria: { eventType: "preview_opened", count: 1 } },
        ],
      },
    });
    const missions = await getMissions("a@b.c", "free");
    const dailies = missions.filter((m) => m.period === "daily");
    expect(dailies[0].difficulty).toBe("intermedio");
  });
});

describe("completeMission", () => {
  function baseMission(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      type: "aprender",
      title: "M",
      description: "D",
      xpReward: 100,
      quotaReward: 5000,
      difficulty: "novato",
      completed: false,
      completionCriteria: { eventType: "chat_sent", count: 1 },
      ...overrides,
    };
  }

  it("misión inexistente → success false", async () => {
    routeDdb({ profile: profileItem() });
    const res = await completeMission("a@b.c", "m1", "free");
    expect(res.success).toBe(false);
  });

  it("misión ya completada → success false", async () => {
    routeDdb({
      profile: profileItem(),
      daily: missionItem({ missions: [baseMission("m1", { completed: true })] }),
    });
    const res = await completeMission("a@b.c", "m1", "free");
    expect(res.success).toBe(false);
  });

  it("condición fallida (race) → success false", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk === "xp#profile") {
        return { Item: profileItem({ streakDays: 3 }) };
      }
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk.startsWith("mission#")) {
        return { Item: missionItem({ missions: [baseMission("m1")] }) };
      }
      if (cmd instanceof hoisted.PutCommand) {
        const err = new Error("conditional") as any;
        err.name = "ConditionalCheckFailedException";
        throw err;
      }
      return {};
    });
    const res = await completeMission("a@b.c", "m1", "free");
    expect(res.success).toBe(false);
  });

  it("completa misión diaria con bonus de streak", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ streakDays: 3, totalXp: 100 }) };
        if (sk && sk.startsWith("mission#")) {
          return { Item: missionItem({ missions: [baseMission("m1")] }) };
        }
        return {};
      }
      return {};
    });
    const res = await completeMission("a@b.c", "m1", "free");
    expect(res.success).toBe(true);
    expect(res.streakDays).toBe(3);
    expect(res.quotaAwarded).toBe(5000 + 10_000); // mission + streak_3
    expect(res.xpAwarded).toBe(100);
  });

  it("completa misión semanal (id -W-semanal)", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk;
        if (sk === "xp#profile") return { Item: profileItem({ streakDays: 1, totalXp: 100 }) };
        if (sk && sk.startsWith("mission#")) {
          return { Item: missionItem({ missions: [baseMission("2026-W20-semanal")] }) };
        }
        return {};
      }
      return {};
    });
    const res = await completeMission("a@b.c", "2026-W20-semanal", "free");
    expect(res.success).toBe(true);
    const get = hoisted.send.mock.calls
      .map((c: any) => c[0])
      .find((c: any) => c instanceof hoisted.GetCommand && c.input.Key.sk.startsWith("mission#weekly"));
    expect(get.input.Key.sk).toBe("mission#weekly#2026-W20");
  });

  it("excepción no-condicional en PutCommand se propaga", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk === "xp#profile") {
        return { Item: profileItem() };
      }
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.sk.startsWith("mission#")) {
        return { Item: missionItem({ missions: [baseMission("m1")] }) };
      }
      if (cmd instanceof hoisted.PutCommand) throw new Error("ddb exploded");
      return {};
    });
    await expect(completeMission("a@b.c", "m1", "free")).rejects.toThrow("ddb exploded");
  });
});

describe("getEffectiveQuota", () => {
  it("retorna effectiveDailyQuota del perfil", async () => {
    routeDdb({
      profile: profileItem({ totalXp: 100, earnedQuota: 50_000 }),
    });
    const quota = await getEffectiveQuota("a@b.c", "free");
    expect(quota).toBe(Math.min(150_000 + 50_000, 300_000));
  });

  it("retorna floor cuando getProfile falla", async () => {
    routeDdb({ profileError: new Error("boom") });
    const quota = await getEffectiveQuota("a@b.c", "pro");
    expect(quota).toBe(1_000_000);
  });
});
