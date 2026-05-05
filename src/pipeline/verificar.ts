import type { VerificarOutput } from "./types";

// ─── Constants ─────────────────────────────────────────────────

const OK_RESPONSE = "ok";
const REINTENTAR_PREFIX = "reintentar";

// ─── Parser ────────────────────────────────────────────────────

/**
 * Parsea la respuesta de la fase Verificar.
 *
 * Se espera que el AI responda con:
 * - "ok" si todo está bien
 * - "reintentar: [razón específica]" si necesita correcciones
 *
 * También tolera variaciones como "OK", "Reintentar:", etc.
 */
export function parseVerificarResponse(text: string): VerificarOutput {
  const trimmed = text.trim().toLowerCase();

  // Quitar puntuación al final para comparación limpia
  const clean = trimmed.replace(/[.!¡¿?]+$/, "").trim();

  if (clean === OK_RESPONSE) {
    return { status: "ok" };
  }

  // "reintentar: razón" o "reintentar:razón"
  if (clean.startsWith(REINTENTAR_PREFIX)) {
    const reason = trimmed
      .slice(REINTENTAR_PREFIX.length)
      .replace(/^[::\s]+/, "")
      .trim();

    return {
      status: "reintentar",
      reason: reason || "El código necesita correcciones",
      details: trimmed,
    };
  }

  // Si no coincide exactamente, chequear si contiene "ok" como palabra
  if (/\bok\b/.test(clean)) {
    return { status: "ok" };
  }

  // Por defecto, asumir reintentar para cualquier otra respuesta
  return {
    status: "reintentar",
    reason: `Respuesta inesperada del verificador: "${text}"`,
    details: trimmed,
  };
}
