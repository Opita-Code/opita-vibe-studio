/**
 * Spec Writer — Genera y persiste specs desde instrucciones naturales.
 *
 * Cuando el usuario dice "Haceme un login con Google",
 * este módulo genera automáticamente una spec estructurada:
 *
 *   ## Objetivo
 *   Crear un componente de login con autenticación de Google.
 *   
 *   ## Alcance
 *   - Botón de "Iniciar con Google"
 *   - Flujo OAuth 2.0
 *   - Manejo de errores de autenticación
 *   
 *   ## Archivos a crear/modificar
 *   - src/components/Login.tsx (nuevo)
 *   - src/lib/auth.ts (modificar)
 *
 * La spec se guarda en dos lugares:
 * 1. `.vibe/specs/` en el filesystem del proyecto (committable)
 * 2. Memoria persistente (IndexedDB — recuperable si se borran archivos)
 *
 * TODO lo genera en ESPAÑOL, para usuarios no-code/low-code.
 */

import { saveFileContent, readFileContent } from "@/lib/fs";
import { saveMemory, searchMemories } from "@/lib/memory";
import { useProjectStore } from "@/stores/project";

// ─── Types ─────────────────────────────────────────────────────

export interface Spec {
  id: string;
  /** Título corto derivado de la instrucción */
  title: string;
  /** Instrucción original del usuario (verbatim) */
  userInstruction: string;
  /** Objetivo: qué se quiere lograr */
  objective: string;
  /** Alcance: lista de funcionalidades incluidas */
  scope: string[];
  /** Archivos que se van a crear o modificar */
  targetFiles: string[];
  /** Preguntas abiertas para aclarar antes de construir */
  openQuestions: string[];
  /** Opciones/alternativas que el usuario puede elegir */
  options: string[];
  /** Decisiones tomadas por el usuario */
  decisions: string[];
  /** Estado: borrador, aprobada, en progreso, completada */
  status: "borrador" | "aprobada" | "en_progreso" | "completada";
  /** Timestamp de creación */
  createdAt: number;
  /** Timestamp de última actualización */
  updatedAt: number;
}

// ─── Spec ID Generation ────────────────────────────────────────

function generateSpecId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug}-${timestamp}-${rand}`;
}

// ─── Spec to Markdown ──────────────────────────────────────────

/**
 * Convierte una Spec a markdown legible.
 * Este es el formato que se guarda en `.vibe/specs/`.
 */
export function specToMarkdown(spec: Spec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.title}`);
  lines.push("");
  lines.push(`> **Instrucción original:** "${spec.userInstruction}"`);
  lines.push("");
  lines.push(`**Estado:** ${formatStatus(spec.status)}`);
  lines.push(`**Creado:** ${new Date(spec.createdAt).toLocaleString("es-CO")}`);
  if (spec.updatedAt !== spec.createdAt) {
    lines.push(`**Actualizado:** ${new Date(spec.updatedAt).toLocaleString("es-CO")}`);
  }
  lines.push("");

  // Objetivo
  lines.push("## Objetivo");
  lines.push("");
  lines.push(spec.objective);
  lines.push("");

  // Alcance
  if (spec.scope.length > 0) {
    lines.push("## Alcance");
    lines.push("");
    for (const item of spec.scope) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  // Archivos
  if (spec.targetFiles.length > 0) {
    lines.push("## Archivos");
    lines.push("");
    for (const file of spec.targetFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }

  // Preguntas abiertas
  if (spec.openQuestions.length > 0) {
    lines.push("## Preguntas por resolver");
    lines.push("");
    for (const q of spec.openQuestions) {
      lines.push(`- [ ] ${q}`);
    }
    lines.push("");
  }

  // Opciones
  if (spec.options.length > 0) {
    lines.push("## Opciones");
    lines.push("");
    for (const opt of spec.options) {
      lines.push(`- ${opt}`);
    }
    lines.push("");
  }

  // Decisiones
  if (spec.decisions.length > 0) {
    lines.push("## Decisiones tomadas");
    lines.push("");
    for (const dec of spec.decisions) {
      lines.push(`- ✅ ${dec}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatStatus(status: Spec["status"]): string {
  switch (status) {
    case "borrador": return "📝 Borrador";
    case "aprobada": return "✅ Aprobada";
    case "en_progreso": return "🔨 En progreso";
    case "completada": return "🎉 Completada";
  }
}

// ─── Markdown to Spec (recovery) ──────────────────────────────

/**
 * Intenta recuperar una Spec desde markdown.
 * Útil para reconstruir desde `.vibe/specs/` si se pierde la memoria.
 */
export function markdownToSpec(markdown: string, id: string): Partial<Spec> {
  const lines = markdown.split("\n");
  const spec: Partial<Spec> = { id };

  // Title from # header
  const titleLine = lines.find((l) => l.startsWith("# "));
  if (titleLine) spec.title = titleLine.slice(2).trim();

  // User instruction from blockquote
  const instructionMatch = markdown.match(/\*\*Instrucción original:\*\*\s*"([^"]+)"/);
  if (instructionMatch) spec.userInstruction = instructionMatch[1];

  // Objective section
  const objIdx = lines.findIndex((l) => l.trim() === "## Objetivo");
  if (objIdx >= 0) {
    const nextSection = lines.findIndex((l, i) => i > objIdx && l.startsWith("## "));
    const end = nextSection >= 0 ? nextSection : lines.length;
    spec.objective = lines.slice(objIdx + 2, end).join("\n").trim();
  }

  // Scope
  spec.scope = extractListItems(lines, "## Alcance");

  // Target files
  spec.targetFiles = extractListItems(lines, "## Archivos").map((f) =>
    f.replace(/`/g, "")
  );

  // Questions
  spec.openQuestions = extractListItems(lines, "## Preguntas por resolver").map(
    (q) => q.replace(/^\[ \] /, "")
  );

  return spec;
}

function extractListItems(lines: string[], sectionHeader: string): string[] {
  const idx = lines.findIndex((l) => l.trim() === sectionHeader);
  if (idx < 0) return [];

  const items: string[] = [];
  for (let i = idx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("## ")) break;
    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
    }
  }
  return items;
}

// ─── Persistence (Dual Layer) ──────────────────────────────────

/**
 * Guarda una spec en ambas capas:
 * 1. Filesystem: `.vibe/specs/{id}.md`
 * 2. Memoria persistente: IndexedDB via Engram
 */
export async function saveSpec(spec: Spec): Promise<void> {
  const markdown = specToMarkdown(spec);

  // Layer 1: Filesystem
  const rootPath = useProjectStore.getState().activeWorkspaceId;
  if (rootPath) {
    const sep = rootPath.includes("\\") ? "\\" : "/";
    const specPath = `${rootPath}${sep}.vibe${sep}specs${sep}${spec.id}.md`;

    try {
      await saveFileContent(specPath, markdown);
    } catch {
      // Filesystem save failed — memory layer will be the fallback
      console.warn(`[spec-writer] No se pudo guardar spec en filesystem: ${specPath}`);
    }
  }

  // Layer 2: Memory
  try {
    const project = rootPath || "unknown";
    await saveMemory({
      project,
      title: `spec: ${spec.title}`,
      content: JSON.stringify(spec),
      type: "decision",
    });
  } catch {
    console.warn("[spec-writer] No se pudo guardar spec en memoria.");
  }
}

/**
 * Carga una spec por ID, primero intentando memoria, luego filesystem.
 */
export async function loadSpec(specId: string): Promise<Spec | null> {
  // Try memory first (faster, more reliable)
  try {
    const rootPath = useProjectStore.getState().activeWorkspaceId || "unknown";
    const results = await searchMemories(rootPath, `spec: ${specId}`, 1);
    if (results.length > 0) {
      const parsed = JSON.parse(results[0].content);
      if (parsed.id === specId) return parsed as Spec;
    }
  } catch {
    // Memory search failed — try filesystem
  }

  // Fallback to filesystem
  const rootPathFs = useProjectStore.getState().activeWorkspaceId;
  if (rootPathFs) {
    const sep = rootPathFs.includes("\\") ? "\\" : "/";
    const specPath = `${rootPathFs}${sep}.vibe${sep}specs${sep}${specId}.md`;

    try {
      const content = await readFileContent(specPath);
      const partial = markdownToSpec(content, specId);
      return partial as Spec;
    } catch {
      // File doesn't exist
    }
  }

  return null;
}

/**
 * Lista todas las specs del proyecto actual.
 */
export async function listSpecs(): Promise<Spec[]> {
  const rootPath = useProjectStore.getState().activeWorkspaceId || "unknown";

  try {
    const results = await searchMemories(rootPath, "spec:", 20);
    return results
      .filter((m) => m.title.startsWith("spec: "))
      .map((m) => {
        try {
          return JSON.parse(m.content) as Spec;
        } catch {
          return null;
        }
      })
      .filter((s): s is Spec => s !== null);
  } catch {
    return [];
  }
}

// ─── Spec Builder (from user instruction) ──────────────────────

/**
 * Crea una spec "borrador" a partir de la instrucción del usuario.
 *
 * Esta es la versión RÁPIDA — crea una estructura básica.
 * El agente Propose la enriquece con contexto del proyecto.
 */
export function createDraftSpec(userInstruction: string): Spec {
  const title = deriveTitle(userInstruction);

  return {
    id: generateSpecId(title),
    title,
    userInstruction,
    objective: userInstruction,
    scope: [],
    targetFiles: [],
    openQuestions: [],
    options: [],
    decisions: [],
    status: "borrador",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Deriva un título corto de la instrucción del usuario.
 * "Haceme un componente de login con Google" → "Login con Google"
 */
function deriveTitle(instruction: string): string {
  // Remove common instruction verbs + optional article
  const cleaned = instruction.replace(
    /^(?:haceme|hazme|crea|crear|haz|hacer|agrega|agregar|añade|añadir|implementa|implementar|genera|generar|construye|construir|quiero|necesito|dame)\s+(?:(?:un|una|el|la|los|las)\s+)?/i,
    ""
  );

  // Capitalize first letter
  let title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Truncate to ~50 chars at word boundary
  if (title.length > 50) {
    const truncated = title.slice(0, 50);
    const lastSpace = truncated.lastIndexOf(" ");
    title = lastSpace > 10 ? truncated.slice(0, lastSpace) : truncated;
  }

  return title;
}

// ─── Exports for testing ───────────────────────────────────────

export const _testOnly = {
  generateSpecId,
  deriveTitle,
  formatStatus,
};
