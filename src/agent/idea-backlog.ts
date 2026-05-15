/**
 * Idea Backlog — Captura y gestión inteligente de ideas del usuario.
 *
 * Problema que resuelve:
 * En sesiones de vibe-coding, los usuarios lanzan ideas de features
 * al aire ("estaría bueno que...", "algún día podríamos...") que se
 * pierden en el historial del chat. Nadie las rastrea, nadie las
 * evalúa, y cuando se implementan, nadie actualiza su estado.
 *
 * Solución:
 * Aura detecta ideas automáticamente durante la conversación,
 * las guarda en un backlog persistente, y las gestiona:
 * - Captura ideas sin interrumpir el flujo de trabajo
 * - Actualiza el estado cuando algo se implementa
 * - Permite al usuario revisar y priorizar su backlog
 * - Enriquece ideas con contexto cuando el usuario las evalúa
 *
 * Ciclo de vida:
 *   💡 idea → 📋 evaluada → 🎯 planificada → 🔨 en_progreso → ✅ implementada
 *                                                               ❌ descartada
 */

import { saveMemory, searchMemories } from "@/lib/memory";
import { useProjectStore } from "@/stores/project";

// ─── Types ─────────────────────────────────────────────────────

export type IdeaStatus =
  | "idea"           // 💡 Capturada, sin evaluar
  | "evaluada"       // 📋 Se evaluó viabilidad
  | "planificada"    // 🎯 El usuario decidió implementarla
  | "en_progreso"    // 🔨 Se está trabajando en ella
  | "implementada"   // ✅ Completada (con referencia a qué se hizo)
  | "descartada";    // ❌ El usuario decidió no hacerla

export type IdeaPriority = "alta" | "media" | "baja" | "sin_definir";

export interface Idea {
  id: string;
  /** Título corto derivado de la idea */
  title: string;
  /** Texto original del usuario (verbatim) */
  originalText: string;
  /** Descripción enriquecida (se llena cuando se evalúa) */
  description: string;
  /** Estado actual */
  status: IdeaStatus;
  /** Prioridad asignada */
  priority: IdeaPriority;
  /** Tags para categorización */
  tags: string[];
  /** Notas de evaluación (viabilidad, complejidad, dependencias) */
  evaluationNotes: string;
  /** Referencia a lo que se implementó (si aplica) */
  implementationRef: string | null;
  /** Archivos relacionados (si se detectan o implementan) */
  relatedFiles: string[];
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  /** ID de sesión donde se mencionó */
  sessionId: string | null;
}

// ─── Idea Detection ────────────────────────────────────────────

/**
 * Patrones que indican una idea casual, NO una solicitud activa.
 *
 * La diferencia es clave:
 * - "Haceme un login" → solicitud activa → NO es idea
 * - "Sería bueno tener un login con Google" → idea → capturar
 * - "Algún día podríamos agregar dark mode" → idea → capturar
 */
const IDEA_PATTERNS: RegExp[] = [
  // Condicional / subjuntivo → ideas, no solicitudes
  /(?:sería|seria)\s+(?:bueno|genial|útil|util|interesante|cool)/i,
  /(?:estaría|estaria)\s+(?:bien|bueno|cool|genial|increíble)/i,
  /(?:podríamos|podriamos|podría|podria)\s+(?:agregar|añadir|implementar|tener|hacer)/i,

  // Futuro hipotético
  /(?:algún|algun)\s+(?:día|dia)\s+(?:podríamos|podriamos|sería|seria)/i,
  /(?:en|para)\s+(?:el\s+)?futuro\s+(?:podríamos|podriamos|sería|seria|habría|habria)/i,
  /(?:más\s+adelante|mas\s+adelante|después|despues)\s+(?:podríamos|podriamos|sería|seria)/i,

  // Ideas explícitas
  /(?:una\s+)?idea(?:\s+(?:sería|seria|es|para))/i,
  /(?:se\s+me\s+ocurre|se\s+me\s+ocurrió)\s/i,
  /(?:qué\s+tal\s+si|que\s+tal\s+si)\s/i,
  /(?:imagina|imaginate|imaginá)\s+(?:que|si)/i,

  // Deseo no urgente
  /(?:me\s+gustaría|me\s+gustaria)\s+(?:que\s+(?:eventualmente|algún\s+día|en\s+el\s+futuro))/i,
  /(?:ojalá|ojala)\s+(?:pudiera|pudiéramos|pudiese)/i,

  // Feature wishlist
  /(?:feature|funcionalidad|funcionalidades)\s+(?:que\s+)?(?:podríamos|podriamos|sería|seria)/i,
  /(?:pendiente|backlog|lista\s+de\s+ideas)/i,
];

/**
 * Anti-patrones — solicitudes activas que NO deben capturarse como ideas.
 */
const ACTIVE_REQUEST_PATTERNS: RegExp[] = [
  /^(?:haceme|hazme|crea|crear|haz|hacer|agrega|agregar|implementa|implementar)/i,
  /^(?:arregla|arreglá|corregí|corrige|fix)/i,
  /^(?:cambia|cambiá|modifica|modificá|actualiza|actualizá)/i,
  /(?:ahora|ya|inmediatamente|de una vez)/i,
];

/**
 * Detecta si un mensaje contiene una idea casual.
 *
 * @returns `true` si el mensaje parece ser una idea para el backlog,
 *          `false` si es una solicitud activa o conversación normal.
 */
export function detectIdea(text: string): boolean {
  const lower = text.toLowerCase();

  // Skip very short messages (unlikely to be ideas)
  if (text.length < 15) return false;

  // If it matches an active request pattern, it's NOT an idea
  if (ACTIVE_REQUEST_PATTERNS.some((p) => p.test(lower))) return false;

  // Check against idea patterns
  return IDEA_PATTERNS.some((p) => p.test(lower));
}

// ─── Idea Creation ─────────────────────────────────────────────

function generateIdeaId(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `idea-${timestamp}-${rand}`;
}

/**
 * Crea una idea desde el texto del usuario.
 */
export function createIdea(
  text: string,
  sessionId: string | null = null
): Idea {
  return {
    id: generateIdeaId(),
    title: deriveIdeaTitle(text),
    originalText: text,
    description: "",
    status: "idea",
    priority: "sin_definir",
    tags: deriveIdeaTags(text),
    evaluationNotes: "",
    implementationRef: null,
    relatedFiles: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sessionId,
  };
}

// ─── Idea Persistence ──────────────────────────────────────────

const IDEA_STORAGE_PREFIX = "idea:";

/**
 * Guarda una idea en la memoria persistente.
 */
export async function saveIdea(idea: Idea): Promise<void> {
  const project =
    useProjectStore.getState().activeWorkspaceId || "unknown";

  await saveMemory({
    project,
    title: `${IDEA_STORAGE_PREFIX}${idea.title}`,
    content: JSON.stringify(idea),
    type: "discovery",
  });
}

/**
 * Busca ideas en el backlog del proyecto.
 */
export async function searchIdeas(
  query: string = "",
  limit: number = 20
): Promise<Idea[]> {
  const project =
    useProjectStore.getState().activeWorkspaceId || "unknown";

  const searchQuery = query
    ? `${IDEA_STORAGE_PREFIX}${query}`
    : IDEA_STORAGE_PREFIX;

  const results = await searchMemories(project, searchQuery, limit);

  return results
    .filter((m) => m.title.startsWith(IDEA_STORAGE_PREFIX))
    .map((m) => {
      try {
        return JSON.parse(m.content) as Idea;
      } catch {
        return null;
      }
    })
    .filter((i): i is Idea => i !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Busca ideas por estado.
 */
export async function getIdeasByStatus(
  status: IdeaStatus
): Promise<Idea[]> {
  const all = await searchIdeas("", 50);
  return all.filter((i) => i.status === status);
}

// ─── Idea Lifecycle ────────────────────────────────────────────

/**
 * Actualiza el estado de una idea.
 */
export async function updateIdeaStatus(
  ideaId: string,
  status: IdeaStatus,
  notes?: string,
  implementationRef?: string
): Promise<Idea | null> {
  const all = await searchIdeas("", 50);
  const idea = all.find((i) => i.id === ideaId);
  if (!idea) return null;

  idea.status = status;
  idea.updatedAt = Date.now();

  if (notes) idea.evaluationNotes = notes;
  if (implementationRef) idea.implementationRef = implementationRef;

  await saveIdea(idea);
  return idea;
}

/**
 * Intenta emparejar una tarea completada con ideas del backlog.
 *
 * Cuando Aura completa algo, llama a esta función para verificar
 * si alguna idea del backlog coincide con lo que se acaba de hacer.
 *
 * @returns Ideas que parecen coincidir (para que Aura las actualice)
 */
export async function matchCompletedWork(
  completedDescription: string,
  touchedFiles: string[]
): Promise<Idea[]> {
  const ideas = await getIdeasByStatus("idea");
  const evaluadas = await getIdeasByStatus("evaluada");
  const planificadas = await getIdeasByStatus("planificada");
  const enProgreso = await getIdeasByStatus("en_progreso");

  const allActive = [...ideas, ...evaluadas, ...planificadas, ...enProgreso];

  return allActive.filter((idea) => {
    // Check keyword overlap between idea and completed work
    const ideaWords = extractKeywords(
      `${idea.title} ${idea.originalText} ${idea.description}`
    );
    const workWords = extractKeywords(completedDescription);

    const overlap = ideaWords.filter((w) => workWords.includes(w));
    const overlapRatio = overlap.length / Math.max(ideaWords.length, 1);

    // Check file overlap
    const fileOverlap = idea.relatedFiles.filter((f) =>
      touchedFiles.some((tf) => tf.includes(f) || f.includes(tf))
    );

    // Consider it a match if significant keyword overlap OR file overlap
    return overlapRatio > 0.3 || fileOverlap.length > 0;
  });
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Deriva un título corto de la idea del usuario.
 */
function deriveIdeaTitle(text: string): string {
  // Remove idea-indicator phrases to get to the meat
  let clean = text
    .replace(
      /(?:sería|seria|estaría|estaria)\s+(?:bueno|genial|útil|util|interesante|cool|bien|increíble)\s+(?:si\s+)?(?:tener|poder|agregar|añadir|implementar|hacer)?\s*/gi,
      ""
    )
    .replace(
      /(?:podríamos|podriamos|podría|podria)\s+(?:agregar|añadir|implementar|tener|hacer)\s*/gi,
      ""
    )
    .replace(
      /(?:algún|algun)\s+(?:día|dia)\s*/gi,
      ""
    )
    .replace(
      /(?:una\s+)?idea\s+(?:sería|seria|es|para)\s*/gi,
      ""
    )
    .replace(
      /(?:qué\s+tal\s+si|que\s+tal\s+si)\s*/gi,
      ""
    )
    .trim();

  // Capitalize
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Truncate at word boundary
  if (clean.length > 60) {
    const truncated = clean.slice(0, 60);
    const lastSpace = truncated.lastIndexOf(" ");
    clean = lastSpace > 15 ? truncated.slice(0, lastSpace) : truncated;
  }

  return clean || text.slice(0, 60);
}

/**
 * Auto-tag ideas based on content keywords.
 */
function deriveIdeaTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];

  const tagMap: Record<string, string[]> = {
    ui: ["botón", "boton", "interfaz", "pantalla", "modal", "diseño", "layout", "sidebar", "navbar", "componente", "responsive"],
    backend: ["api", "endpoint", "servidor", "lambda", "base de datos", "db", "backend"],
    auth: ["login", "autenticación", "autenticacion", "sesión", "sesion", "password", "oauth", "cognito"],
    performance: ["rápido", "rapido", "lento", "cache", "rendimiento", "optimizar", "performance"],
    ux: ["experiencia", "usuario", "accesibilidad", "flujo", "navegación", "navegacion"],
    integración: ["integrar", "integración", "integracion", "api", "servicio", "tercero"],
    seguridad: ["seguridad", "token", "cifrar", "vault", "secreto", "clave"],
    testing: ["test", "prueba", "coverage", "e2e", "unitario"],
  };

  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((k) => lower.includes(k))) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Extracts meaningful keywords from text for matching.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "el", "la", "los", "las", "un", "una", "de", "del", "en", "con",
    "por", "para", "que", "como", "pero", "sin", "sobre", "entre",
    "este", "esta", "ese", "esa", "es", "son", "ser", "hay",
    "tiene", "hacer", "puede", "más", "menos", "también",
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
  ]);

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

// ─── Status Formatting ─────────────────────────────────────────

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  idea: "💡 Idea",
  evaluada: "📋 Evaluada",
  planificada: "🎯 Planificada",
  en_progreso: "🔨 En progreso",
  implementada: "✅ Implementada",
  descartada: "❌ Descartada",
};

export const PRIORITY_LABELS: Record<IdeaPriority, string> = {
  alta: "🔴 Alta",
  media: "🟡 Media",
  baja: "🟢 Baja",
  sin_definir: "⚪ Sin definir",
};

/**
 * Genera un resumen del backlog en markdown para mostrar en el chat.
 */
export function formatBacklogSummary(ideas: Idea[]): string {
  if (ideas.length === 0) {
    return "No tienes ideas guardadas. Las iré capturando cuando las menciones en el chat. 💡";
  }

  const byStatus: Record<string, Idea[]> = {};
  for (const idea of ideas) {
    const key = STATUS_LABELS[idea.status];
    if (!byStatus[key]) byStatus[key] = [];
    byStatus[key].push(idea);
  }

  const lines: string[] = [`## Tu Backlog de Ideas (${ideas.length})\n`];

  for (const [statusLabel, statusIdeas] of Object.entries(byStatus)) {
    lines.push(`### ${statusLabel}`);
    for (const idea of statusIdeas) {
      const priority =
        idea.priority !== "sin_definir"
          ? ` ${PRIORITY_LABELS[idea.priority]}`
          : "";
      const tags =
        idea.tags.length > 0
          ? ` · ${idea.tags.map((t) => `\`${t}\``).join(" ")}`
          : "";
      lines.push(`- **${idea.title}**${priority}${tags}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Exports for testing ───────────────────────────────────────

export const _testOnly = {
  deriveIdeaTitle,
  deriveIdeaTags,
  extractKeywords,
  IDEA_PATTERNS,
  ACTIVE_REQUEST_PATTERNS,
};
