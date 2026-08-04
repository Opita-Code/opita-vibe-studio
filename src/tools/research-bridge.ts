/**
 * Docs Bridge — puente de documentación técnica para el agente de Vibe Studio.
 *
 * Encapsula las llamadas de documentación (búsqueda web, lectura de páginas,
 * búsqueda de código, CVE check) con:
 * - Tipado estricto de request/response
 * - Timeout 15s con AbortController (compatibilidad amplia, no AbortSignal.timeout)
 * - Degradación elegante: nunca lanza excepciones hacia el agente, siempre
 *   retorna resultados o errores descriptivos en español
 * - Limitaciones estándar: allowlist de dominios de documentación para fetch,
 *   rutas: backend propio (/research/*) para search+fetch (requieren llaves
 *   server-side), APIs públicas CORS-friendly para CVE (OSV.dev) y código
 *   (npm registry + GitHub)
 */

// ─── Types ─────────────────────────────────────────────────────

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebFetchResult {
  title: string;
  content: string;
  byteCount: number;
  url: string;
  warnings: string[];
}

export interface CodeSearchResult {
  name: string;
  url: string;
  description: string;
  source: "npm" | "github" | "crates" | "pypi";
}

export interface CveResult {
  id: string;
  summary: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
  published: string;
  url: string;
  aliases: string[];
  fixedVersions?: string[];
}

// ─── Config ────────────────────────────────────────────────────

const TIMEOUT_MS = 15_000;
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_FETCH_CHARS = 20_000;

/**
 * Allowlist de dominios de documentación técnica permitidos para docs_fetch.
 * Mantener en sync con packages/vibe-ai-backend/src/api/research.ts.
 * El agente de código solo necesita fuentes de referencia, no un crawler web.
 */
export const DOCS_ALLOWLIST: readonly string[] = [
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

/** Valida que una URL pertenezca a un dominio de la allowlist. */
export function isDocsUrlAllowed(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  // Quitar www. para comparación normalizada
  const normalized = hostname.replace(/^www\./, "");
  return DOCS_ALLOWLIST.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
  );
}

/** Resuelve la base de la API backend según el entorno. */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "http://localhost:3000";
    }
    return "https://api.opitacode.com";
  }
  return "https://api.opitacode.com";
}

// ─── HTTP Helpers ──────────────────────────────────────────────

/** Fetch con timeout manual (AbortController + setTimeout). */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `El servicio de investigación respondió ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const reason = err instanceof DOMException && err.name === "AbortError"
      ? `timeout de ${TIMEOUT_MS / 1000}s`
      : err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `No se pudo contactar el servicio de investigación (${reason}). El backend de research puede no estar desplegado en este stage.`,
    };
  }
}

// ─── Web Search ────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface SearchResponse {
  results: WebSearchResult[];
  backend_used: string;
}

/**
 * Busca documentación técnica en la web pública. Requiere el endpoint
 * /research/search del backend (envuelve DuckDuckGo HTML server-side, sin API key).
 */
export async function searchDocs(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<WebSearchResult[]> {
  if (!query.trim()) return [];

  const res = await postJson<SearchResponse>("/research/search", {
    query: query.trim(),
    limit: Math.min(Math.max(limit, 1), 15),
  });

  if (!res.ok) {
    throw new Error(res.error);
  }

  return res.data.results ?? [];
}

// ─── Web Fetch ─────────────────────────────────────────────────

export interface FetchRequest {
  url: string;
  max_length?: number;
}

export interface FetchResponse {
  title: string;
  content: string;
  byte_count: number;
  url: string;
  warnings: string[];
}

/**
 * Descarga una página de documentación y la sanitiza a markdown. Requiere el
 * endpoint /research/fetch del backend (CORS bloquea fetch directo desde el
 * browser). Restringido a la allowlist de dominios de documentación.
 */
export async function fetchDoc(
  url: string,
  maxLength: number = MAX_FETCH_CHARS,
): Promise<WebFetchResult> {
  // Validación mínima de URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL inválida: '${url}'. Debe ser una URL completa (ej: https://react.dev).`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Protocolo no soportado: '${parsed.protocol}'. Solo http/https.`);
  }

  // Allowlist de dominios de documentación (limitación estándar)
  if (!isDocsUrlAllowed(parsed.toString())) {
    throw new Error(
      `Dominio no permitido: '${parsed.hostname}'. docs_fetch solo lee documentación técnica ` +
      `(react.dev, developer.mozilla.org, github.com, stackoverflow.com, npmjs.com, etc.).`,
    );
  }

  const res = await postJson<FetchResponse>("/research/fetch", {
    url: parsed.toString(),
    max_length: Math.min(Math.max(maxLength, 1_000), 50_000),
  });

  if (!res.ok) {
    throw new Error(res.error);
  }

  return {
    title: res.data.title,
    content: res.data.content,
    byteCount: res.data.byte_count,
    url: res.data.url,
    warnings: res.data.warnings ?? [],
  };
}

// ─── Code Search (directo, CORS-friendly) ──────────────────────

/**
 * Busca paquetes/ejemplos de código en registros públicos (npm, GitHub).
 * No requiere backend: npm registry y GitHub API envían CORS headers.
 */
export async function searchCode(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<CodeSearchResult[]> {
  if (!query.trim()) return [];
  const cap = Math.min(Math.max(limit, 1), 10);
  const results: CodeSearchResult[] = [];

  // npm registry — primer backend
  try {
    const res = await fetchWithTimeout(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${cap}`,
    );
    if (res.ok) {
      const data = (await res.json()) as {
        objects?: Array<{ package: { name: string; links?: { npm?: string; repository?: string }; description?: string } }>;
      };
      for (const obj of data.objects ?? []) {
        if (results.length >= cap) break;
        results.push({
          name: obj.package.name,
          url: obj.package.links?.npm ?? `https://www.npmjs.com/package/${obj.package.name}`,
          description: obj.package.description ?? "",
          source: "npm",
        });
      }
    }
  } catch {
    // npm fallo — continuar con GitHub
  }

  // GitHub — segundo backend (público sin auth, 10 req/min)
  if (results.length < cap) {
    try {
      const res = await fetchWithTimeout(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${cap - results.length}`,
        { headers: { Accept: "application/vnd.github+json", "User-Agent": "vibe-studio" } },
      );
      if (res.ok) {
        const data = (await res.json()) as { items?: Array<{ full_name: string; html_url: string; description: string | null }> };
        for (const item of data.items ?? []) {
          if (results.length >= cap) break;
          if (results.some((r) => r.name === item.full_name)) continue;
          results.push({
            name: item.full_name,
            url: item.html_url,
            description: item.description ?? "",
            source: "github",
          });
        }
      }
    } catch {
      // GitHub fallo — devolver lo que tengamos
    }
  }

  return results;
}

// ─── CVE Check (directo, OSV.dev CORS-friendly) ────────────────

/**
 * Verifica vulnerabilidades conocidas de una dependencia usando OSV.dev.
 * Se consulta por nombre de paquete (ecosistema npm) y por purl cuando aplica.
 */
export async function checkCve(packageName: string): Promise<CveResult[]> {
  const name = packageName.trim().toLowerCase();
  if (!name) return [];

  // Buscar vulns por package name en el ecosistema npm
  try {
    const res = await fetchWithTimeout("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { name, ecosystem: "npm" } }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        vulns?: Array<{
          id: string;
          summary?: string;
          details?: string;
          severity?: Array<{ type: string; score: string }>;
          published?: string;
          aliases?: string[];
          affected?: Array<{ ranges?: Array<{ type: string; events?: Array<{ fixed?: string }> }> }>;
        }>;
      };

      return (data.vulns ?? []).map((v) => {
        const severity = mapOsvSeverity(v.severity);
        const fixedVersions = collectFixedVersions(v.affected);
        return {
          id: v.id,
          summary: v.summary || v.details || "Sin descripción disponible",
          severity,
          published: v.published ?? "",
          url: `https://osv.dev/vulnerability/${v.id}`,
          aliases: v.aliases ?? [],
          fixedVersions,
        };
      });
    }
  } catch {
    // OSV fallo — devolver vacío con indicación implícita
  }

  return [];
}

/** Mapea severidades OSV (CVSS) a un nivel legible. */
function mapOsvSeverity(
  severity?: Array<{ type: string; score: string }>,
): CveResult["severity"] {
  const cvss = severity?.find((s) => s.type === "CVSS_V3") ?? severity?.[0];
  if (!cvss) return "UNKNOWN";
  const score = parseFloat(cvss.score);
  if (isNaN(score)) return "UNKNOWN";
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MODERATE";
  return "LOW";
}

/** Extrae versiones fijadas (fixed) de los rangos afectados. */
function collectFixedVersions(
  affected?: Array<{ ranges?: Array<{ type: string; events?: Array<{ fixed?: string }> }> }>,
): string[] {
  const fixed = new Set<string>();
  for (const a of affected ?? []) {
    for (const range of a.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) fixed.add(event.fixed);
      }
    }
  }
  return [...fixed].slice(0, 5);
}

// ─── Formatters (para inyectar resultados al LLM) ──────────────

/** Formatea resultados de búsqueda web para el contexto del LLM. */
export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return "No se encontraron resultados web para la búsqueda.";
  }
  return results
    .map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}\n   (fuente: ${r.source})`,
    )
    .join("\n\n");
}

/** Formatea resultados CVE para el contexto del LLM. */
export function formatCveResults(results: CveResult[]): string {
  if (results.length === 0) {
    return "No se encontraron vulnerabilidades conocidas para este paquete.";
  }
  return results
    .map((v) => {
      const fixed = v.fixedVersions?.length
        ? `\n   Versión que corrige: ${v.fixedVersions.join(", ")}`
        : "";
      return `[${v.severity}] ${v.id} — ${v.summary}\n   Publicado: ${v.published || "N/A"}${fixed}\n   Detalle: ${v.url}`;
    })
    .join("\n\n");
}

/** Formatea resultados de búsqueda de código para el contexto del LLM. */
export function formatCodeSearchResults(results: CodeSearchResult[]): string {
  if (results.length === 0) {
    return "No se encontraron paquetes o repositorios para la búsqueda.";
  }
  return results
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} (${r.source})\n   URL: ${r.url}\n   ${r.description || "Sin descripción"}`,
    )
    .join("\n\n");
}
