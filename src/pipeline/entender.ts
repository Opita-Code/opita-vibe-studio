import type { EntenderOutput } from "./types";

// ─── Constants ─────────────────────────────────────────────────

const PLAN_HEADER = "## Plan";
const FILES_HEADER = "## Archivos";
const ISSUES_HEADER = "## Posibles problemas";

// ─── Parser ────────────────────────────────────────────────────

/**
 * Extrae el contenido entre un encabezado y el siguiente, o hasta el final.
 */
function extractSection(text: string, header: string): string {
  const idx = text.indexOf(header);
  if (idx === -1) return "";

  const start = idx + header.length;

  // Buscar el siguiente encabezado ##
  const remaining = text.slice(start);
  const nextHeader = remaining.search(/^##\s/m);
  const section = nextHeader === -1 ? remaining : remaining.slice(0, nextHeader);

  return section.trim();
}

/**
 * Parsea una lista con formato "- item" o "* item".
 */
function parseList(text: string): string[] {
  const items: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Acepta "- ", "* ", "- [ ] " (checklist vacío)
    const match = trimmed.match(/^[-*]\s?(?:\[.\]\s)?(.*)/);
    if (match) {
      const item = match[1].trim();
      if (item) items.push(item);
    }
  }

  return items;
}

/**
 * Parsea la respuesta de la fase Entender y extrae el plan estructurado.
 *
 * Formato esperado:
 * ```
 * ## Plan
 * Descripción...
 *
 * ## Archivos
 * - ruta/archivo1.ext
 *
 * ## Posibles problemas
 * - Problema 1
 * ```
 */
export function parseEntenderResponse(text: string): EntenderOutput {
  const plan = extractSection(text, PLAN_HEADER);
  const filesSection = extractSection(text, FILES_HEADER);
  const issuesSection = extractSection(text, ISSUES_HEADER);

  const files = parseList(filesSection);
  const issues = parseList(issuesSection);

  return {
    plan: plan || text.split("\n")[0] || "Sin plan disponible",
    files,
    issues,
  };
}
