// ─── Tipos ─────────────────────────────────────────────────────

export interface TranslationEntry {
  /** Patrón para buscar en el texto de salida */
  pattern: RegExp;
  /** Texto de reemplazo en español */
  replacement: string;
  /** Si es true, se traduce solo si el patrón está al inicio de la línea */
  lineStartOnly?: boolean;
}

// ─── Traducciones ─────────────────────────────────────────────

/**
 * Catálogo de traducciones para mensajes comunes de terminal.
 * Se aplican en orden de definición.
 */
export const TRANSLATIONS: TranslationEntry[] = [
  // ─── Errores comunes ────────────────────────────────────────
  {
    pattern: /Error:\s*Cannot find module\s+'([^']+)'/i,
    replacement: "Error: No se encuentra el módulo '$1'",
  },
  {
    pattern: /command not found/i,
    replacement: "comando no encontrado",
  },
  {
    pattern: /Permission denied/i,
    replacement: "Permiso denegado",
  },
  {
    pattern: /File not found/i,
    replacement: "Archivo no encontrado",
  },
  {
    pattern: /No such file or directory/i,
    replacement: "El archivo o directorio no existe",
  },
  {
    pattern: /is not recognized as an internal or external command/i,
    replacement: "no se reconoce como un comando interno o externo",
  },
  {
    pattern: /Access is denied/i,
    replacement: "Acceso denegado",
  },
  {
    pattern: /The system cannot find the (file|path) specified/i,
    replacement: "El sistema no puede encontrar la ruta especificada",
  },

  // ─── Git ─────────────────────────────────────────────────────
  {
    pattern: /^On branch /im,
    replacement: "En la rama ",
  },
  {
    pattern: /^Your branch is up to date with/im,
    replacement: "Tu rama está actualizada con",
  },
  {
    pattern: /^Your branch is ahead of/im,
    replacement: "Tu rama está adelante de",
  },
  {
    pattern: /^nothing to commit, working tree clean/im,
    replacement: "no hay nada para confirmar, el árbol de trabajo está limpio",
  },
  {
    pattern: /^Changes not staged for commit:/im,
    replacement: "Cambios no preparados para confirmar:",
  },
  {
    pattern: /^Changes to be committed:/im,
    replacement: "Cambios a confirmar:",
  },
  {
    pattern: /^Untracked files:/im,
    replacement: "Archivos sin seguimiento:",
  },
  {
    pattern: /^modified:\s+/im,
    replacement: "modificado: ",
  },
  {
    pattern: /^new file:\s+/im,
    replacement: "archivo nuevo: ",
  },
  {
    pattern: /^deleted:\s+/im,
    replacement: "eliminado: ",
  },
  {
    pattern: /^renamed:\s+/im,
    replacement: "renombrado: ",
  },
  {
    pattern: /fatal: not a git repository/i,
    replacement: "Error: no es un repositorio git",
  },
  {
    pattern: /fatal: /i,
    replacement: "Error grave: ",
  },

  // ─── npm ─────────────────────────────────────────────────────
  {
    pattern: /^npm ERR!/im,
    replacement: "npm ERROR:",
  },
  {
    pattern: /^npm WARN/i,
    replacement: "npm ADVERTENCIA:",
  },
  {
    pattern: /npm ERR! code [A-Z_]+/i,
    replacement: "npm ERROR - código de error",
  },
  {
    pattern: /up to date/i,
    replacement: "actualizado",
  },
  {
    pattern: /added (\d+) packages?/i,
    replacement: "se agregó $1 paquete",
  },
  {
    pattern: /removed (\d+) package/i,
    replacement: "se eliminó $1 paquete",
  },
  {
    pattern: /found (\d+) vulnerabilities/i,
    replacement: "se encontraron $1 vulnerabilidades",
  },
  {
    pattern: /audited (\d+) packages? in [\d.]+[ms]/i,
    replacement: "se auditaron $1 paquetes",
  },

  // ─── node ────────────────────────────────────────────────────
  {
    pattern: /node:\d+:uncaught/i,
    replacement: "Error no capturado en Node:",
  },
  {
    pattern: /throw err/i,
    replacement: "Error lanzado",
  },
  {
    pattern: /Error: Cannot find module/i,
    replacement: "Error: No se encuentra el módulo",
  },
];

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Traduce un texto de salida de terminal al español.
 * Las partes no traducibles pasan sin cambios.
 *
 * @param output - Texto original de salida (stdout o stderr)
 * @returns Texto traducido
 */
export function translateOutput(output: string): string {
  if (!output) return output;

  let result = output;

  for (const entry of TRANSLATIONS) {
    result = result.replace(entry.pattern, entry.replacement);
  }

  return result;
}

/**
 * Detecta si el texto contiene indicaciones de error conocidas.
 * Útil para colorear la salida (rojo para errores).
 *
 * @param output - Texto a analizar
 * @returns true si parece ser un mensaje de error
 */
export function isErrorOutput(output: string): boolean {
  const errorPatterns = [
    /^Error:/im,
    /error/i,
    /failed/i,
    /not found/i,
    /denied/i,
    /ERR!/i,
    /fatal:/i,
    /Cannot find/i,
    /SyntaxError/i,
    /TypeError/i,
    /ReferenceError/i,
    /exceeded/i,
    /timed? ?out/i,
  ];

  return errorPatterns.some((p) => p.test(output));
}

/**
 * Detecta si el texto contiene advertencias.
 *
 * @param output - Texto a analizar
 * @returns true si parece ser una advertencia
 */
export function isWarningOutput(output: string): boolean {
  return /^npm WARN/i.test(output) || /warning/i.test(output);
}
