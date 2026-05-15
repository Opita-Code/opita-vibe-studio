/**
 * Agent Tool Sets — Specialized MCP tools per SDD phase sub-agent.
 *
 * Each SDD phase gets a UNIQUE toolset tailored to its mission:
 * - Explore: investigación profunda (web, proyecto, memoria, dependencias)
 * - Propose: lectura + análisis (read-only, genera propuestas)
 * - Design: arquitectura (lectura + guardado de decisiones)
 * - Apply: construcción (filesystem completo + ejecución)
 * - Verify: validación (tests + lectura + análisis)
 * - Chat: conversación (memoria básica)
 */

import type { ToolDefinition } from "@/tools/definitions";

// ─── Chat Tools ────────────────────────────────────────────────
// Conversación libre — solo memoria

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    name: "memory_search",
    description: "Busca en la memoria del proyecto: decisiones, patrones, contexto previo.",
    parameters: [
      { name: "query", type: "string", description: "Término de búsqueda", required: true },
    ],
    dangerous: false,
  },
  {
    name: "memory_save",
    description: "Guarda un aprendizaje o decisión importante.",
    parameters: [
      { name: "title", type: "string", description: "Título corto y buscable", required: true },
      { name: "content", type: "string", description: "Detalle", required: true },
      { name: "type", type: "string", description: "Tipo: decision | pattern | bugfix | discovery | convention", required: false },
    ],
    dangerous: false,
  },
];

// ─── Explore Tools ─────────────────────────────────────────────
// Investigación profunda: web, proyecto, memoria, dependencias

export const EXPLORE_TOOLS: ToolDefinition[] = [
  // Project navigation
  {
    name: "read_file",
    description: "Lee un archivo del proyecto para analizarlo.",
    parameters: [
      { name: "path", type: "string", description: "Ruta relativa al archivo", required: true },
    ],
    dangerous: false,
  },
  {
    name: "list_files",
    description: "Explora la estructura de directorios del proyecto.",
    parameters: [
      { name: "path", type: "string", description: "Directorio a explorar (vacío = raíz)", required: false },
    ],
    dangerous: false,
  },
  {
    name: "search_code",
    description: "Busca texto o patrones en todos los archivos del proyecto.",
    parameters: [
      { name: "query", type: "string", description: "Texto a buscar", required: true },
      { name: "path", type: "string", description: "Subdirectorio para filtrar", required: false },
    ],
    dangerous: false,
  },
  // Web research
  {
    name: "web_search",
    description: "Busca información en internet: APIs, librerías, patrones, soluciones, documentación.",
    parameters: [
      { name: "query", type: "string", description: "Consulta de búsqueda", required: true },
      { name: "max_results", type: "number", description: "Máximo de resultados (default: 5)", required: false },
    ],
    dangerous: false,
  },
  {
    name: "browse_url",
    description: "Navega a una URL y extrae contenido como texto. Para docs, READMEs, artículos.",
    parameters: [
      { name: "url", type: "string", description: "URL completa", required: true },
    ],
    dangerous: false,
  },
  // Memory
  {
    name: "memory_search",
    description: "Busca decisiones, bugs resueltos, convenciones y descubrimientos previos.",
    parameters: [
      { name: "query", type: "string", description: "Término de búsqueda", required: true },
    ],
    dangerous: false,
  },
  {
    name: "memory_save",
    description: "Guarda un hallazgo o conclusión de la investigación.",
    parameters: [
      { name: "title", type: "string", description: "Título corto", required: true },
      { name: "content", type: "string", description: "Detalle del hallazgo", required: true },
      { name: "type", type: "string", description: "Tipo: decision | pattern | discovery", required: false },
    ],
    dangerous: false,
  },
  // Analysis
  {
    name: "analyze_dependencies",
    description: "Analiza dependencias: versiones, vulnerabilidades, alternativas modernas, tamaño de bundle.",
    parameters: [
      { name: "package_name", type: "string", description: "Paquete a analizar (vacío = todos)", required: false },
    ],
    dangerous: false,
  },
];

// ─── Propose Tools ─────────────────────────────────────────────
// Read-only: lee proyecto y memoria para generar propuestas

export const PROPOSE_TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Lee un archivo para entender el contexto antes de proponer cambios.",
    parameters: [
      { name: "path", type: "string", description: "Ruta relativa al archivo", required: true },
    ],
    dangerous: false,
  },
  {
    name: "list_files",
    description: "Explora la estructura para planificar qué archivos se tocarán.",
    parameters: [
      { name: "path", type: "string", description: "Directorio a explorar", required: false },
    ],
    dangerous: false,
  },
  {
    name: "search_code",
    description: "Busca patrones existentes para asegurar consistencia en la propuesta.",
    parameters: [
      { name: "query", type: "string", description: "Texto a buscar", required: true },
      { name: "path", type: "string", description: "Subdirectorio para filtrar", required: false },
    ],
    dangerous: false,
  },
  {
    name: "memory_search",
    description: "Busca decisiones anteriores para no contradecirlas en la propuesta.",
    parameters: [
      { name: "query", type: "string", description: "Término de búsqueda", required: true },
    ],
    dangerous: false,
  },
];

// ─── Design Tools ──────────────────────────────────────────────
// Arquitectura: lectura profunda + guardado de decisiones

export const DESIGN_TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Lee archivos de código, configuración o documentación existente.",
    parameters: [
      { name: "path", type: "string", description: "Ruta relativa al archivo", required: true },
    ],
    dangerous: false,
  },
  {
    name: "list_files",
    description: "Explora la estructura para definir dónde encajan los nuevos componentes.",
    parameters: [
      { name: "path", type: "string", description: "Directorio", required: false },
    ],
    dangerous: false,
  },
  {
    name: "search_code",
    description: "Busca patrones y dependencias para diseñar interfaces consistentes.",
    parameters: [
      { name: "query", type: "string", description: "Texto a buscar", required: true },
      { name: "path", type: "string", description: "Subdirectorio", required: false },
    ],
    dangerous: false,
  },
  {
    name: "memory_search",
    description: "Busca decisiones arquitectónicas previas para mantener coherencia.",
    parameters: [
      { name: "query", type: "string", description: "Término de búsqueda", required: true },
    ],
    dangerous: false,
  },
  {
    name: "memory_save",
    description: "Guarda decisiones arquitectónicas y trade-offs del diseño.",
    parameters: [
      { name: "title", type: "string", description: "Título de la decisión", required: true },
      { name: "content", type: "string", description: "Detalle y justificación", required: true },
      { name: "type", type: "string", description: "Tipo: decision | architecture", required: false },
    ],
    dangerous: false,
  },
  {
    name: "web_search",
    description: "Investiga patrones de diseño, arquitecturas de referencia, best practices.",
    parameters: [
      { name: "query", type: "string", description: "Consulta", required: true },
      { name: "max_results", type: "number", description: "Máximo resultados (default: 3)", required: false },
    ],
    dangerous: false,
  },
];

// ─── Apply Tools ───────────────────────────────────────────────
// Construcción: filesystem completo + ejecución de comandos

export const APPLY_TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Lee un archivo antes de modificarlo para mantener consistencia.",
    parameters: [
      { name: "path", type: "string", description: "Ruta relativa", required: true },
    ],
    dangerous: false,
  },
  {
    name: "write_file",
    description: "Crea o sobreescribe un archivo completo.",
    parameters: [
      { name: "path", type: "string", description: "Ruta relativa", required: true },
      { name: "content", type: "string", description: "Contenido completo del archivo", required: true },
    ],
    dangerous: true,
  },
  {
    name: "apply_diff",
    description: "Aplica un cambio parcial a un archivo. SIEMPRE lee el archivo antes.",
    parameters: [
      { name: "path", type: "string", description: "Ruta del archivo", required: true },
      { name: "search", type: "string", description: "Texto exacto a buscar (debe ser único)", required: true },
      { name: "replace", type: "string", description: "Texto de reemplazo", required: true },
    ],
    dangerous: true,
  },
  {
    name: "delete_file",
    description: "Elimina un archivo del proyecto.",
    parameters: [
      { name: "path", type: "string", description: "Ruta del archivo", required: true },
    ],
    dangerous: true,
  },
  {
    name: "list_files",
    description: "Explora estructura de directorios.",
    parameters: [
      { name: "path", type: "string", description: "Directorio (vacío = raíz)", required: false },
    ],
    dangerous: false,
  },
  {
    name: "search_code",
    description: "Busca texto en archivos del proyecto.",
    parameters: [
      { name: "query", type: "string", description: "Texto a buscar", required: true },
      { name: "path", type: "string", description: "Subdirectorio", required: false },
    ],
    dangerous: false,
  },
  {
    name: "execute_command",
    description: "Ejecuta un comando en la terminal: tests, instalar paquetes, builds, linters.",
    parameters: [
      { name: "command", type: "string", description: "Comando a ejecutar", required: true },
      { name: "cwd", type: "string", description: "Directorio de trabajo (relativo)", required: false },
    ],
    dangerous: true,
  },
  {
    name: "memory_save",
    description: "Guarda un aprendizaje del proceso de construcción.",
    parameters: [
      { name: "title", type: "string", description: "Título", required: true },
      { name: "content", type: "string", description: "Detalle", required: true },
      { name: "type", type: "string", description: "Tipo: bugfix | pattern | decision", required: false },
    ],
    dangerous: false,
  },
];

// ─── Verify Tools ──────────────────────────────────────────────
// Validación: ejecutar tests + lectura + análisis

export const VERIFY_TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Lee archivos para verificar que los cambios son correctos.",
    parameters: [
      { name: "path", type: "string", description: "Ruta relativa", required: true },
    ],
    dangerous: false,
  },
  {
    name: "search_code",
    description: "Busca patrones para verificar consistencia de los cambios.",
    parameters: [
      { name: "query", type: "string", description: "Texto a buscar", required: true },
      { name: "path", type: "string", description: "Subdirectorio", required: false },
    ],
    dangerous: false,
  },
  {
    name: "list_files",
    description: "Verifica que la estructura de archivos es correcta después de cambios.",
    parameters: [
      { name: "path", type: "string", description: "Directorio", required: false },
    ],
    dangerous: false,
  },
  {
    name: "execute_command",
    description: "Ejecuta tests, type-check, lint, o build para validar los cambios.",
    parameters: [
      { name: "command", type: "string", description: "Comando de verificación", required: true },
      { name: "cwd", type: "string", description: "Directorio de trabajo", required: false },
    ],
    dangerous: true,
  },
  {
    name: "apply_diff",
    description: "Aplica correcciones menores si la verificación detecta problemas.",
    parameters: [
      { name: "path", type: "string", description: "Ruta del archivo", required: true },
      { name: "search", type: "string", description: "Texto exacto", required: true },
      { name: "replace", type: "string", description: "Corrección", required: true },
    ],
    dangerous: true,
  },
  {
    name: "memory_save",
    description: "Guarda el resultado de la verificación y lecciones aprendidas.",
    parameters: [
      { name: "title", type: "string", description: "Título", required: true },
      { name: "content", type: "string", description: "Detalle del resultado", required: true },
      { name: "type", type: "string", description: "Tipo: bugfix | discovery", required: false },
    ],
    dangerous: false,
  },
];

// ─── Phase-Based Tool Getter ───────────────────────────────────

export type SDDPhase = "chat" | "explore" | "propose" | "design" | "apply" | "verify";

/**
 * Returns the specialized tool set for a specific SDD phase.
 *
 * Each phase sees ONLY the tools it needs — this prevents misuse
 * (e.g., explore agent can't write files, verify agent can't delete).
 */
export function getToolsForPhase(phase: SDDPhase): ToolDefinition[] {
  switch (phase) {
    case "chat":
      return CHAT_TOOLS;
    case "explore":
      return EXPLORE_TOOLS;
    case "propose":
      return PROPOSE_TOOLS;
    case "design":
      return DESIGN_TOOLS;
    case "apply":
      return APPLY_TOOLS;
    case "verify":
      return VERIFY_TOOLS;
  }
}

/**
 * Returns tool names for a specific SDD phase.
 */
export function getToolNamesForPhase(phase: SDDPhase): string[] {
  return getToolsForPhase(phase).map((t) => t.name);
}

/**
 * Returns whether a tool is dangerous (modifies state) for a given phase.
 */
export function isDangerousTool(phase: SDDPhase, toolName: string): boolean {
  const tools = getToolsForPhase(phase);
  const tool = tools.find((t) => t.name === toolName);
  return tool?.dangerous ?? true; // Default to dangerous if unknown
}
