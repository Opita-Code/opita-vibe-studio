/**
 * Research API — unit tests de funciones puras (sin red).
 *
 * Verifica el parser de DuckDuckGo HTML y el sanitizador HTML→texto
 * con fixtures sintéticos (sin llamadas HTTP).
 */

import { describe, it, expect } from "vitest";
import { parseDuckDuckGoHtml, htmlToText, isDocsUrlAllowed } from "./research.js";

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
