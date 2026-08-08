/**
 * Admin API — unit tests.
 *
 * `awslambda` global is stubbed before import (streamifyResponse wrapper).
 * Mocks DynamoDB, jose, "ai" (streamText/tool/stepCountIs), "./chat.js" (getModel)
 * and sst. The mocked `tool()` returns the definition as-is so each admin tool's
 * `execute()` can be invoked directly with crafted inputs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStream, setupAwslambdaGlobal, makeEvent, type StreamHandler } from "../../tests/unit-helpers.js";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const jwtVerify = vi.fn();
  const createRemoteJWKSet = vi.fn(() => vi.fn());
  const streamText = vi.fn();
  const tool = vi.fn((def: unknown) => def);
  const stepCountIs = vi.fn(() => true);
  const getModel = vi.fn(() => ({ id: "gemini-2.5-flash", kind: "google" }));
  class BaseCmd {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  const GetCommand = class GetCommand extends BaseCmd {};
  const UpdateCommand = class UpdateCommand extends BaseCmd {};
  const ScanCommand = class ScanCommand extends BaseCmd {};
  const QueryCommand = class QueryCommand extends BaseCmd {};
  return {
    send,
    jwtVerify,
    createRemoteJWKSet,
    streamText,
    tool,
    stepCountIs,
    getModel,
    GetCommand,
    UpdateCommand,
    ScanCommand,
    QueryCommand,
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
  UpdateCommand: hoisted.UpdateCommand,
  ScanCommand: hoisted.ScanCommand,
  QueryCommand: hoisted.QueryCommand,
}));

vi.mock("sst", () => ({
  Resource: {
    TokenUsage: { name: "token-usage" },
    Transactions: { name: "transactions" },
    Conversations: { name: "conversations" },
    Projects: { name: "projects" },
    UserKeys: { name: "user-keys" },
  },
}));

vi.mock("./chat.js", () => ({ getModel: hoisted.getModel }));

vi.mock("ai", () => ({
  streamText: hoisted.streamText,
  tool: hoisted.tool,
  stepCountIs: hoisted.stepCountIs,
}));

setupAwslambdaGlobal();

process.env.USERS_TABLE_NAME = "users";
process.env.USER_KEYS_TABLE_NAME = "user-keys";
process.env.ADMIN_EMAILS = "super@opitacode.com";

const adminMod = await import("./admin.js");
const handler = adminMod.handler as unknown as StreamHandler;

const streams: Array<AsyncGenerator<any>> = [];
function resetStreams() {
  streams.length = 0;
  hoisted.streamText.mockImplementation(() => ({
    fullStream: streams.shift() || (async function* () {})(),
  }));
}
resetStreams();

function pushChunks(chunks: any[]) {
  streams.push(
    (async function* () {
      for (const c of chunks) yield c;
    })(),
  );
}

function pushThrow(msg: string) {
  streams.push(
    (async function* () {
      throw new Error(msg);
    })(),
  );
}

function setToken(email: string | null, plan = "pro") {
  hoisted.jwtVerify.mockImplementation(async () => {
    if (email === null) throw new Error("invalid");
    return { payload: { email, plan, role: plan } };
  });
}

function configureDdb(cb: (cmd: any) => any) {
  hoisted.send.mockImplementation(async (cmd: any) => cb(cmd));
}

const AUTH = { authorization: "Bearer tok" };

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.jwtVerify.mockReset();
  hoisted.streamText.mockReset();
  resetStreams();
  setToken("ops@test.com", "pro");
});

describe("admin handler — preflight y auth", () => {
  it("OPTIONS → 200 con {} ", async () => {
    const stream = createStream();
    await handler(makeEvent({ method: "OPTIONS", path: "/admin/x" }), stream, null);
    expect(stream.output).toBe("{}");
  });

  it("sin token → No autorizado", async () => {
    const stream = createStream();
    await handler({ headers: {}, body: "{}" }, stream, null);
    expect(stream.output).toContain("No autorizado");
  });

  it("token inválido → Token inválido", async () => {
    setToken(null);
    const stream = createStream();
    await handler({ headers: AUTH, body: "{}" }, stream, null);
    expect(stream.output).toContain("Token inválido");
  });

  it("usuario sin rol de admin → Acceso denegado", async () => {
    configureDdb((cmd: any) => (cmd instanceof hoisted.GetCommand ? { Item: { email: "ops@test.com" } } : {}));
    const stream = createStream();
    await handler({ headers: AUTH, body: "{}" }, stream, null);
    expect(stream.output).toContain("Acceso denegado");
  });

  it("whoami como superadmin (ADMIN_EMAILS)", async () => {
    setToken("super@opitacode.com", "pro");
    configureDdb((cmd: any) => (cmd instanceof hoisted.GetCommand ? { Item: { email: "super@opitacode.com" } } : {}));
    const stream = createStream();
    await handler({ headers: AUTH, body: JSON.stringify({ action: "whoami" }) }, stream, null);
    const data = JSON.parse(stream.output);
    expect(data.email).toBe("super@opitacode.com");
    expect(data.role).toBe("superadmin");
  });

  it("whoami como admin por admin_role en DDB", async () => {
    configureDdb((cmd: any) =>
      cmd instanceof hoisted.GetCommand ? { Item: { email: "ops@test.com", admin_role: "product_admin" } } : {},
    );
    const stream = createStream();
    await handler({ headers: AUTH, body: JSON.stringify({ action: "whoami" }) }, stream, null);
    expect(JSON.parse(stream.output).role).toBe("product_admin");
  });

  it("autentica por cookie __opita_session", async () => {
    configureDdb((cmd: any) =>
      cmd instanceof hoisted.GetCommand ? { Item: { email: "ops@test.com", admin_role: "support" } } : {},
    );
    const stream = createStream();
    await handler(
      { headers: { cookie: "__opita_session=tok; other=1" }, body: JSON.stringify({ action: "whoami" }) },
      stream,
      null,
    );
    expect(JSON.parse(stream.output).role).toBe("support");
  });
});

describe("admin handler — action chat", () => {
  function adminRouter(role: string) {
    return (cmd: any) =>
      cmd instanceof hoisted.GetCommand ? { Item: { email: "ops@test.com", admin_role: role } } : {};
  }

  it("streams chunks de texto con system prompt de Sync", async () => {
    configureDdb(adminRouter("superadmin"));
    pushChunks([
      { type: "text-delta", textDelta: "hola admin" },
      { type: "reasoning", textDelta: "razono" },
      { type: "tool-call", toolName: "list_users", args: { limit: 5 } },
      { type: "tool-result", toolName: "list_users", result: { ok: true } },
    ]);
    const stream = createStream();
    await handler(
      { headers: AUTH, body: JSON.stringify({ action: "chat", messages: [{ role: "user", content: "lista usuarios" }] }) },
      stream,
      null,
    );
    const call = hoisted.streamText.mock.calls[0][0];
    expect(call.system).toContain("Opita Sync");
    expect(call.model.id).toBe("gemini-2.5-flash");
    expect(call.stopWhen).toBe(true);
    expect(stream.output).toContain("hola admin");
    expect(stream.output).toContain("razono");
    expect(stream.output).toContain("tool_call");
    expect(stream.output).toContain("tool_result");
    expect(stream.output).toContain("[DONE]");
  });

  it("error en el stream → mensaje de error", async () => {
    configureDdb(adminRouter("superadmin"));
    pushThrow("explosion");
    const stream = createStream();
    await handler(
      { headers: AUTH, body: JSON.stringify({ action: "chat", messages: [{ role: "user", content: "x" }] }) },
      stream,
      null,
    );
    expect(stream.output).toContain("**Error:** explosion");
    expect(stream.output).toContain("[DONE]");
  });

  it("body inválido → trata como chat vacío", async () => {
    configureDdb(adminRouter("superadmin"));
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handler({ headers: AUTH, body: "{not-json" }, stream, null);
    expect(stream.output).toContain("ok");
  });
});

describe("admin tools — read-only", () => {
  function loadTools(role: string, item: Record<string, unknown> = {}) {
    configureDdb((cmd: any) => (cmd instanceof hoisted.GetCommand ? { Item: { ...item, admin_role: role } } : {}));
    return { tools: null as any, streamTextCalls: hoisted.streamText.mock.calls };
  }

  function getToolsFor(role: string, userItem: Record<string, unknown> = {}): Record<string, any> {
    configureDdb((cmd: any) => (cmd instanceof hoisted.GetCommand ? { Item: { ...userItem, admin_role: role } } : {}));
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    return handler({ headers: AUTH, body: JSON.stringify({ action: "chat", messages: [{ role: "user", content: "x" }] }) }, stream, null).then(() => {
      const call = hoisted.streamText.mock.calls[0][0];
      return call.tools;
    });
  }

  it("list_users mapea y filtra por búsqueda", async () => {
    const tools = await getToolsFor("superadmin", { email: "x@test.com", name: "Ana" });
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) {
        return {
          Items: [
            { email: "ana@test.com", name: "Ana", plan: "pro", last_login: "2024-01-01", created_at: "2023-01-01", trial_ends_at: null, subscription_ends_at: null, cognito_sub: "c", admin_role: null },
            { email: "pepe@test.com", name: "Pepe", plan: "free", last_login: null, created_at: null },
          ],
          ScannedCount: 2,
        };
      }
      return {};
    });
    const res = await tools.list_users.execute({ plan_filter: "pro", limit: 25, search: "ana" });
    expect(res.total_returned).toBe(1);
    expect(res.users[0].email).toBe("ana@test.com");
    expect(res.users[0].cognito_sub).toBe("✓");
    expect(res.users[0].name).toBe("Ana");
  });

  it("list_users sin filtro de plan ni búsqueda", async () => {
    const tools = await getToolsFor("superadmin");
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) return { Items: [{ email: "a@x.com" }], ScannedCount: 1 };
      return {};
    });
    const res = await tools.list_users.execute({ plan_filter: "all", limit: 10 });
    expect(res.total_returned).toBe(1);
    expect(res.users[0].plan).toBe("free");
  });

  it("get_user retorna detalle o error si no existe", async () => {
    const tools = await getToolsFor("superadmin");
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        return { Item: { email: "a@x.com", name: "A", plan: "pro", password_hash: "hash", cognito_sub: "c", created_at: "2023", last_login: "2024", trial_ends_at: null, subscription_ends_at: null, daily_subagent_count: 2, admin_role: "support" } };
      }
      return {};
    });
    const found = await tools.get_user.execute({ email: "a@x.com" });
    expect(found.has_password).toBe(true);
    expect(found.daily_subagent_count).toBe(2);

    configureDdb((cmd: any) => (cmd instanceof hoisted.GetCommand ? {} : {}));
    const missing = await tools.get_user.execute({ email: "nobody@x.com" });
    expect(missing.error).toContain("no encontrado");
  });

  it("get_usage_overview por usuario", async () => {
    const tools = await getToolsFor("superadmin");
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.GetCommand) {
        const sk = cmd.input.Key?.sk || "";
        if (sk.startsWith("daily#")) return { Item: { tokensUsed: 100 } };
        if (sk.startsWith("hourly#")) return { Item: { tokensUsed: 7 } };
        return {};
      }
      return {};
    });
    const res = await tools.get_usage_overview.execute({ email: "a@x.com" });
    expect(res.daily_tokens_used).toBe(100);
    expect(res.hourly_tokens_used).toBe(7);
    expect(res.email).toBe("a@x.com");
  });

  it("get_usage_overview global cuenta por plan", async () => {
    const tools = await getToolsFor("superadmin");
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) {
        return { Items: [{ plan: "free" }, { plan: "pro" }, { plan: "pro" }, {}], ScannedCount: 4 };
      }
      return {};
    });
    const res = await tools.get_usage_overview.execute({});
    expect(res.total_users).toBe(4);
    expect(res.by_plan).toEqual({ free: 2, estudiante: 0, pro: 2 });
  });

  it("list_transactions mapea transacciones", async () => {
    const tools = await getToolsFor("superadmin");
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) {
        return {
          Items: [{ id: "t1", email: "a@x.com", amount: 100, currency: "COP", status: "APPROVED", product: "VIBE_PRO", created_at: "2024-01-01" }],
          ScannedCount: 1,
        };
      }
      return {};
    });
    const res = await tools.list_transactions.execute({ limit: 20 });
    expect(res.total).toBe(1);
    expect(res.transactions[0].id).toBe("t1");
  });

  it("system_health cuenta tablas y maneja errores", async () => {
    const tools = await getToolsFor("superadmin");
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) {
        if (cmd.input.TableName === "conversations") throw new Error("no table");
        return { Count: 3 };
      }
      return {};
    });
    const res = await tools.system_health.execute({});
    expect(res.tables.Users).toBe(3);
    expect(res.tables.Conversations).toBe(-1);
    expect(res.environment).toBeDefined();
  });
});

describe("admin tools — write (superadmin/product_admin)", () => {
  async function getTools(role: string): Promise<Record<string, any>> {
    configureDdb((cmd: any) => (cmd instanceof hoisted.GetCommand ? { Item: { email: "ops@test.com", admin_role: role } } : {}));
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handler({ headers: AUTH, body: JSON.stringify({ action: "chat", messages: [{ role: "user", content: "x" }] }) }, stream, null);
    return hoisted.streamText.mock.calls[0][0].tools;
  }

  it("update_user_plan cambia el plan sin trial", async () => {
    const tools = await getTools("superadmin");
    const updates: any[] = [];
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const res = await tools.update_user_plan.execute({ email: "a@x.com", new_plan: "pro" });
    expect(res.success).toBe(true);
    expect(res.modified_by).toBe("ops@test.com");
    expect(updates[0].ExpressionAttributeValues[":plan"]).toBe("pro");
    expect(updates[0].ConditionExpression).toBe("attribute_exists(email)");
  });

  it("update_user_plan con trial_days", async () => {
    const tools = await getTools("superadmin");
    const updates: any[] = [];
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const res = await tools.update_user_plan.execute({ email: "a@x.com", new_plan: "estudiante", trial_days: 7 });
    expect(res.success).toBe(true);
    expect(res.trial_days).toBe(7);
    expect(updates[0].ExpressionAttributeValues[":trial"]).toBeDefined();
  });

  it("set_admin_role asigna rol (solo superadmin)", async () => {
    const tools = await getTools("superadmin");
    const updates: any[] = [];
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const res = await tools.set_admin_role.execute({ email: "a@x.com", role: "support" });
    expect(res.success).toBe(true);
    expect(updates[0].UpdateExpression).toContain("SET admin_role");
  });

  it("set_admin_role revoca rol", async () => {
    const tools = await getTools("superadmin");
    const updates: any[] = [];
    configureDdb((cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const res = await tools.set_admin_role.execute({ email: "a@x.com", role: null });
    expect(res.role).toBe("revoked");
    expect(updates[0].UpdateExpression).toContain("REMOVE admin_role");
  });

  it("set_admin_role denegado para product_admin", async () => {
    const tools = await getTools("product_admin");
    const res = await tools.set_admin_role.execute({ email: "a@x.com", role: "support" });
    expect(res.error).toContain("Solo superadmin");
  });

  it("roles sin write tools (support/viewer)", async () => {
    const support = await getTools("support");
    expect(support.update_user_plan).toBeUndefined();
    expect(support.set_admin_role).toBeUndefined();
    expect(support.list_users).toBeDefined();
    const viewer = await getTools("viewer");
    expect(viewer.update_user_plan).toBeUndefined();
  });
});
