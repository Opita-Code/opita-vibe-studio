/**
 * Research Bridge — unit tests.
 *
 * Mockea fetch global para verificar:
 * - searchDocs delega al backend /research/search
 * - fetchDoc valida URL y delega a /research/fetch
 * - searchCode usa npm + GitHub directamente (CORS-friendly)
 * - checkCve consulta OSV.dev
 * - Formatters producen salida legible para el LLM
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  searchDocs,
  fetchDoc,
  searchCode,
  checkCve,
  isDocsUrlAllowed,
  formatSearchResults,
  formatCveResults,
  formatCodeSearchResults,
} from "../research-bridge";

// ─── Helpers ───────────────────────────────────────────────────

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("searchDocs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delega a POST /research/search y retorna resultados", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            title: "React 19 blog",
            url: "https://react.dev/blog/react-19",
            snippet: "Introducing React 19",
            source: "duckduckgo",
          },
        ],
        backend_used: "duckduckgo",
      }),
    );

    const results = await searchDocs("React 19 breaking changes", 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/research/search");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.query).toBe("React 19 breaking changes");
    expect(body.limit).toBe(5);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("React 19 blog");
  });

  it("lanza error descriptivo cuando el backend no responde", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(searchDocs("algo")).rejects.toThrow(/No se pudo contactar/);
  });

  it("lanza error cuando el backend responde 500", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    await expect(searchDocs("algo")).rejects.toThrow(/respondió 500/);
  });

  it("retorna [] para query vacía", async () => {
    expect(await searchDocs("  ")).toEqual([]);
  });

  it("clampa limit entre 1 y 15", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [], backend_used: "duckduckgo" }));

    await searchDocs("query", 99);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.limit).toBe(15);
  });
});

describe("fetchDoc", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delega a POST /research/fetch y normaliza respuesta", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        title: "React 19",
        content: "Contenido markdown",
        byte_count: 1234,
        url: "https://react.dev/blog/react-19",
        warnings: [],
      }),
    );

    const page = await fetchDoc("https://react.dev/blog/react-19");

    expect(page.title).toBe("React 19");
    expect(page.content).toBe("Contenido markdown");
    expect(page.byteCount).toBe(1234);
  });

  it("rechaza URLs inválidas", async () => {
    await expect(fetchDoc("no-es-una-url")).rejects.toThrow(/URL inválida/);
  });

  it("rechaza protocolos no http/https", async () => {
    await expect(fetchDoc("file:///etc/passwd")).rejects.toThrow(/Protocolo no soportado/);
  });

  it("rechaza dominios fuera de la allowlist de documentación", async () => {
    await expect(fetchDoc("https://example.com/not-docs")).rejects.toThrow(/Dominio no permitido/);
    await expect(fetchDoc("https://random-blog.xyz/post")).rejects.toThrow(/Dominio no permitido/);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("permite subdominios de dominios de la allowlist", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        title: "Docs",
        content: "contenido",
        byte_count: 10,
        url: "https://react.dev/blog",
        warnings: [],
      }),
    );

    await expect(fetchDoc("https://react.dev/blog/react-19")).resolves.toBeDefined();
  });
});

describe("isDocsUrlAllowed", () => {
  it("acepta dominios canónicos y subdominios", () => {
    expect(isDocsUrlAllowed("https://react.dev")).toBe(true);
    expect(isDocsUrlAllowed("https://blog.react.dev/x")).toBe(true);
    expect(isDocsUrlAllowed("https://github.com/foo/bar")).toBe(true);
    expect(isDocsUrlAllowed("https://stackoverflow.com/q/1")).toBe(true);
    expect(isDocsUrlAllowed("https://www.npmjs.com/package/x")).toBe(true);
  });

  it("rechaza dominios fuera de la lista", () => {
    expect(isDocsUrlAllowed("https://example.com")).toBe(false);
    expect(isDocsUrlAllowed("https://evil.dev")).toBe(false);
    expect(isDocsUrlAllowed("https://react.dev.evil.com")).toBe(false);
    expect(isDocsUrlAllowed("not a url")).toBe(false);
  });
});

describe("searchCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta npm registry y GitHub y combina resultados", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          objects: [
            {
              package: {
                name: "express-jwt",
                description: "JWT auth middleware",
                links: { npm: "https://www.npmjs.com/package/express-jwt" },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              full_name: "auth0/express-jwt",
              html_url: "https://github.com/auth0/express-jwt",
              description: "Middleware for JWT",
            },
          ],
        }),
      );

    const results = await searchCode("express jwt", 5);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].source).toBe("npm");
    const githubResult = results.find((r) => r.source === "github");
    expect(githubResult?.name).toBe("auth0/express-jwt");
  });

  it("no crashea si npm falla y GitHub responde", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("npm down"))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ full_name: "x/y", html_url: "https://github.com/x/y", description: "desc" }],
        }),
      );

    const results = await searchCode("algo");
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("github");
  });
});

describe("checkCve", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta OSV.dev y mapea severidad + fixed versions", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        vulns: [
          {
            id: "GHSA-1234",
            summary: "JWT auth bypass",
            severity: [{ type: "CVSS_V3", score: "9.8" }],
            published: "2026-01-01T00:00:00Z",
            aliases: ["CVE-2026-1234"],
            affected: [
              {
                ranges: [
                  { type: "SEMVER", events: [{ introduced: "0" }, { fixed: "9.0.3" }] },
                ],
              },
            ],
          },
        ],
      }),
    );

    const vulns = await checkCve("jsonwebtoken");

    expect(vulns).toHaveLength(1);
    expect(vulns[0].severity).toBe("CRITICAL");
    expect(vulns[0].fixedVersions).toContain("9.0.3");
    expect(vulns[0].aliases).toContain("CVE-2026-1234");
  });

  it("retorna [] cuando no hay vulns", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ vulns: [] }));
    expect(await checkCve("lodash")).toEqual([]);
  });

  it("retorna [] si OSV falla (degradación elegante)", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("network"));
    expect(await checkCve("algo")).toEqual([]);
  });
});

describe("formatters", () => {
  it("formatSearchResults maneja lista vacía", () => {
    expect(formatSearchResults([])).toContain("No se encontraron resultados");
  });

  it("formatSearchResults formatea con URL y fuente", () => {
    const out = formatSearchResults([
      { title: "Título", url: "https://example.com", snippet: "Snippet", source: "duckduckgo" },
    ]);
    expect(out).toContain("Título");
    expect(out).toContain("https://example.com");
    expect(out).toContain("duckduckgo");
  });

  it("formatCveResults incluye severidad y versión que corrige", () => {
    const out = formatCveResults([
      {
        id: "GHSA-x",
        summary: "Bypass",
        severity: "HIGH",
        published: "2026-01-01",
        url: "https://osv.dev/vulnerability/GHSA-x",
        aliases: [],
        fixedVersions: ["1.2.3"],
      },
    ]);
    expect(out).toContain("HIGH");
    expect(out).toContain("1.2.3");
  });

  it("formatCodeSearchResults formatea nombre y fuente", () => {
    const out = formatCodeSearchResults([
      { name: "express", url: "https://npmjs.com/express", description: "Web framework", source: "npm" },
    ]);
    expect(out).toContain("express");
    expect(out).toContain("npm");
  });
});
