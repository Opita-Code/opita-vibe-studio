import type { ConstruirOutput, FileOutput } from "./types";

// ─── Constants ─────────────────────────────────────────────────

/** Regex para detectar bloques de código con ruta de archivo:
 *  ```file:ruta/al/archivo.ext
 *  contenido
 *  ```
 *
 * También soporta formato con lenguaje:
 *  ```html file:ruta/index.html
 *  ```
 */
const FILE_BLOCK_REGEX = /```(?:\w+\s+)?file:(.+?)\n([\s\S]*?)```/g;

/** Regex para detectar el resumen (último párrafo sin marcador). */
const SUMMARY_REGEX = /(?:\*\*Resumen\*\*|## Resumen)\s*:?\s*([\s\S]+?)(?:\n##|\n---|$)/i;

// ─── Parser ────────────────────────────────────────────────────

/**
 * Parsea la respuesta de la fase Construir y extrae los bloques de código
 * con rutas de archivo, más el resumen.
 *
 * Formato esperado:
 * ```file:ruta/al/archivo.ext
 * contenido del archivo
 * ```
 *
 * También soporta bloques con lenguaje explícito:
 * ```html file:ruta/index.html
 * ```
 */
export function parseConstruirResponse(text: string): ConstruirOutput {
  const files: FileOutput[] = [];

  // Buscar bloques ```file:path
  let match: RegExpExecArray | null;

  while ((match = FILE_BLOCK_REGEX.exec(text)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();

    if (path && content) {
      // Verificar si el path incluye un lenguaje (ej: "html file:path")
      const pathClean = path.replace(/^\w+\s+file:/, "").trim();

      // Evitar duplicados (último match gana si hay paths repetidos)
      const existing = files.findIndex((f) => f.path === pathClean);
      const fileOutput: FileOutput = { path: pathClean, content };

      if (existing >= 0) {
        files[existing] = fileOutput;
      } else {
        files.push(fileOutput);
      }
    }
  }

  // Extraer resumen
  let summary = "";
  const summaryMatch = text.match(SUMMARY_REGEX);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  } else {
    // Si no hay encabezado de resumen, tomar el último párrafo relevante
    const paragraphs = text.split("\n\n").filter((p) => p.trim());
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      const p = paragraphs[i].trim();
      if (p && !p.startsWith("```") && !p.startsWith("##") && p.length > 20) {
        summary = p;
        break;
      }
    }
  }

  return {
    files,
    summary,
    fullResponse: text,
  };
}

/**
 * Parsea bloques de código con el formato alternativo:
 * ```html
 * <!-- file:ruta/al/archivo.ext -->
 * contenido
 * ```
 *
 * Se usa como fallback si el formato primario no encontró nada.
 */
export function parseConstruirResponseFallback(text: string): ConstruirOutput {
  const primary = parseConstruirResponse(text);
  if (primary.files.length > 0) return primary;

  const files: FileOutput[] = [];
  const blockRegex = /```(\w+)?\n[\s\S]*?<!--\s*file:(.+?)\s*-->[\s\S]*?```/g;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text)) !== null) {
    const path = match[2].trim();
    const content = match[0]
      .replace(/^```\w*\n/, "")
      .replace(/\n```$/, "")
      .replace(/<!--\s*file:.+?\s*-->\n?/, "")
      .trim();

    if (path && content) {
      files.push({ path, content });
    }
  }

  return {
    files,
    summary: primary.summary,
    fullResponse: text,
  };
}
