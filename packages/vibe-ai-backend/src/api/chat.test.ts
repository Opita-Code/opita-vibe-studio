/**
 * Chat API — unit tests.
 *
 * The handler is an `awslambda.streamifyResponse` wrapper, so the global
 * `awslambda` is stubbed before importing the module. DynamoDB, jose, the
 * AI SDK ("ai"), provider factories and gamification are mocked; streaming
 * chunks are injected through a controllable `streamText.fullStream`.
 *
 * Two module loads exercise different provider configs:
 *   - Load A: no Google key (HAS_GOOGLE_AI=false, HAS_DEEPSEEK=true)
 *   - Load B: Google + DeepSeek available (fallback branches)
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { createStream, setupAwslambdaGlobal, type StreamHandler } from "../../tests/unit-helpers.js";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const jwtVerify = vi.fn();
  const createRemoteJWKSet = vi.fn(() => vi.fn());
  const streamText = vi.fn();
  const jsonSchema = vi.fn((s: unknown) => s);
  const createOpenAI = vi.fn(() => ({ chat: (id: string) => ({ id, kind: "openai-chat" }) }));
  const createGoogleGenerativeAI = vi.fn(() => (id: string) => ({ id, kind: "google" }));
  const getEffectiveQuota = vi.fn();
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
    jwtVerify,
    createRemoteJWKSet,
    streamText,
    jsonSchema,
    createOpenAI,
    createGoogleGenerativeAI,
    getEffectiveQuota,
    GetCommand,
    PutCommand,
    UpdateCommand,
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
  PutCommand: hoisted.PutCommand,
  UpdateCommand: hoisted.UpdateCommand,
  QueryCommand: hoisted.QueryCommand,
}));

vi.mock("sst", () => ({ Resource: { TokenUsage: { name: "token-usage" } } }));

vi.mock("./gamification.js", () => ({ getEffectiveQuota: hoisted.getEffectiveQuota }));

vi.mock("ai", () => ({ streamText: hoisted.streamText, jsonSchema: hoisted.jsonSchema }));

vi.mock("@ai-sdk/openai", () => ({ createOpenAI: hoisted.createOpenAI }));

vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: hoisted.createGoogleGenerativeAI }));

setupAwslambdaGlobal();

process.env.USER_KEYS_TABLE_NAME = "user-keys";
process.env.USERS_TABLE_NAME = "users";
process.env.BYOK_ENCRYPTION_KEY = "unit-test-byok-key-2026!!";

// ─── Load A: no Google key, DeepSeek available ───────────────────
delete process.env.API_GOOGLE_CLOUD;
delete process.env.AI_STUDIO_GOOGLE;
delete process.env.GEMINI_API_KEY;
process.env.DEEP_SEEK_KEY = "ds-key";
process.env.OPENAI_API_KEY = "oa-key";
process.env.OPENROUTER_API_KEY = "or-key";

const chatA = await import("./chat.js");
const handlerA = chatA.handler as unknown as StreamHandler;

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

function setTokenValid(payload: Record<string, unknown> = { email: "u@test.com", plan: "free" }) {
  hoisted.jwtVerify.mockImplementation(async () => ({ payload }));
}

function setTokenInvalid() {
  hoisted.jwtVerify.mockRejectedValue(new Error("invalid"));
}

interface DdbOpts {
  dailyUsed?: number;
  hourlyUsed?: number;
  userKeyResult?: { Item?: Record<string, unknown> } | null;
  userKeyError?: boolean;
  userRecord?: { Item?: Record<string, unknown> } | null;
  rpmCount?: number;
  putError?: boolean;
  updateError?: boolean;
}

function configureDdb(opts: DdbOpts = {}): {
  puts: any[];
  updates: any[];
} {
  const captures = { puts: [] as any[], updates: [] as any[] };
  hoisted.send.mockImplementation(async (cmd: any) => {
    const input = cmd.input;
    if (cmd instanceof hoisted.GetCommand) {
      if (input.TableName === "user-keys") {
        if (opts.userKeyError) throw new Error("ddb error");
        return opts.userKeyResult ?? {};
      }
      if (input.TableName === "users") return opts.userRecord ?? {};
      const sk = input.Key?.sk || "";
      if (sk.startsWith("daily#")) return { Item: { tokensUsed: opts.dailyUsed ?? 0 } };
      if (sk.startsWith("hourly#")) return { Item: { tokensUsed: opts.hourlyUsed ?? 0 } };
      return {};
    }
    if (cmd instanceof hoisted.UpdateCommand) {
      const sk = input.Key?.sk || "";
      if (sk.startsWith("rpm#")) return { Attributes: { requestCount: opts.rpmCount ?? 1 } };
      captures.updates.push(input);
      if (opts.updateError) throw new Error("update failed");
      return {};
    }
    if (cmd instanceof hoisted.PutCommand) {
      captures.puts.push(input);
      if (opts.putError) throw new Error("put failed");
      return {};
    }
    return {};
  });
  return captures;
}

function chatEvent(payload: Record<string, unknown>, headers: Record<string, string> = { authorization: "Bearer tok" }) {
  return { headers, body: JSON.stringify(payload) };
}

const TEXT_CHUNKS = [
  { type: "text-delta", textDelta: "Hola desde el test" },
  { type: "reasoning", textDelta: "pensando..." },
  { type: "finish", totalUsage: { totalTokens: 42 } },
];

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.jwtVerify.mockReset();
  hoisted.streamText.mockReset();
  hoisted.getEffectiveQuota.mockReset();
  hoisted.getEffectiveQuota.mockResolvedValue(0);
  streams.length = 0;
  setTokenValid();
  resetStreams();
});

describe("chat handler — health check & auth (Load A)", () => {
  it("health_check responde sin auth", async () => {
    const stream = createStream();
    await handlerA({ headers: {}, body: JSON.stringify({ action: "health_check" }) }, stream, null);
    const data = JSON.parse(stream.output);
    expect(data.status).toBe("ok");
    expect(data.providers.deepseek).toBe(true);
    expect(data.providers.gemini).toBe(false);
    expect(data.providers.openai).toBe(true);
    expect(data.providers.openrouter).toBe(true);
    expect(data.auth.hasByokKey).toBe(true);
  });

  it("health_check con body inválido → cae a auth y da 401", async () => {
    const stream = createStream();
    await handlerA({ headers: {}, body: "{bad" }, stream, null);
    expect(stream.output).toContain("Falta token Bearer");
  });

  it("sin token → 401 Falta token", async () => {
    const stream = createStream();
    await handlerA({ headers: {}, body: "{}" }, stream, null);
    expect(stream.output).toContain("Falta token Bearer o cookie");
  });

  it("token inválido → 401 Token inválido", async () => {
    setTokenInvalid();
    const stream = createStream();
    await handlerA(chatEvent({ action: "chat", messages: [{ role: "user", content: "hi" }] }), stream, null);
    expect(stream.output).toContain("Token inválido");
  });
});

describe("chat handler — save_key (Load A)", () => {
  it("save_key sin customApiKey → error", async () => {
    configureDdb();
    const stream = createStream();
    await handlerA(chatEvent({ action: "save_key" }), stream, null);
    expect(stream.output).toContain("Falta customApiKey");
  });

  it("save_key guarda la llave cifrada en DynamoDB", async () => {
    const caps = configureDdb();
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "save_key", providerId: "deepseek", customApiKey: "sk-plaintext" }),
      stream,
      null,
    );
    expect(JSON.parse(stream.output).success).toBe(true);
    expect(caps.puts).toHaveLength(1);
    expect(caps.puts[0].TableName).toBe("user-keys");
    expect(caps.puts[0].Item.id).toBe("u@test.com#deepseek");
    expect(caps.puts[0].Item.encryptedKey).toContain(":");
    expect(caps.puts[0].Item.encryptedKey).not.toContain("sk-plaintext");
  });

  it("save_key falla en DynamoDB → error", async () => {
    configureDdb({ putError: true });
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "save_key", customApiKey: "sk-x" }),
      stream,
      null,
    );
    expect(stream.output).toContain("No se pudo guardar la llave");
  });
});

describe("chat handler — quota & monetization (Load A)", () => {
  it("subagent con plan free → upgrade_required", async () => {
    configureDdb();
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "subagent", subagentId: "sdd-apply", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("upgrade_required");
    expect(stream.output).toContain("Mejora tu plan");
  });

  it("cuota horaria excedida (free) → mensaje por hora", async () => {
    configureDdb({ dailyUsed: 0, hourlyUsed: 30_000 });
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    const data = JSON.parse(stream.output);
    expect(data.error).toBe("quota_exceeded");
    expect(data.message).toContain("por hora");
    expect(data.cooldownSeconds).toBeDefined();
    expect(data.tokensLimit).toBe(30_000);
    expect(data.tokensUsed).toBe(30_000);
  });

  it("cuota diaria excedida (free) → mensaje diario", async () => {
    configureDdb({ dailyUsed: 150_000, hourlyUsed: 0 });
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    const data = JSON.parse(stream.output);
    expect(data.error).toBe("quota_exceeded");
    expect(data.message).toContain("diario");
    expect(data.tokensLimit).toBe(150_000);
    expect(data.tokensUsed).toBe(150_000);
  });

  it("pro degradado por cuota → sigue, con warning en system prompt", async () => {
    setTokenValid({ email: "u@test.com", plan: "pro" });
    configureDdb({ hourlyUsed: 200_000 });
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "hola" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("ok");
    const call = hoisted.streamText.mock.calls[0][0];
    expect(call.system).toContain("modo optimizado");
    expect(call.model.id).toBe("deepseek-v4-flash");
  });
});

describe("chat handler — acciones y flujo de streaming (Load A)", () => {
  it("acción desconocida → Acción desconocida", async () => {
    configureDdb();
    const stream = createStream();
    await handlerA(chatEvent({ action: "bogus" }), stream, null);
    expect(JSON.parse(stream.output).error).toBe("Acción desconocida");
  });

  it("chat sin mensajes → aviso", async () => {
    configureDdb();
    const stream = createStream();
    await handlerA(chatEvent({ action: "chat" }), stream, null);
    expect(stream.output).toContain("No hay mensajes válidos");
  });

  it("solo mensajes assistant vacíos → aviso", async () => {
    configureDdb();
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "assistant", content: "" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("No hay mensajes válidos");
  });

  it("chat free con texto → streamText + recordUsage", async () => {
    const caps = configureDdb();
    pushChunks([...TEXT_CHUNKS]);
    const stream = createStream();
    await handlerA(
      chatEvent({
        action: "chat",
        messages: [
          { role: "system", content: "Eres Aura del test" },
          { role: "user", content: "hola" },
        ],
      }),
      stream,
      null,
    );
    expect(stream.output).toContain("Hola desde el test");
    expect(stream.output).toContain("pensando...");
    expect(stream.output).toContain("[DONE]");
    const call = hoisted.streamText.mock.calls[0][0];
    expect(call.system).toBe("Eres Aura del test");
    expect(call.model.kind).toBe("openai-chat");
    expect(call.model.id).toBe("deepseek-v4-flash");
    expect(call.messages).toHaveLength(1); // system promoted out of messages
    const usageUpdates = caps.updates.filter((u) => u.TableName === "token-usage");
    expect(usageUpdates.length).toBe(2); // daily + hourly
  });

  it("chat con attachments: imagen, URL de S3 y archivo de texto", async () => {
    configureDdb();
    pushChunks([{ type: "text-delta", textDelta: "procesado" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({
        action: "chat",
        messages: [
          {
            role: "user",
            content: "mira esto",
            attachments: [
              { contentType: "image/png", name: "a.png", data: "data:image/png;base64,xxx" },
              { contentType: "application/zip", name: "big.zip", data: "https://s3.example/big.zip" },
              { contentType: "text/plain", name: "code.txt", data: "console.log(1)" },
            ],
          },
        ],
      }),
      stream,
      null,
    );
    const call = hoisted.streamText.mock.calls[0][0];
    const parts = call.messages[0].content as any[];
    expect(parts.some((p) => p.type === "text")).toBe(true);
    expect(parts.some((p) => p.type === "image")).toBe(true);
    expect(parts.some((p) => p.type === "file")).toBe(true);
    expect(stream.output).toContain("procesado");
  });

  it("RPM límite excedido → aviso de velocidad", async () => {
    configureDdb({ rpmCount: 7 });
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("Límite de velocidad alcanzado");
    expect(stream.output).toContain("[DONE]");
  });

  it("pro con contexto de código → deepseek-v4-pro", async () => {
    setTokenValid({ email: "u@test.com", plan: "pro" });
    configureDdb();
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "arregla el backend.go y database.py" }] }),
      stream,
      null,
    );
    expect(hoisted.streamText.mock.calls[0][0].model.id).toBe("deepseek-v4-pro");
  });

  it("subagent pro fase cognitiva → deepseek-v4-pro", async () => {
    setTokenValid({ email: "u@test.com", plan: "pro" });
    configureDdb();
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "subagent", subagentId: "sdd-explore", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(hoisted.streamText.mock.calls[0][0].model.id).toBe("deepseek-v4-pro");
  });

  it("customTools se registran con prefijo custom_", async () => {
    configureDdb();
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({
        action: "chat",
        messages: [{ role: "user", content: "x" }],
        customTools: [
          { name: "greet", description: "Saluda", parameters: {} },
          { name: "", description: "sin nombre, se salta" },
        ],
      }),
      stream,
      null,
    );
    const tools = hoisted.streamText.mock.calls[0][0].tools;
    expect(tools.custom_greet).toBeDefined();
    expect(tools.read_file).toBeDefined();
    expect(tools.write_file).toBeDefined();
  });

  it("sin fallback disponible (deepseek falla, sin google) → error genérico", async () => {
    configureDdb();
    pushThrow("provider quota exceeded");
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("Se alcanzó el límite temporal del proveedor");
    expect(stream.output).toContain("[DONE]");
  });

  it("sin fallback disponible (error genérico)", async () => {
    configureDdb();
    pushThrow("ups algo se rompió");
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("Por favor intenta de nuevo");
  });
});

describe("chat handler — aws-managed keys (Load A)", () => {
  it("aws-managed sin llave guardada → error amigable", async () => {
    configureDdb({ userKeyResult: {} });
    const stream = createStream();
    await handlerA(
      chatEvent({
        action: "chat",
        customApiKey: "aws-managed",
        providerId: "deepseek",
        messages: [{ role: "user", content: "x" }],
      }),
      stream,
      null,
    );
    expect(stream.output).toContain("No tienes una llave guardada en AWS");
    expect(stream.output).toContain("[DONE]");
  });

  it("aws-managed con llave guardada → desencripta y procesa", async () => {
    // 1. guardar una llave
    const caps = configureDdb();
    const saveStream = createStream();
    await handlerA(
      chatEvent({ action: "save_key", providerId: "deepseek", customApiKey: "sk-secret-roundtrip" }),
      saveStream,
      null,
    );
    const encrypted = caps.puts[0].Item.encryptedKey;

    // 2. usarla con aws-managed
    configureDdb({ userKeyResult: { Item: { encryptedKey: encrypted } } });
    pushChunks([{ type: "text-delta", textDelta: "llave desencriptada" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({
        action: "chat",
        customApiKey: "aws-managed",
        providerId: "deepseek",
        messages: [{ role: "user", content: "x" }],
      }),
      stream,
      null,
    );
    expect(stream.output).toContain("llave desencriptada");
    const call = hoisted.streamText.mock.calls[0][0];
    expect(call.model.kind).toBe("openai-chat");
  });

  it("aws-managed con error de DynamoDB → error amigable", async () => {
    configureDdb({ userKeyError: true });
    const stream = createStream();
    await handlerA(
      chatEvent({
        action: "chat",
        customApiKey: "aws-managed",
        messages: [{ role: "user", content: "x" }],
      }),
      stream,
      null,
    );
    expect(stream.output).toContain("Error recuperando la llave cifrada");
  });
});

describe("chat handler — guard de subagent estudiante (Load A)", () => {
  it("estudiante dentro del límite → incrementa contador", async () => {
    setTokenValid({ email: "u@test.com", plan: "estudiante" });
    const caps = configureDdb({
      userRecord: { Item: { daily_subagent_count: 5, subagent_reset_date: new Date().toISOString().split("T")[0] } },
    });
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "subagent", subagentId: "sdd-apply", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    const userUpdate = caps.updates.find((u) => u.TableName === "users");
    expect(userUpdate).toBeDefined();
    expect(userUpdate.ExpressionAttributeValues[":count"]).toBe(6);
  });

  it("estudiante con fecha de reset distinta → reinicia el contador", async () => {
    setTokenValid({ email: "u@test.com", plan: "estudiante" });
    const caps = configureDdb({
      userRecord: { Item: { daily_subagent_count: 9, subagent_reset_date: "2000-01-01" } },
    });
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "subagent", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    const userUpdate = caps.updates.find((u) => u.TableName === "users");
    expect(userUpdate.ExpressionAttributeValues[":count"]).toBe(1);
  });

  it("estudiante sobre el límite → bloqueado", async () => {
    setTokenValid({ email: "u@test.com", plan: "estudiante" });
    configureDdb({
      userRecord: { Item: { daily_subagent_count: 30, subagent_reset_date: new Date().toISOString().split("T")[0] } },
    });
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "subagent", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("límite de 30 ejecuciones");
    expect(stream.output).toContain("[DONE]");
  });

  it("estudiante con error de DDB en el guard → sigue de largo", async () => {
    setTokenValid({ email: "u@test.com", plan: "estudiante" });
    configureDdb({ userRecord: null, updateError: true });
    pushChunks([{ type: "text-delta", textDelta: "ok" }]);
    const stream = createStream();
    await handlerA(
      chatEvent({ action: "subagent", messages: [{ role: "user", content: "x" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("ok");
  });
});

// ─── Load B: Google + DeepSeek disponibles ───────────────────────
async function loadChatB() {
  process.env.API_GOOGLE_CLOUD = "google-key";
  process.env.DEEP_SEEK_KEY = "ds-key";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  vi.resetModules();
  const mod = await import("./chat.js");
  return mod.handler as unknown as StreamHandler;
}

describe("chat handler — routing y fallbacks con Google (Load B)", () => {
  let handlerB: StreamHandler;
  beforeAll(async () => {
    handlerB = await loadChatB();
  });

  it("free con Google disponible → gemini-2.5-flash", async () => {
    setTokenValid({ email: "u@test.com", plan: "free" });
    configureDdb();
    pushChunks([{ type: "text-delta", textDelta: "gemini ok" }]);
    const stream = createStream();
    await handlerB(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "hola" }] }),
      stream,
      null,
    );
    const call = hoisted.streamText.mock.calls[0][0];
    expect(call.model.kind).toBe("google");
    expect(call.model.id).toBe("gemini-2.5-flash");
    expect(stream.output).toContain("gemini ok");
  });

  it("deepseek falla → fallback a Gemini Flash", async () => {
    setTokenValid({ email: "u@test.com", plan: "pro" });
    configureDdb();
    pushThrow("deepseek down");
    pushChunks([{ type: "text-delta", textDelta: "gemini respondió" }]);
    const stream = createStream();
    await handlerB(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "arregla db.py y backend.go" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("Opita AI no disponible temporalmente");
    expect(stream.output).toContain("gemini respondió");
    expect(stream.output).toContain("[DONE]");
  });

  it("gemini falla → fallback a Opita Flash (deepseek)", async () => {
    setTokenValid({ email: "u@test.com", plan: "pro" });
    configureDdb();
    pushThrow("gemini down");
    pushChunks([{ type: "text-delta", textDelta: "deepseek respondió" }]);
    const stream = createStream();
    await handlerB(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "hola sin código" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("no disponible temporalmente");
    expect(stream.output).toContain("deepseek respondió");
    expect(stream.output).toContain("[DONE]");
  });

  it("ambos proveedores fallan → mensaje de fuera de servicio", async () => {
    setTokenValid({ email: "u@test.com", plan: "pro" });
    configureDdb();
    pushThrow("deepseek down");
    pushThrow("gemini down");
    const stream = createStream();
    await handlerB(
      chatEvent({ action: "chat", messages: [{ role: "user", content: "arregla db.py" }] }),
      stream,
      null,
    );
    expect(stream.output).toContain("Todos los proveedores de IA están temporalmente fuera de servicio");
    expect(stream.output).toContain("[DONE]");
  });
});
