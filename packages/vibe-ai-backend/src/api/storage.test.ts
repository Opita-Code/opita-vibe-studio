/**
 * Storage API — unit tests.
 *
 * Mocks S3, the presigner (getSignedUrl), sst and jose. No network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEvent, responseBody } from "../../tests/unit-helpers.js";

const hoisted = vi.hoisted(() => {
  const getSignedUrl = vi.fn();
  const jwtVerify = vi.fn();
  const createRemoteJWKSet = vi.fn(() => vi.fn());
  return { getSignedUrl, jwtVerify, createRemoteJWKSet };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor() {}
  },
  PutObjectCommand: class {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
  GetObjectCommand: class {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: hoisted.getSignedUrl,
}));

vi.mock("jose", () => ({
  jwtVerify: hoisted.jwtVerify,
  createRemoteJWKSet: hoisted.createRemoteJWKSet,
}));

vi.mock("sst", () => ({ Resource: { VibeStorage: { name: "vibe-storage" } } }));

import { handler } from "./storage.js";

function setTokenValid(payload: Record<string, unknown> = { email: "user@test.com" }) {
  hoisted.jwtVerify.mockImplementation(async () => ({ payload }));
}

function setTokenInvalid() {
  hoisted.jwtVerify.mockRejectedValue(new Error("invalid"));
}

beforeEach(() => {
  hoisted.getSignedUrl.mockReset();
  hoisted.jwtVerify.mockReset();
  setTokenValid();
  hoisted.getSignedUrl.mockResolvedValue("https://signed-url.example/upload");
});

describe("storage handler", () => {
  it("responde OPTIONS con CORS", async () => {
    const res = await handler(makeEvent({ method: "OPTIONS", path: "/storage/x" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://vibe.opitacode.com");
  });

  it("sin Authorization → 401", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/storage/x" }));
    expect(res.statusCode).toBe(401);
    expect(responseBody(res).error).toBe("No token provided");
  });

  it("token inválido → 401", async () => {
    setTokenInvalid();
    const res = await handler(
      makeEvent({ method: "POST", path: "/storage/x", headers: { authorization: "Bearer tok" } }),
    );
    expect(res.statusCode).toBe(401);
    expect(responseBody(res).error).toBe("Invalid token");
  });

  it("upload de proyecto sin projectId → 400", async () => {
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ action: "upload" }),
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toBe("Falta projectId");
  });

  it("upload de proyecto → URL firmada y objectKey saneado", async () => {
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ action: "upload", projectId: "mi-proyecto/../malo", contentType: "application/zip" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.uploadUrl).toBe("https://signed-url.example/upload");
    expect(body.objectKey).toBe("projects/user@test.com/mi-proyectomalo.zip");
  });

  it("download de proyecto → URL firmada", async () => {
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ action: "download", projectId: "p1" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.downloadUrl).toBe("https://signed-url.example/upload");
    expect(body.objectKey).toBe("projects/user@test.com/p1.zip");
  });

  it("upload genérico sin filename/contentType → 400", async () => {
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("upload genérico con filename+contentType → URL firmada + fileUrl", async () => {
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ filename: "foto.png", contentType: "image/png" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.uploadUrl).toBe("https://signed-url.example/upload");
    expect(body.fileUrl).toContain("vibe-storage.s3.amazonaws.com/uploads/user@test.com/");
    expect(body.objectKey).toContain("uploads/user@test.com/");
    expect(body.objectKey).toContain("foto.png");
  });

  it("usuario anónimo cuando el JWT no trae email/sub", async () => {
    setTokenValid({ foo: "bar" });
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ filename: "a.txt", contentType: "text/plain" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).objectKey).toContain("uploads/anonymous/");
  });

  it("errores internos → 500", async () => {
    setTokenValid();
    hoisted.getSignedUrl.mockRejectedValue(new Error("presigner failed"));
    const res = await handler(
      makeEvent({
        method: "POST",
        path: "/storage/x",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ action: "upload", projectId: "p1" }),
      }),
    );
    expect(res.statusCode).toBe(500);
    expect(responseBody(res).error).toContain("Error interno");
  });
});
