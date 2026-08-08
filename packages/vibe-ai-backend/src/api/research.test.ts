/**
 * Research API — unit tests de funciones puras (sin red).
 *
 * Verifica el parser de DuckDuckGo HTML y el sanitizador HTML→texto
 * con fixtures sintéticos (sin llamadas HTTP).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseDuckDuckGoHtml, htmlToText, isDocsUrlAllowed, handler } from "./research.js";
import { makeEvent, responseBody } from "../../tests/unit-helpers.js";

const researchH = vi.hoisted(() => {
  const jwtVerify = vi.fn();
  const createRemoteJWKSet = vi.fn(() => vi.fn());
  const fetchMock = vi.fn();
  // DNS lookup mock: por defecto resuelve a IP pública (determinista, sin red).
  const dnsLookup = vi.fn(async () => [{ address: "1.2.3.4", family: 4 }]);
  return { jwtVerify, createRemoteJWKSet, fetchMock, dnsLookup };
});

vi.mock("jose", () => ({
  jwtVerify: researchH.jwtVerify,
  createRemoteJWKSet: researchH.createRemoteJWKSet,
}));

vi.mock("node:dns/promises", () => ({
  lookup: ((...a: Parameters<typeof researchH.dnsLookup>) => researchH.dnsLookup(...a)) as typeof researchH.dnsLookup,
}));

beforeEach(() => {
  researchH.jwtVerify.mockReset();
  researchH.fetchMock.mockReset();
  researchH.dnsLookup.mockReset();
  researchH.dnsLookup.mockResolvedValue([{ address: "1.2.3.4", family: 4 }]);
  // Unique user per test so the module-level in-memory rate limiter never
  // leaks state between tests (each test stays well below the 20/min budget).
  researchH.jwtVerify.mockImplementation(async () => ({ payload: { email: `u-${Math.random()}` } }));
  vi.stubGlobal("fetch", researchH.fetchMock);
});

describe("parseDuckDuckGoHtml", () => {
  it("extrae title, url (des-envuelta de uddg) y snippet", () => {
    const html = `
      <div class="results">
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Fblog%2Freact-19&rut=xyz">React 19 <b>Blog</b></a>
          <a class="result__snippet" href="...">Introducing React 19 with new features</a>
        </div>
        <div class="result">
          <a class="result__a" href="https://example.com/page2">Segundo resultado</a>
          <a class="result__snippet" href="...">Snippet dos</a>
        </div>
      </div>
    `;

    const results = parseDuckDuckGoHtml(html, 5);

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("React 19 Blog");
    expect(results[0].url).toBe("https://react.dev/blog/react-19");
    expect(results[0].snippet).toBe("Introducing React 19 with new features");
    expect(results[1].title).toBe("Segundo resultado");
  });

  it("respeta el límite", () => {
    const html = `
      <div class="result"><a class="result__a" href="https://a.com">A</a></div>
      <div class="result"><a class="result__a" href="https://b.com">B</a></div>
      <div class="result"><a class="result__a" href="https://c.com">C</a></div>
    `;
    expect(parseDuckDuckGoHtml(html, 2)).toHaveLength(2);
  });

  it("retorna [] sin resultados", () => {
    expect(parseDuckDuckGoHtml("<html><body>nada</body></html>", 5)).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("extrae title y texto limpio sin tags", () => {
    const { title, text } = htmlToText(
      "<html><head><title>Mi Página</title></head><body><h1>Hola</h1><p>Esto es <b>texto</b> con <a href='#'>links</a>.</p></body></html>",
      10_000,
    );

    expect(title).toBe("Mi Página");
    expect(text).toContain("Hola");
    expect(text).toContain("Esto es texto con links.");
    expect(text).not.toContain("<b>");
  });

  it("elimina scripts y styles", () => {
    const { text } = htmlToText(
      "<html><body><script>alert('xss')</script><style>.a{color:red}</style><p>Contenido real</p></body></html>",
      10_000,
    );

    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).toContain("Contenido real");
  });

  it("trunca y reporta warning cuando excede maxLength", () => {
    const { text, warnings } = htmlToText(
      "<html><body><p>" + "a".repeat(500) + "</p></body></html>",
      100,
    );

    expect(text.length).toBeLessThanOrEqual(100);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("truncado");
  });

  it("decodifica entidades HTML comunes", () => {
    const { text } = htmlToText("<html><body><p>a &amp; b &lt; c &gt; d</p></body></html>", 10_000);
    expect(text).toBe("a & b < c > d");
  });
});

describe("isDocsUrlAllowed (allowlist de dominios)", () => {
  it("acepta dominios de documentación y sus subdominios", () => {
    expect(isDocsUrlAllowed("https://react.dev/learn")).toBe(true);
    expect(isDocsUrlAllowed("https://developer.mozilla.org/es/docs/Web")).toBe(true);
    expect(isDocsUrlAllowed("https://github.com/foo/bar")).toBe(true);
    expect(isDocsUrlAllowed("https://blog.react.dev/post")).toBe(true);
    expect(isDocsUrlAllowed("https://www.npmjs.com/package/x")).toBe(true);
  });

  it("rechaza dominios arbitrarios", () => {
    expect(isDocsUrlAllowed("https://example.com")).toBe(false);
    expect(isDocsUrlAllowed("https://malicious-site.net")).toBe(false);
    expect(isDocsUrlAllowed("https://react.dev.evil.com")).toBe(false);
    expect(isDocsUrlAllowed("no-url")).toBe(false);
  });
});

// ─── Handler (endpoints /search /fetch /cve) ─────────────────────

const AUTH = { authorization: "Bearer tok" };
const DDG_HTML_RESULTS = `
  <div class="result">
    <a class="result__a" href="https://react.dev/blog/react-19">React 19 <b>Blog</b></a>
    <a class="result__snippet" href="...">Snippet</a>
  </div>
`;

function resOk(overrides: Partial<{ ok: boolean; status: number; text: string; contentType: string; url: string; json: unknown }> = {}) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    text: async () => overrides.text ?? "",
    json: async () => overrides.json ?? {},
    url: overrides.url ?? "https://docs.example/",
    headers: { get: (name: string) => (name === "content-type" ? overrides.contentType ?? "text/html" : null) },
  };
}

describe("research handler — preflight y auth", () => {
  it("OPTIONS → 200 con CORS", async () => {
    const res = await handler(makeEvent({ method: "OPTIONS", path: "/research/search" }));
    expect(res.statusCode).toBe(200);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://vibe.opitacode.com");
  });

  it("sin token → 401", async () => {
    researchH.jwtVerify.mockRejectedValue(new Error("nope"));
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", body: "{}" }));
    expect(res.statusCode).toBe(401);
  });

  it("token inválido → 401", async () => {
    researchH.jwtVerify.mockRejectedValue(new Error("nope"));
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: "{}" }));
    expect(res.statusCode).toBe(401);
  });

  it("rate limit excede 20/min → 429", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({ ok: false }));
    researchH.jwtVerify.mockImplementation(async () => ({ payload: { email: "rl-user@test.com" } }));
    for (let i = 0; i < 20; i++) {
      const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: JSON.stringify({ query: "q" }) }));
      expect(res.statusCode).toBe(200);
    }
    const limited = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: JSON.stringify({ query: "q" }) }));
    expect(limited.statusCode).toBe(429);
  });

  it("endpoint desconocido → 404", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/nope", headers: AUTH, body: "{}" }));
    expect(res.statusCode).toBe(404);
  });

  it("JSON de body inválido → 400", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: "{bad" }));
    expect(res.statusCode).toBe(400);
  });
});

describe("research handler — /search", () => {
  it("consulta sin query → 400", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: "{}" }));
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toContain("'query'");
  });

  it("DuckDuckGo html devuelve resultados", async () => {
    researchH.fetchMock.mockResolvedValueOnce(resOk({ text: DDG_HTML_RESULTS }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: JSON.stringify({ query: "react 19", limit: 5 }) }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.backend_used).toBe("duckduckgo");
    expect(body.results[0].title).toBe("React 19 Blog");
  });

  it("cae a lite cuando html no tiene resultados", async () => {
    researchH.fetchMock
      .mockResolvedValueOnce(resOk({ ok: true, text: "<html>vacío</html>" }))
      .mockResolvedValueOnce(resOk({ ok: true, text: DDG_HTML_RESULTS }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: JSON.stringify({ query: "x" }) }));
    const body = JSON.parse(res.body);
    expect(body.backend_used).toBe("duckduckgo_lite");
    expect(body.results).toHaveLength(1);
  });

  it("sin resultados → backend none", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({ ok: false, status: 503 }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: JSON.stringify({ query: "x" }) }));
    const body = JSON.parse(res.body);
    expect(body.backend_used).toBe("none");
    expect(body.results).toEqual([]);
  });

  it("fetch lanza excepción → fallback none", async () => {
    researchH.fetchMock.mockRejectedValue(new Error("network down"));
    const res = await handler(makeEvent({ method: "POST", path: "/research/search", headers: AUTH, body: JSON.stringify({ query: "x" }) }));
    expect(JSON.parse(res.body).backend_used).toBe("none");
  });
});

describe("research handler — /fetch", () => {
  it("descarga documentación HTML permitida", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({
      text: "<html><head><title>Docs</title></head><body><p>Contenido de react</p></body></html>",
      contentType: "text/html",
      url: "https://react.dev/learn",
    }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "https://react.dev/learn" }) }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.title).toBe("Docs");
    expect(body.content).toContain("Contenido de react");
    expect(body.byte_count).toBeGreaterThan(0);
  });

  it("devuelve texto plano truncado cuando no es HTML", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({ text: "hola".repeat(1000), contentType: "text/plain", url: "https://raw.githubusercontent.com/x/y" }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "https://raw.githubusercontent.com/x/y", max_length: 100 }) }));
    const body = JSON.parse(res.body);
    expect(body.title).toBe("raw.githubusercontent.com");
    // max_length tiene un floor de 1000 en el backend
    expect(body.content.length).toBeLessThanOrEqual(1000);
    expect(body.warnings).toHaveLength(1);
  });

  it("URL inválida → 400", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "no-url" }) }));
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toContain("URL inválida");
  });

  it("protocolo no soportado → 400", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "file:///etc/passwd" }) }));
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toContain("Protocolo no soportado");
  });

  it("dominio fuera de la allowlist → 400", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "https://example.com/x" }) }));
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toContain("Dominio no permitido");
  });

  it("hosts privados dentro de dominios permitidos → bloqueados por SSRF", async () => {
    for (const url of [
      "http://10.0.0.1.react.dev/x",
      "http://192.168.1.1.react.dev/x",
      "http://172.16.5.5.react.dev/x",
      "http://169.254.0.1.react.dev/x",
    ]) {
      const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url }) }));
      expect(res.statusCode).toBe(400);
      expect(responseBody(res).error).toContain("URL bloqueada por seguridad");
    }
  });

  it("hosts locales → bloqueados por SSRF (el guard corre antes de la allowlist)", async () => {
    // Fix spec 899 bug: antes la allowlist corría primero y el guard SSRF
    // era código muerto para localhost/127.0.0.1/.local/.internal. Ahora
    // el guard SSRF es el primero y bloquea con mensaje de seguridad.
    for (const url of [
      "https://localhost/x",
      "http://127.0.0.1/x",
      "http://intranet.internal/x",
      "http://foo.local/x",
      "http://[::1]/x",
    ]) {
      const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url }) }));
      expect(res.statusCode).toBe(400);
      expect(responseBody(res).error).toContain("URL bloqueada por seguridad");
    }
  });

  it("DNS rebinding: dominio permitido que resuelve a IP privada → bloqueado", async () => {
    // Un dominio de la allowlist (react.dev) resuelve a IP privada tras
    // rebinding → el guard DNS lo bloquea aunque pase la allowlist.
    researchH.dnsLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "https://react.dev/learn" }) }));
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toContain("URL bloqueada por seguridad");
  });

  it("DNS lookup falla → no bloquea (best-effort, guards sintácticos aplican)", async () => {
    researchH.dnsLookup.mockRejectedValue(new Error("ENOTFOUND"));
    researchH.fetchMock.mockResolvedValue(resOk({
      text: "<html><head><title>Docs</title></head><body><p>ok</p></body></html>",
      contentType: "text/html",
      url: "https://react.dev/learn",
    }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "https://react.dev/learn" }) }));
    expect(res.statusCode).toBe(200);
  });

  it("respuesta no OK → 400", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({ ok: false, status: 500 }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/fetch", headers: AUTH, body: JSON.stringify({ url: "https://react.dev/x" }) }));
    expect(res.statusCode).toBe(400);
    expect(responseBody(res).error).toContain("respondió 500");
  });
});

describe("research handler — /cve", () => {
  it("consulta a OSV.dev y devuelve JSON", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({ json: { results: [{ id: "GHSA-xxxx" }] }, contentType: "application/json" }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/cve", headers: AUTH, body: JSON.stringify({ package: "lodash" }) }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results[0].id).toBe("GHSA-xxxx");
  });

  it("sin package → 400", async () => {
    const res = await handler(makeEvent({ method: "POST", path: "/research/cve", headers: AUTH, body: "{}" }));
    expect(res.statusCode).toBe(400);
  });

  it("OSV.dev responde error → 400", async () => {
    researchH.fetchMock.mockResolvedValue(resOk({ ok: false, status: 429 }));
    const res = await handler(makeEvent({ method: "POST", path: "/research/cve", headers: AUTH, body: JSON.stringify({ package: "x" }) }));
    expect(res.statusCode).toBe(400);
  });
});
