/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * api-gateway — unit tests.
 *
 * El worker es un proxy Cloudflare (wrangler.toml): reescribe la URL
 * hacia AWS Lambda Function URL, mantiene path/query, fija el header
 * Host y reenvía. Se mockea `fetch`, nunca se toca red real.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import gateway from "../src/index";

describe("api-gateway worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxya path + query al TARGET_URL, fija Host y preserva método/cabeceras/cuerpo", async () => {
    const response = new Response("hola", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://api.opitacode.com/api/chat?foo=1&bar=2", {
      method: "POST",
      headers: { "content-type": "application/json", "x-custom": "abc" },
      body: '{"q":1}',
    });
    const env = { TARGET_URL: "https://abc.lambda-url.us-east-1.on.aws" };

    const res = await gateway.fetch(request, env, {} as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [newReq] = fetchMock.mock.calls[0];
    expect(newReq.url).toBe("https://abc.lambda-url.us-east-1.on.aws/api/chat?foo=1&bar=2");
    expect(newReq.method).toBe("POST");
    expect(newReq.headers.get("Host")).toBe("abc.lambda-url.us-east-1.on.aws");
    expect(newReq.headers.get("x-custom")).toBe("abc");
    expect(newReq.headers.get("content-type")).toBe("application/json");
    expect(await newReq.text()).toBe('{"q":1}');
    expect(res).toBe(response);
  });

  it("mantiene la ruta original sobre la del target", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://api.opitacode.com/foo/bar?q=1");
    const env = { TARGET_URL: "https://abc.lambda-url.us-east-1.on.aws/some/other" };

    await gateway.fetch(request, env, {} as any);
    const [newReq] = fetchMock.mock.calls[0];
    expect(newReq.url).toBe("https://abc.lambda-url.us-east-1.on.aws/foo/bar?q=1");
    expect(newReq.headers.get("Host")).toBe("abc.lambda-url.us-east-1.on.aws");
  });

  it("propaga la respuesta upstream tal cual", async () => {
    const upstream = new Response("boom", { status: 503 });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://api.opitacode.com/health");
    const env = { TARGET_URL: "https://abc.lambda-url.us-east-1.on.aws" };

    const res = await gateway.fetch(request, env, {} as any);
    expect(res.status).toBe(503);
    expect(res).toBe(upstream);
  });

  it("lanza si TARGET_URL es inválido", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://api.opitacode.com/x");
    const env = { TARGET_URL: "not a url" };

    await expect(gateway.fetch(request, env, {} as any)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
