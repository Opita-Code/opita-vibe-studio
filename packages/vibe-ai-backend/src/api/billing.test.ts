/**
 * Billing API — unit tests.
 *
 * Mocks DynamoDB, jose and sst. Validates the Wompi webhook signature
 * with a locally computed SHA-256 checksum (no network).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "crypto";
import { makeEvent, responseBody } from "../../tests/unit-helpers.js";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const jwtVerify = vi.fn();
  const createRemoteJWKSet = vi.fn(() => vi.fn());
  class BaseCmd {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  const PutCommand = class PutCommand extends BaseCmd {};
  const UpdateCommand = class UpdateCommand extends BaseCmd {};
  const ScanCommand = class ScanCommand extends BaseCmd {};
  return { send, jwtVerify, createRemoteJWKSet, PutCommand, UpdateCommand, ScanCommand };
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
  PutCommand: hoisted.PutCommand,
  UpdateCommand: hoisted.UpdateCommand,
  ScanCommand: hoisted.ScanCommand,
}));

vi.mock("sst", () => ({ Resource: { Transactions: { name: "transactions" } } }));

import { handler } from "./billing.js";

process.env.USERS_TABLE_NAME = "users";
process.env.WOMPI_PUBLIC_KEY = "pub_123";
process.env.WOMPI_INTEGRITY_SECRET = "integrity_secret";
process.env.WOMPI_WEBHOOK_SECRET = "webhook_secret";

const AUTH = { authorization: "Bearer token" };

function setToken(email: string | null) {
  hoisted.jwtVerify.mockImplementation(async () => {
    if (email === null) throw new Error("invalid");
    return { payload: { email, plan: "pro" } };
  });
}

function wompiSignature(data: any, props: string[], timestamp: number, secret = "webhook_secret") {
  let s = "";
  for (const prop of props) {
    const parts = prop.split(".");
    let val: any = data;
    for (const p of parts) val = val[p];
    s += val;
  }
  s += timestamp;
  s += secret;
  return crypto.createHash("sha256").update(s).digest("hex");
}

function buildWebhook(tx: Record<string, unknown>, opts: { event?: string; timestamp?: number } = {}) {
  const data = { transaction: tx };
  const props = ["transaction.reference", "transaction.status", "transaction.amount_in_cents", "transaction.currency"];
  const timestamp = opts.timestamp ?? 1700000000000;
  return JSON.stringify({
    event: opts.event || "transaction.updated",
    data,
    signature: { properties: props, checksum: wompiSignature(data, props, timestamp) },
    timestamp,
  });
}

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.jwtVerify.mockReset();
  setToken("buyer@test.com");
});

describe("billing handler — CORS / OPTIONS", () => {
  it("devuelve CORS para opitacode", async () => {
    const res: any = await handler(
      makeEvent({ method: "OPTIONS", headers: { origin: "https://opitacode.com" } }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://opitacode.com");
  });

  it("CORS default para origen arbitrario", async () => {
    const res: any = await handler(
      makeEvent({ method: "OPTIONS", headers: { origin: "https://evil.com" } }),
    );
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://cuenta.opitacode.com");
  });
});

describe("billing handler — GET payments", () => {
  it("sin sesión → 401", async () => {
    setToken(null);
    const res = await handler(makeEvent({ method: "GET", path: "/billing/payments" }));
    expect(res.statusCode).toBe(401);
  });

  it("lista transacciones ordenadas desc", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) {
        return {
          Items: [
            { id: "t1", created_at: "2020-01-01T00:00:00.000Z", amount_in_cents: 100, currency: "COP", status: "APPROVED", product_id: "VIBE_PRO" },
            { id: "t2", created_at: "2024-01-01T00:00:00.000Z", amount_in_cents: 200, currency: "COP", status: "APPROVED", product_id: "VIBE_STUDENT" },
          ],
        };
      }
      return {};
    });
    const res = await handler(makeEvent({ method: "GET", path: "/billing/payments", headers: AUTH }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items.map((i: any) => i.id)).toEqual(["t2", "t1"]);
    expect(body.items[0].product).toBe("Vibe Estudiante");
    expect(body.items[0].amount).toBe(2);
  });

  it("alias /transactions también lista", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.ScanCommand) return { Items: [] };
      return {};
    });
    const res = await handler(makeEvent({ method: "GET", path: "/billing/transactions", headers: AUTH }));
    expect(res.statusCode).toBe(200);
  });

  it("error de Scan → 500", async () => {
    hoisted.send.mockImplementation(async () => {
      throw new Error("scan failed");
    });
    const res = await handler(makeEvent({ method: "GET", path: "/billing/payments", headers: AUTH }));
    expect(res.statusCode).toBe(500);
  });
});

describe("billing handler — GET checkout-sign", () => {
  it("sin userId → 400", async () => {
    setToken(null);
    const res = await handler(makeEvent({ method: "GET", path: "/billing/checkout-sign" }));
    expect(res.statusCode).toBe(400);
  });

  it("producto inválido → 400", async () => {
    const res = await handler(
      makeEvent({ method: "GET", path: "/billing/checkout-sign", queryStringParameters: { product: "NOPE" } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("faltan credenciales Wompi → 500", async () => {
    delete process.env.WOMPI_PUBLIC_KEY;
    delete process.env.WOMPI_INTEGRITY_SECRET;
    try {
      const res = await handler(
        makeEvent({
          method: "GET",
          path: "/billing/checkout-sign",
          queryStringParameters: { product: "VIBE_PRO", userId: "buyer@test.com" },
        }),
      );
      expect(res.statusCode).toBe(500);
    } finally {
      process.env.WOMPI_PUBLIC_KEY = "pub_123";
      process.env.WOMPI_INTEGRITY_SECRET = "integrity_secret";
    }
  });

  it("genera firma de checkout válida", async () => {
    const res = await handler(
      makeEvent({ method: "GET", path: "/billing/checkout-sign", queryStringParameters: { product: "VIBE_STUDENT" }, headers: AUTH }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.publicKey).toBe("pub_123");
    expect(body.reference.startsWith("VIBE_STUDENT::buyer@test.com::")).toBe(true);
    expect(body.amountInCents).toBe(1190000);
    expect(body.currency).toBe("COP");
    expect(body.signature).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("billing handler — POST webhook", () => {
  it("método no POST → 405", async () => {
    const res = await handler(makeEvent({ method: "PUT", path: "/billing/webhook" }));
    expect(res.statusCode).toBe(405);
  });

  it("sin WOMPI_WEBHOOK_SECRET → 500", async () => {
    delete process.env.WOMPI_WEBHOOK_SECRET;
    try {
      const res = await handler(
        makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook({ id: "tx1" }) }),
      );
      expect(res.statusCode).toBe(500);
    } finally {
      process.env.WOMPI_WEBHOOK_SECRET = "webhook_secret";
    }
  });

  it("firma inválida → 401", async () => {
    const body = buildWebhook({ id: "tx1" });
    const evil = JSON.parse(body);
    evil.signature.checksum = "0".repeat(64);
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: JSON.stringify(evil) }));
    expect(res.statusCode).toBe(401);
  });

  it("JSON inválido → 500", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: "{oops" }));
    expect(res.statusCode).toBe(500);
  });

  it("evento no-transaction.updated → 200", async () => {
    const res = await handler(
      makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook({ id: "tx1" }, { event: "ping" }) }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("transacción no aprobada → 200", async () => {
    const res = await handler(
      makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook({ id: "tx1", status: "DECLINED" }) }),
    );
    expect(res.statusCode).toBe(200);
  });

  it("APROBADA con referencia :: VIBE_PRO → actualiza plan pro", async () => {
    const puts: any[] = [];
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutCommand) puts.push(cmd.input);
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const tx = {
      id: "tx1",
      reference: "VIBE_PRO::buyer@test.com::123",
      status: "APPROVED",
      amount_in_cents: 4990000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
        expect(puts.length).toBe(1);
    expect(puts[0].Item.product_id).toBe("VIBE_PRO");
    expect(updates.length).toBe(1);
    expect(updates[0].ExpressionAttributeValues[":plan"]).toBe("pro");
  });

  it("APROBADA VIBE_STUDENT → plan estudiante", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const tx = {
      id: "tx2",
      reference: "VIBE_STUDENT::buyer@test.com::123",
      status: "APPROVED",
      amount_in_cents: 1190000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(updates[0].ExpressionAttributeValues[":plan"]).toBe("estudiante");
  });

  it("transacción duplicada → 200 duplicate", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutCommand) {
        const err = new Error("dup") as any;
        err.name = "ConditionalCheckFailedException";
        throw err;
      }
      return {};
    });
    const tx = {
      id: "tx1",
      reference: "VIBE_PRO::buyer@test.com::123",
      status: "APPROVED",
      amount_in_cents: 4990000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("duplicate");
  });

  it("referencia TRABAJOS_ por guiones bajos → actualiza trabajos_plan", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const tx = {
      id: "tx3",
      reference: "TRABAJOS_PRO_buyer_1_tx123",
      status: "APPROVED",
      amount_in_cents: 1000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(updates[0].ExpressionAttributeValues[":tplan"]).toBe("pro");
  });

  it("referencia VIBE_ por guiones bajos → plan", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const tx = {
      id: "tx4",
      reference: "VIBE_PRO_buyer_1_tx123",
      status: "APPROVED",
      amount_in_cents: 4990000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(updates[0].ExpressionAttributeValues[":plan"]).toBe("pro");
  });

  it("referencia de 3 partes por guiones bajos", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutCommand) puts.push(cmd.input);
      return {};
    });
    const tx = {
      id: "tx5",
      reference: "VIBE_PRO_buyer_123",
      status: "APPROVED",
      amount_in_cents: 4990000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(puts[0].Item.user_id).toBe("buyer");
  });

  it("referencia no reconocible → 200 ignorada", async () => {
    const tx = {
      id: "tx6",
      reference: "completamente_desconocida_xyz_otro",
      status: "APPROVED",
      amount_in_cents: 1,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("unrecognized");
  });

  it("clase de producto desconocida → 200", async () => {
    const tx = {
      id: "tx7",
      reference: "SOMETHING_ELSE::buyer@test.com::123",
      status: "APPROVED",
      amount_in_cents: 1,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("unknown product class");
  });

  it("error de base de datos → 500", async () => {
    hoisted.send.mockImplementation(async () => {
      throw new Error("db down");
    });
    const tx = {
      id: "tx8",
      reference: "VIBE_PRO::buyer@test.com::123",
      status: "APPROVED",
      amount_in_cents: 4990000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(500);
    expect(res.body).toContain("Error interno de base de datos");
  });

  it("TRABAJOS sin mapeo de plan → mensaje cross-stack", async () => {
    const updates: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.UpdateCommand) updates.push(cmd.input);
      return {};
    });
    const tx = {
      id: "tx9",
      reference: "TRABAJOS_CUSTOM_buyer_1_tx999",
      status: "APPROVED",
      amount_in_cents: 1000,
      currency: "COP",
    };
    const res = await handler(makeEvent({ method: "POST", path: "/billing/webhook", body: buildWebhook(tx) }));
    expect(res.statusCode).toBe(200);
    expect(updates.length).toBe(0);
  });
});
