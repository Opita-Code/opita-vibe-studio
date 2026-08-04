/* eslint-disable @typescript-eslint/no-explicit-any -- Lambda event shapes are loosely typed by AWS; matches handler convention (chat.ts, storage.ts) */
/**
 * Research API — OSINT proxy para el agente de Vibe Studio.
 *
 * Endpoints (todos POST, CORS + JWT OCAIS):
 *   /search  — DuckDuckGo HTML server-side → resultados normalizados (sin API key)
 *   /fetch   — descarga URL pública + sanitiza HTML → markdown-ish texto
 *   /cve     — proxy a OSV.dev (redundante con el cliente directo, útil server-side)
 *
 * Rate limiting: token bucket en memoria por usuario (por instancia Lambda —
 * aproximado, suficiente para v1; el control estricto vive en el plan de
 * tokens existente).
 */

// ─── Setup ─────────────────────────────────────────────────────

import * as jwt from "jose";

const OCAIS_ISSUER = "opita-account-ui";
const OCAIS_JWKS_URL = process.env.OCAIS_JWKS_URL || "https://api.opitacode.com/.well-known/jwks.json";
const OCAIS_JWKS = jwt.createRemoteJWKSet(new URL(OCAIS_JWKS_URL));

const DDG_HTML_URL = "https://html.duckduckgo.com/html/";
const USER_AGENT = "Mozilla/5.0 (compatible; VibeStudioResearch/1.0; +https://vibe.opitacode.com)";

/**
 * Allowlist de dominios de documentación técnica permitidos para /fetch.
 * Mantener en sync con src/tools/research-bridge.ts (DOCS_ALLOWLIST).
 * El agente de código solo necesita fuentes de referencia, no un crawler web.
 */
const DOCS_ALLOWLIST = [
  "react.dev",
  "nextjs.org",
  "developer.mozilla.org",
  "developer.chrome.com",
  "web.dev",
  "nodejs.org",
  "npmjs.com",
  "github.com",
  "raw.githubusercontent.com",
  "gist.github.com",
  "stackoverflow.com",
  "stackexchange.com",
  "typescriptlang.org",
  "tailwindcss.com",
  "vitejs.dev",
  "vercel.com",
  "caniuse.com",
  "docs.python.org",
  "learn.microsoft.com",
  "developer.apple.com",
  "w3schools.com",
  "astro.build",
  "docs.astro.build",
  "vibestudio.opitacode.com",
  "opitacode.com",
];

/** Valida que una URL pertenezca a la allowlist de documentación (exportado para tests). */
export function isDocsUrlAllowed(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const normalized = hostname.replace(/^www\./, "");
  return DOCS_ALLOWLIST.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
  );
}

// ─── CORS ──────────────────────────────────────────────────────

function getCorsHeaders(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  let allowedOrigin = "https://vibe.opitacode.com";

  if (
    origin === "https://opitacode.com" ||
    origin.endsWith(".opitacode.com") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    allowedOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

// ─── Auth ──────────────────────────────────────────────────────

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwt.jwtVerify(token, OCAIS_JWKS, { issuer: OCAIS_ISSUER });
    return String(payload.email || payload.sub || "unknown");
  } catch {
    try {
      const { payload } = await jwt.jwtVerify(token, OCAIS_JWKS);
      return String(payload.email || payload.sub || "unknown");
    } catch {
      return null;
    }
  }
}

// ─── Rate limiting (per-instance token bucket) ─────────────────

const RATE_LIMITS: Record<string, { count: number; resetAt: number }> = {};
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20; // por minuto por usuario (instancia)

function rateLimited(user: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMITS[user];
  if (!bucket || now > bucket.resetAt) {
    RATE_LIMITS[user] = { count: 1, resetAt: now + RATE_WINDOW_MS };
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_MAX;
}

// ─── HTML→text sanitization (regex-based, sin deps) ────────────

/** Convierte HTML a texto legible (exportado para tests). */
export function htmlToText(html: string, maxLength: number): { text: string; title: string; warnings: string[] } {
  const warnings: string[] = [];

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Strip scripts/styles/noscript
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // Mark block boundaries for readability
  text = text.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|article|br)>/gi, "\n");

  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

  // Fix spacing artifacts from tag boundaries: "word ." → "word."
  text = text.replace(/\s+([.,;:!?%])/g, "$1");

  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    warnings.push(`Contenido truncado a ${maxLength} caracteres.`);
  }

  return { text, title, warnings };
}

// ─── DuckDuckGo HTML parse ─────────────────────────────────────

interface DDGResult {
  title: string;
  url: string;
  snippet: string;
}

export interface DDGResultPublic {
  title: string;
  url: string;
  snippet: string;
}

/** Parsea resultados de DuckDuckGo HTML (exportado para tests). */
export function parseDuckDuckGoHtml(html: string, limit: number): DDGResult[] {
  const results: DDGResult[] = [];

  // DDG HTML results come in <div class="result"> blocks
  const blocks = html.split(/<div[^>]*class="[^"]*result[^"]*"[^>]*>/i).slice(1);

  for (const block of blocks) {
    if (results.length >= limit) break;

    const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>(?:<[^>]+>)*([^<]+)(?:<[^>]+>)*<\/a>/i);
    const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);

    if (!titleMatch) continue;

    let url = titleMatch[1] || "";
    const title = titleMatch[2]
      ? titleMatch[2].replace(/<[^>]+>/g, "").trim()
      : (titleMatch[3] ?? "").trim();

    // DDG wraps URLs in a redirect: extract the real one
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      try { url = decodeURIComponent(uddgMatch[1]); } catch { /* keep original */ }
    }

    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    if (url && title) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

// ─── Endpoint handlers ─────────────────────────────────────────

async function handleSearch(body: any): Promise<{ results: DDGResult[]; backend_used: string }> {
  const query = String(body.query || "").trim();
  const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 15);

  if (!query) {
    throw new Error("Se requiere 'query'");
  }

  // 1. Try DuckDuckGo HTML (no auth)
  try {
    const res = await fetch(DDG_HTML_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      body: new URLSearchParams({ q: query }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const html = await res.text();
      const results = parseDuckDuckGoHtml(html, limit);
      if (results.length > 0) {
        return { results, backend_used: "duckduckgo" };
      }
    }
  } catch {
    // fall through to secondary
  }

  // 2. Fallback: DuckDuckGo lite
  try {
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const html = await res.text();
      const results = parseDuckDuckGoHtml(html, limit);
      if (results.length > 0) {
        return { results, backend_used: "duckduckgo_lite" };
      }
    }
  } catch {
    // fall through
  }

  return { results: [], backend_used: "none" };
}

async function handleFetch(body: any): Promise<{ title: string; content: string; byte_count: number; url: string; warnings: string[] }> {
  const url = String(body.url || "").trim();
  const maxLength = Math.min(Math.max(Number(body.max_length) || 20_000, 1_000), 50_000);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL inválida: '${url}'`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Protocolo no soportado: '${parsed.protocol}'`);
  }

  // Allowlist de dominios de documentación (limitación estándar)
  if (!isDocsUrlAllowed(parsed.toString())) {
    throw new Error(
      `Dominio no permitido: '${parsed.hostname}'. /fetch solo lee documentación técnica ` +
      `(react.dev, developer.mozilla.org, github.com, stackoverflow.com, npmjs.com, etc.).`,
    );
  }

  // SSRF guard: block private/local IPs and loopback hosts
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    hostname === "[::1]"
  ) {
    throw new Error(`URL bloqueada por seguridad: hosts privados/locales no permitidos.`);
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`La URL respondió ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml");
  const raw = await res.text();

  if (isHtml) {
    const { text, title, warnings } = htmlToText(raw, maxLength);
    return {
      title,
      content: text,
      byte_count: raw.length,
      url: res.url || parsed.toString(),
      warnings,
    };
  }

  // Plain text / JSON / others — return raw truncated
  const truncated = raw.length > maxLength ? raw.slice(0, maxLength) : raw;
  return {
    title: parsed.hostname,
    content: truncated,
    byte_count: raw.length,
    url: res.url || parsed.toString(),
    warnings: raw.length > maxLength ? [`Contenido truncado a ${maxLength} caracteres.`] : [],
  };
}

async function handleCve(body: any): Promise<unknown> {
  const pkg = String(body.package || "").trim().toLowerCase();
  if (!pkg) throw new Error("Se requiere 'package'");

  const res = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package: { name: pkg, ecosystem: "npm" } }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`OSV.dev respondió ${res.status}`);
  }

  const data = await res.json();
  return data;
}

// ─── Handler ───────────────────────────────────────────────────

export const handler = async (event: any) => {
  const corsHeaders = getCorsHeaders(event);

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  // Parse path from router prefix (/research/{path} — router strips the base)
  const rawPath = event.rawPath || event.path || "";
  const path = rawPath.replace(/^\/research/, "").split("?")[0];

  try {
    // Auth
    const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const user = token ? await verifyToken(token) : null;
    if (!user) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "No autorizado" }) };
    }

    // Rate limit
    if (rateLimited(user)) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Demasiadas solicitudes de investigación. Espera un minuto." }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    let result: unknown;

    if (path === "/search" || path === "/search/") {
      result = await handleSearch(body);
    } else if (path === "/fetch" || path === "/fetch/") {
      result = await handleFetch(body);
    } else if (path === "/cve" || path === "/cve/") {
      result = await handleCve(body);
    } else {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Endpoint desconocido: ${path}` }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: message }),
    };
  }
};
