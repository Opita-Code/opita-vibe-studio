/**
 * Core API — unit tests.
 *
 * Mocks DynamoDB (lib-dynamodb), jose (JWT), sst Resource, and gamification.
 * Calls `handler(event)` directly with plain API Gateway events.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEvent, responseBody } from "../../tests/unit-helpers.js";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const jwtVerify = vi.fn();
  const createRemoteJWKSet = vi.fn(() => vi.fn());
  const getProfile = vi.fn();
  const getMissions = vi.fn();
  const completeMission = vi.fn();
  const awardXP = vi.fn();
  const getEffectiveQuota = vi.fn();
  class BaseCmd {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  const GetCommand = class GetCommand extends BaseCmd {};
  const PutCommand = class PutCommand extends BaseCmd {};
  const QueryCommand = class QueryCommand extends BaseCmd {};
  const UpdateCommand = class UpdateCommand extends BaseCmd {};
  const BatchWriteCommand = class BatchWriteCommand extends BaseCmd {};
  return {
    send,
    jwtVerify,
    createRemoteJWKSet,
    getProfile,
    getMissions,
    completeMission,
    awardXP,
    getEffectiveQuota,
    GetCommand,
    PutCommand,
    QueryCommand,
    UpdateCommand,
    BatchWriteCommand,
  };
});

vi.mock("jose", () => ({
  jwtVerify: hoisted.jwtVerify,
  createRemoteJWKSet: hoisted.createRemoteJWKSet,
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    constructor(_config?: unknown) {}
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: hoisted.send }) },
  GetCommand: hoisted.GetCommand,
  PutCommand: hoisted.PutCommand,
  QueryCommand: hoisted.QueryCommand,
  UpdateCommand: hoisted.UpdateCommand,
  BatchWriteCommand: hoisted.BatchWriteCommand,
}));

vi.mock("sst", () => ({
  Resource: {
    Projects: { name: "projects" },
    TokenUsage: { name: "token-usage" },
    AnalyticsEvents: { name: "analytics" },
  },
}));

vi.mock("./gamification.js", () => ({
  getProfile: hoisted.getProfile,
  getMissions: hoisted.getMissions,
  completeMission: hoisted.completeMission,
  awardXP: hoisted.awardXP,
  getEffectiveQuota: hoisted.getEffectiveQuota,
}));

import { handler } from "./core.js";

process.env.USERS_TABLE_NAME = "users";
process.env.TOKEN_USAGE_TABLE_NAME = "token-usage";

const AUTH = { authorization: "Bearer ocais-token" };

function setTokenValid(claims: Record<string, unknown> = { plan: "pro", email: "user@test.com" }) {
  hoisted.jwtVerify.mockImplementation(async () => ({ payload: claims }));
}

function setTokenInvalid() {
  hoisted.jwtVerify.mockRejectedValue(new Error("invalid token"));
}

/** Dispatches the DynamoDB `send` mock based on the command shape. */
function routeDdb(router: (cmd: { input: any }) => any) {
  hoisted.send.mockImplementation(async (cmd: { input: any }) => router(cmd));
}

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.jwtVerify.mockReset();
  hoisted.getProfile.mockReset();
  hoisted.getMissions.mockReset();
  hoisted.completeMission.mockReset();
  hoisted.awardXP.mockReset();
  hoisted.getEffectiveQuota.mockReset();
  hoisted.getEffectiveQuota.mockResolvedValue(0);
  setTokenValid();
});

describe("core handler — preflight & routing", () => {
  it("responde OPTIONS con 200 y CORS", async () => {
    const res = await handler(makeEvent({ method: "OPTIONS", path: "/core/projects" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://opitacode.com");
  });

  it("CORS refleja orígenes opitacode válidos", async () => {
    const res = await handler(
      makeEvent({ method: "OPTIONS", headers: { origin: "https://app.opitacode.com" } }),
    );
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://app.opitacode.com");
  });

  it("CORS bloquea orígenes arbitrarios (default)", async () => {
    const res = await handler(
      makeEvent({ method: "OPTIONS", headers: { origin: "https://evil.com" } }),
    );
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://opitacode.com");
  });

  it("decodifica body base64 antes de parsearlo", async () => {
    const putInputs: any[] = [];
    routeDdb((cmd: any) => {
      if (cmd instanceof hoisted.PutCommand) putInputs.push(cmd.input);
      return {};
    });
    const body = Buffer.from(JSON.stringify({ title: "x", description: "y" })).toString("base64");
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/projects",
        headers: AUTH,
        body,
        isBase64Encoded: true,
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(putInputs).toHaveLength(1);
  });

  it("retorna 404 para rutas desconocidas", async () => {
    const res = await handler(makeEvent({ method: "GET", path: "/core/nope" }));
    expect(res.statusCode).toBe(404);
  });

  it("retorna 500 cuando el handler lanza error", async () => {
    routeDdb(() => {
      throw new Error("boom");
    });
    const res = await handler(makeEvent({ method: "GET", path: "/core/projects", headers: AUTH }));
    expect(res.statusCode).toBe(500);
    expect(responseBody(res).error).toContain("Internal");
  });
});

describe("core handler — /projects", () => {
  it("GET sin sesión → 401", async () => {
    setTokenInvalid();
    const res = await handler(makeEvent({ method: "GET", path: "/core/projects" }));
    expect(res.statusCode).toBe(401);
  });

  it("GET con sesión → lista proyectos ordenados por created_at desc", async () => {
    routeDdb((cmd: any) => {
      if (cmd.input.TableName === "projects") {
        return {
          Items: [
            { id: "old", created_at: "2020-01-01T00:00:00.000Z" },
            { id: "new", created_at: "2024-01-01T00:00:00.000Z" },
          ],
        };
      }
      return {};
    });
    const res = await handler(makeEvent({ method: "GET", path: "/core/projects", headers: AUTH }));
    expect(res.statusCode).toBe(200);
    const items = JSON.parse(res.body);
    expect(items[0].id).toBe("new");
    expect(items[1].id).toBe("old");
  });

  it("GET con sesión → lista vacía cuando no hay Items", async () => {
    routeDdb(() => ({}));
    const res = await handler(makeEvent({ method: "GET", path: "/core/projects", headers: AUTH }));
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it("POST sin title/description → 400", async () => {
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({ method: "POST", path: "/core/projects", headers: AUTH, body: "{}" }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("POST válido → 201 y PutCommand con el proyecto", async () => {
    const putInputs: any[] = [];
    routeDdb((cmd: any) => {
      if (cmd instanceof hoisted.PutCommand) putInputs.push(cmd.input);
      return {};
    });
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/projects",
        headers: AUTH,
        body: JSON.stringify({ title: "Hola", description: "Mundo" }),
      }),
    );
    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body)[0];
    expect(created.client_id).toBe("user@test.com");
    expect(created.status).toBe("PENDING");
    expect(putInputs).toHaveLength(1);
    expect(putInputs[0].TableName).toBe("projects");
  });
});

describe("core handler — /events/ingest", () => {
  const ingestBody = (events: any[], extra: any = {}) =>
    JSON.stringify({ events, sessionId: "sess-1", productId: "vibe-studio", ...extra });

  it("rate-limit alcanzado → 429", async () => {
    routeDdb((cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.pk.startsWith("events-rl")) {
        return { Item: { requestCount: 10 } };
      }
      return {};
    });
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/events/ingest",
        body: ingestBody([{ type: "page_view", source: "app" }]),
      }),
    );
    expect(res.statusCode).toBe(429);
  });

  it("JSON inválido → 400", async () => {
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({ method: "POST", path: "/core/events/ingest", body: "{not-json" }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("events ausente o vacío → 400", async () => {
    routeDdb(() => ({}));
    let res = await handler(makeEvent({ method: "POST", path: "/core/events/ingest", body: "{}" }));
    expect(res.statusCode).toBe(400);
    res = await handler(
      makeEvent({ method: "POST", path: "/core/events/ingest", body: JSON.stringify({ events: [] }) }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("batch > 25 → 400", async () => {
    routeDdb(() => ({}));
    const events = Array.from({ length: 26 }, () => ({ type: "page_view", source: "app" }));
    const res = await handler(
      makeEvent({ method: "POST", path: "/core/events/ingest", body: ingestBody(events) }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("todos los eventos inválidos → 200 con accepted 0 y skipped", async () => {
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/events/ingest",
        body: ingestBody([
          { type: "unknown_event", source: "app" },
          { type: "page_view", source: "bad-source" },
        ]),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(responseBody(res)).toEqual({ accepted: 0, skipped: 2 });
  });

  it("mezcla de eventos válidos e inválidos → 202 con counts correctos", async () => {
    const batchInputs: any[] = [];
    const rlUpdates: any[] = [];
    routeDdb((cmd: any) => {
      if (cmd instanceof hoisted.GetCommand && cmd.input.Key?.pk.startsWith("events-rl")) {
        return { Item: { requestCount: 1 } };
      }
      if (cmd instanceof hoisted.UpdateCommand) rlUpdates.push(cmd.input);
      if (cmd instanceof hoisted.BatchWriteCommand) batchInputs.push(cmd.input);
      return {};
    });
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/events/ingest",
        headers: { ...AUTH, "user-agent": "test-agent" },
        body: ingestBody([
          { type: "page_view", source: "app", timestamp: "2024-01-01T00:00:00.000Z" },
          { type: "bogus", source: "app" },
        ]),
      }),
    );
    expect(res.statusCode).toBe(202);
    expect(responseBody(res)).toEqual({ accepted: 1, skipped: 1 });
    expect(rlUpdates.length).toBe(1);
    expect(rlUpdates[0].UpdateExpression).toContain("ADD requestCount");
    const items = batchInputs[0].RequestItems["analytics"];
    expect(items).toHaveLength(1);
    expect(items[0].PutRequest.Item.pk).toBe("events#user@test.com");
    expect(items[0].PutRequest.Item.productId).toBe("vibe-studio");
    expect(items[0].PutRequest.Item.userAgent).toBe("test-agent");
  });

  it("productId inválido cae a vibe-studio", async () => {
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/events/ingest",
        headers: AUTH,
        body: ingestBody([{ type: "page_view", source: "app" }], { productId: "nope" }),
      }),
    );
    expect(res.statusCode).toBe(202);
  });

  it("error de BatchWrite → 500", async () => {
    routeDdb((cmd: any) => {
      if (cmd instanceof hoisted.BatchWriteCommand) throw new Error("ddb down");
      return {};
    });
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/events/ingest",
        body: ingestBody([{ type: "page_view", source: "app" }]),
      }),
    );
    expect(res.statusCode).toBe(500);
  });

  it("identifica usuario desde cookie cuando no hay Bearer", async () => {
    const batchInputs: any[] = [];
    routeDdb((cmd: any) => {
      if (cmd instanceof hoisted.BatchWriteCommand) batchInputs.push(cmd.input);
      return {};
    });
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/events/ingest",
        headers: { cookie: "__opita_session=cookie-token" },
        body: ingestBody([{ type: "page_view", source: "app" }]),
      }),
    );
    expect(res.statusCode).toBe(202);
    expect(batchInputs[0].RequestItems["analytics"][0].PutRequest.Item.pk).toBe(
      "events#user@test.com",
    );
  });
});

describe("core handler — /usage", () => {
  it("sin sesión → 401", async () => {
    setTokenInvalid();
    const res = await handler(makeEvent({ method: "GET", path: "/core/usage" }));
    expect(res.statusCode).toBe(401);
  });

  it("con plan pro → límites pro + contadores", async () => {
    routeDdb((cmd: any) => {
      if (cmd.input.Key?.sk.startsWith("daily#")) return { Item: { tokensUsed: 1000 } };
      if (cmd.input.Key?.sk.startsWith("hourly#")) return { Item: { tokensUsed: 50 } };
      return {};
    });
    const res = await handler(makeEvent({ method: "GET", path: "/core/usage", headers: AUTH }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.plan).toBe("pro");
    expect(body.tokensUsedToday).toBe(1000);
    expect(body.tokensLimitDaily).toBe(1_000_000);
    expect(body.tokensLimitDailyBase).toBe(1_000_000);
    expect(body.tokensLimitHourly).toBe(200_000);
    expect(body.tokensUsedThisHour).toBe(50);
    expect(body.resetDailyAt).toBeDefined();
    expect(body.resetHourlyAt).toBeDefined();
  });

  it("plan desde DDB cuando el JWT no trae plan", async () => {
    hoisted.jwtVerify.mockImplementation(async () => ({ payload: { email: "u@test.com" } }));
    routeDdb((cmd: any) => {
      if (cmd.input.TableName === "users") return { Item: { plan: "estudiante" } };
      return {};
    });
    const res = await handler(makeEvent({ method: "GET", path: "/core/usage", headers: AUTH }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).plan).toBe("estudiante");
    expect(JSON.parse(res.body).tokensLimitDailyBase).toBe(250_000);
  });

  it("plan free cuando DDB no trae plan", async () => {
    hoisted.jwtVerify.mockImplementation(async () => ({ payload: { email: "u@test.com" } }));
    routeDdb((cmd: any) => {
      if (cmd.input.TableName === "users") return { Item: {} };
      return {};
    });
    const res = await handler(makeEvent({ method: "GET", path: "/core/usage", headers: AUTH }));
    expect(JSON.parse(res.body).plan).toBe("free");
    expect(JSON.parse(res.body).tokensLimitDailyBase).toBe(150_000);
  });

  it("con bonus de gamificación → effectiveDailyLimit usa el máximo", async () => {
    hoisted.getEffectiveQuota.mockResolvedValue(2_000_000);
    routeDdb(() => ({}));
    const res = await handler(makeEvent({ method: "GET", path: "/core/usage", headers: AUTH }));
    expect(JSON.parse(res.body).tokensLimitDaily).toBe(2_000_000);
  });

  it("si gamification falla → effectiveDailyLimit = quota base", async () => {
    hoisted.getEffectiveQuota.mockRejectedValue(new Error("gamification down"));
    routeDdb(() => ({}));
    const res = await handler(makeEvent({ method: "GET", path: "/core/usage", headers: AUTH }));
    expect(JSON.parse(res.body).tokensLimitDaily).toBe(1_000_000);
  });
});

describe("core handler — gamification", () => {
  it("GET /gamification → 200 profile", async () => {
    hoisted.getProfile.mockResolvedValue({ totalXp: 10 });
    routeDdb(() => ({}));
    const res = await handler(makeEvent({ method: "GET", path: "/core/gamification", headers: AUTH }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ totalXp: 10 });
  });

  it("POST /gamification/missions → 200 missions", async () => {
    hoisted.getMissions.mockResolvedValue([{ id: "m1" }]);
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({ method: "POST", path: "/core/gamification/missions", headers: AUTH }),
    );
    expect(JSON.parse(res.body)).toEqual({ missions: [{ id: "m1" }] });
  });

  it("POST /gamification/missions/<id>/complete → 200 result", async () => {
    hoisted.completeMission.mockResolvedValue({ success: true });
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({ method: "POST", path: "/core/gamification/missions/x/complete", headers: AUTH }),
    );
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });

  it("POST /gamification/xp/award con acción permitida → 200", async () => {
    hoisted.awardXP.mockResolvedValue({ xpAwarded: 5 });
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/gamification/xp/award",
        headers: AUTH,
        body: JSON.stringify({ action: "chat_message" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ xpAwarded: 5 });
  });

  it("POST /gamification/xp/award con acción no permitida → 403", async () => {
    routeDdb(() => ({}));
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/core/gamification/xp/award",
        headers: AUTH,
        body: JSON.stringify({ action: "hack" }),
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("endpoints de gamificación sin sesión → 401", async () => {
    setTokenInvalid();
    let res = await handler(makeEvent({ method: "GET", path: "/core/gamification" }));
    expect(res.statusCode).toBe(401);
    res = await handler(makeEvent({ method: "POST", path: "/core/gamification/missions" }));
    expect(res.statusCode).toBe(401);
    res = await handler(makeEvent({ method: "POST", path: "/core/gamification/xp/award" }));
    expect(res.statusCode).toBe(401);
  });
});
