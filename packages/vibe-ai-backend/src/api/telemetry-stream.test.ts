/**
 * Telemetry Stream Processor — unit tests.
 *
 * Mocks S3 and the DynamoDB unmarshaller. Verifies Hive-partitioned
 * JSONL gzip writes per productId. No network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const unmarshall = vi.fn();
  const PutObjectCommand = class PutObjectCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  };
  return { send, unmarshall, PutObjectCommand };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send: typeof hoisted.send;
    constructor() {
      this.send = hoisted.send;
    }
  },
  PutObjectCommand: hoisted.PutObjectCommand,
}));

vi.mock("@aws-sdk/util-dynamodb", () => ({ unmarshall: hoisted.unmarshall }));

vi.mock("sst", () => ({ Resource: { OpitaDataLake: { name: "opita-datalake" } } }));

import { handler } from "./telemetry-stream.js";

function record(eventName: string, newImage: Record<string, unknown> | undefined) {
  return { eventName, dynamodb: newImage === undefined ? {} : { NewImage: newImage } };
}

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.unmarshall.mockReset();
  hoisted.unmarshall.mockImplementation((image) => ({ ...image }));
});

describe("telemetry-stream handler", () => {
  it("agrupa INSERTs por productId y escribe JSONL gzip particionado", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) puts.push(cmd.input);
      return {};
    });
    await handler({
      Records: [
        record("INSERT", { pk: "1", type: "page_view", productId: "vibe-studio", source: "app" }),
        record("INSERT", { pk: "2", type: "cta_click", productId: "vibe-studio" }),
        record("INSERT", { pk: "3", type: "page_view", productId: "opita-barber" }),
        record("REMOVE", { pk: "4", productId: "vibe-studio" }),
        record("INSERT", undefined),
      ],
    });

    expect(puts).toHaveLength(2);
    const keys = puts.map((p) => p.Key as string);
    expect(keys.some((k) => k.startsWith("product_id=vibe-studio/year="))).toBe(true);
    expect(keys.some((k) => k.startsWith("product_id=opita-barber/year="))).toBe(true);
    expect(keys.every((k) => k.endsWith(".json.gz"))).toBe(true);

    for (const p of puts) {
      expect(p.Bucket).toBe("opita-datalake");
      expect(p.ContentType).toBe("application/json");
      expect(p.ContentEncoding).toBe("gzip");
      const raw = p.Body as Buffer;
      const { gzipSync, gunzipSync } = await import("node:zlib");
      expect(gzipSync).toBeDefined();
      const text = gunzipSync(raw).toString("utf-8");
      expect(text).toContain('"productId"');
    }
  });

  it("cae a vibe-studio cuando falta productId", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) puts.push(cmd.input);
      return {};
    });
    await handler({ Records: [record("INSERT", { pk: "1", type: "page_view", source: "landing" })] });
    expect(puts).toHaveLength(1);
    expect(puts[0].Key).toContain("product_id=vibe-studio/");
  });

  it("no escribe nada con records vacíos", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) puts.push(cmd.input);
      return {};
    });
    await handler({ Records: [] });
    expect(puts).toHaveLength(0);
  });

  it("tolera fallos de unmarshall", async () => {
    hoisted.unmarshall.mockImplementation(() => {
      throw new Error("bad image");
    });
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) puts.push(cmd.input);
      return {};
    });
    await handler({ Records: [record("INSERT", { pk: "1" })] });
    expect(puts).toHaveLength(0);
  });

  it("tolera errores de escritura S3", async () => {
    hoisted.send.mockImplementation(async () => {
      throw new Error("s3 down");
    });
    await handler({ Records: [record("INSERT", { pk: "1", productId: "vibe-studio" })] });
    // no throws
    expect(hoisted.send).toHaveBeenCalled();
  });

  it("salta records sin NewImage", async () => {
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) puts.push(cmd.input);
      return {};
    });
    await handler({ Records: [record("INSERT", undefined), record("INSERT", undefined)] });
    expect(puts).toHaveLength(0);
  });
});
