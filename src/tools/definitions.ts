/**
 * Definiciones de herramientas disponibles para el LLM.
 *
 * Cada herramienta tiene:
 * - name: identificador único (snake_case)
 * - description: descripción en español para el LLM
 * - parameters: schema de parámetros esperados
 * - dangerous: si la herramienta modifica el filesystem
 */

// ─── Types ─────────────────────────────────────────────────────

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  dangerous: boolean;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ─── Tool Definitions ──────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description:
      "Lee el contenido completo de un archivo del proyecto. " +
      "Úsala cuando necesites ver el código actual antes de hacer cambios.",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Ruta relativa al archivo desde la raíz del proyecto (ej: 'src/App.tsx')",
        required: true,
      },
    ],
    dangerous: false,
  },
  {
    name: "write_file",
    description:
      "Crea o sobreescribe un archivo completo en el proyecto. " +
      "El contenido debe ser el archivo COMPLETO, no solo un fragmento. " +
      "Si el archivo ya existe, será reemplazado por completo.",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Ruta relativa al archivo desde la raíz del proyecto",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "Contenido completo del archivo",
        required: true,
      },
    ],
    dangerous: true,
  },
  {
    name: "apply_diff",
    description:
      "Aplica un cambio parcial a un archivo existente. " +
      "Busca el texto exacto de 'search' y lo reemplaza con 'replace'. " +
      "IMPORTANTE: el texto de 'search' DEBE ser único en el archivo — si hay múltiples coincidencias, " +
      "incluye más contexto (líneas antes/después) para desambiguar. " +
      "SIEMPRE usa read_file ANTES para ver el contenido actual.",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Ruta relativa al archivo a modificar",
        required: true,
      },
      {
        name: "search",
        type: "string",
        description: "Texto exacto a buscar (incluyendo indentación y espacios). Debe ser único en el archivo.",
        required: true,
      },
      {
        name: "replace",
        type: "string",
        description: "Texto de reemplazo completo",
        required: true,
      },
    ],
    dangerous: true,
  },
  {
    name: "list_files",
    description:
      "Lista los archivos y directorios dentro de una ruta del proyecto. " +
      "Útil para explorar la estructura antes de leer o crear archivos.",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Ruta relativa al directorio (ej: 'src/components'). Usa '' para la raíz.",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "search_code",
    description:
      "Busca un patrón de texto en todos los archivos del proyecto. " +
      "Retorna las coincidencias con nombre de archivo y línea.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Texto o patrón a buscar",
        required: true,
      },
      {
        name: "path",
        type: "string",
        description: "Directorio donde buscar (opcional, '' = raíz del proyecto)",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "delete_file",
    description:
      "Elimina un archivo del proyecto. Úsala con cuidado.",
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Ruta relativa al archivo a eliminar",
        required: true,
      },
    ],
    dangerous: true,
  },
  {
    name: "memory_save",
    description:
      "Guarda una observación en la memoria persistente del proyecto. " +
      "Usa esta herramienta PROACTIVAMENTE para recordar decisiones arquitectónicas, " +
      "patrones establecidos, bugs corregidos, convenciones del proyecto, o descubrimientos importantes. " +
      "Estas memorias se recuperan automáticamente en futuras sesiones.",
    parameters: [
      {
        name: "title",
        type: "string",
        description: "Título corto y buscable (ej: 'Usar Zustand en vez de Redux', 'Fix N+1 en listado')",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "Contenido detallado: qué se decidió/descubrió, por qué, y archivos afectados",
        required: true,
      },
      {
        name: "type",
        type: "string",
        description: "Categoría: decision, pattern, bugfix, discovery, o convention",
        required: true,
      },
    ],
    dangerous: false,
  },
  {
    name: "memory_search",
    description:
      "Busca en la memoria persistente del proyecto. " +
      "Usa esta herramienta cuando el usuario pregunte sobre decisiones pasadas, " +
      "o cuando necesites contexto sobre cómo se resolvió algo previamente.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Términos de búsqueda en lenguaje natural (ej: 'autenticación', 'componente botón')",
        required: true,
      },
    ],
    dangerous: false,
  },
  {
    name: "dark_memory_agent_memory_save",
    description:
      "Guarda una memoria en dark-memory (backend canónico de memoria del proyecto). " +
      "Usa esta herramienta PROACTIVAMENTE para recordar decisiones arquitectónicas, " +
      "patrones establecidos, bugs corregidos, convenciones del proyecto, o descubrimientos. " +
      "Kind canónico: note, observation, decision, finding, todo, link, context. " +
      "Equivalente a memory_save pero con persistencia cross-session en dark-memory.",
    parameters: [
      {
        name: "title",
        type: "string",
        description: "Título corto y buscable (ej: 'Usar Zustand en vez de Redux', 'Fix N+1 en listado')",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "Contenido detallado: qué se decidió/descubrió, por qué, y archivos afectados",
        required: true,
      },
      {
        name: "kind",
        type: "string",
        description: "Categoría canónica: note, observation, decision, finding, todo, link, context (default: finding)",
        required: false,
      },
      {
        name: "tags",
        type: "string",
        description: "Tags CSV para búsqueda (opcional, ej: 'auth,refactor,2026')",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "dark_memory_agent_memory_recall",
    description:
      "Busca en dark-memory (backend canónico de memoria del proyecto) por relevancia BM25. " +
      "Usa esta herramienta cuando el usuario pregunte sobre decisiones pasadas, " +
      "o cuando necesites contexto sobre cómo se resolvió algo previamente. " +
      "Equivalente a memory_search pero con ranking semántico cross-session.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Términos de búsqueda en lenguaje natural (ej: 'autenticación', 'componente botón')",
        required: true,
      },
    ],
    dangerous: false,
  },
  {
    name: "execute_command",
    description:
      "Ejecuta un comando en la terminal del proyecto. " +
      "Útil para instalar dependencias (npm install), ejecutar tests (npm test), " +
      "builds (npm run build), linters, formatters, git, y cualquier CLI. " +
      "Solo disponible en la app de escritorio.",
    parameters: [
      {
        name: "command",
        type: "string",
        description: "Comando a ejecutar (ej: 'npm install', 'git status', 'npm test')",
        required: true,
      },
      {
        name: "cwd",
        type: "string",
        description: "Directorio de trabajo relativo al proyecto (opcional, default: raíz)",
        required: false,
      },
    ],
    dangerous: true,
  },
  {
    name: "preview_component",
    description:
      "Aísla un componente específico en la vista previa de VibeLens. " +
      "Útil para probar componentes individuales en diferentes dispositivos " +
      "sin necesidad de navegar por toda la app.",
    parameters: [
      {
        name: "component",
        type: "string",
        description: "Nombre del componente a aislar (ej: 'Button', 'LoginForm', 'Header')",
        required: true,
      },
      {
        name: "props",
        type: "string",
        description: "Props JSON del componente para la previsualización (ej: '{\"variant\": \"primary\", \"label\": \"Enviar\"}')",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "refresh_preview",
    description:
      "Fuerza la recarga del preview de VibeLens después de cambios. " +
      "Úsala cuando hayas escrito/actualizado archivos y quieras asegurarte " +
      "de que el preview re-bundlee y muestre el resultado más reciente.",
    parameters: [],
    dangerous: false,
  },
  {
    name: "docs_search",
    description:
      "Busca documentación técnica y soluciones en la web. " +
      "ÚSALA cuando necesites documentación de librerías, sintaxis nueva, " +
      "mejores prácticas actuales, o errores con soluciones conocidas — " +
      "cualquier dato que pueda haber cambiado después de tu entrenamiento. " +
      "NO la uses para buscar dentro del proyecto (usa search_code). " +
      "Después de obtener resultados, cruza 2+ fuentes antes de dar una respuesta definitiva.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Consulta en lenguaje natural (ej: 'React 19 Server Components breaking changes')",
        required: true,
      },
      {
        name: "limit",
        type: "number",
        description: "Máximo de resultados a retornar (1-15, default 8)",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "docs_fetch",
    description:
      "Lee el contenido de una página de documentación, issue o referencia técnica. " +
      "ÚSALA para leer documentación oficial, posts de StackOverflow o issues de GitHub " +
      "que docs_search haya encontrado y necesites leer en detalle. " +
      "SOLO dominios de documentación permitidos (react.dev, developer.mozilla.org, " +
      "github.com, stackoverflow.com, npmjs.com, nodejs.org y similares).",
    parameters: [
      {
        name: "url",
        type: "string",
        description: "URL completa a leer (ej: 'https://react.dev/blog/2024/12/05/react-19')",
        required: true,
      },
      {
        name: "max_length",
        type: "number",
        description: "Máximo de caracteres a retornar (1000-50000, default 20000)",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "code_search",
    description:
      "Busca paquetes y repositorios de código en registros públicos (npm, GitHub). " +
      "ÚSALA para encontrar la librería correcta para una tarea, verificar si un paquete " +
      "existe y cuál es la versión actual, o descubrir ejemplos de implementación. " +
      "Complementa a docs_search cuando necesitas código real, no solo texto.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Términos de búsqueda (ej: 'jwt authentication express middleware')",
        required: true,
      },
      {
        name: "limit",
        type: "number",
        description: "Máximo de resultados a retornar (1-10, default 8)",
        required: false,
      },
    ],
    dangerous: false,
  },
  {
    name: "cve_check",
    description:
      "Verifica vulnerabilidades conocidas (CVEs) de una dependencia npm usando OSV.dev. " +
      "ÚSALA ANTES de agregar una dependencia al proyecto o cuando sospeches que una " +
      "versión instalada tiene problemas de seguridad. " +
      "Retorna severidad (CRITICAL/HIGH/MODERATE/LOW) y la versión que corrige cada vulnerabilidad.",
    parameters: [
      {
        name: "package",
        type: "string",
        description: "Nombre del paquete npm (ej: 'jsonwebtoken', 'lodash', 'axios')",
        required: true,
      },
    ],
    dangerous: false,
  },
  {
    name: "synthesis",
    description:
      "Indicación de síntesis: consolida los resultados de búsquedas anteriores " +
      "(docs_search, docs_fetch, code_search, cve_check) en una conclusión accionable. " +
      "ÚSALA cuando tengas 2+ fuentes y necesites decidir: qué versión usar, qué patrón " +
      "seguir, o si un enfoque es seguro. " +
      "La síntesis la haces TÚ como modelo: esta herramienta solo marca el punto de consolidación. " +
      "Después de sintetizar, guarda el hallazgo con dark_memory_agent_memory_save.",
    parameters: [
      {
        name: "topic",
        type: "string",
        description: "Tema que estás consolidando (ej: 'autenticación JWT en Express')",
        required: true,
      },
      {
        name: "decision",
        type: "string",
        description: "Conclusión: qué elegiste y por qué (ej: 'usar jsonwebtoken v9.0.3 — corrige CVE-2022-23529')",
        required: true,
      },
    ],
    dangerous: false,
  },
];

/**
 * Genera la descripción de herramientas en formato legible para el LLM.
 */
export function formatToolsForPrompt(): string {
  return TOOL_DEFINITIONS.map((tool) => {
    const params = tool.parameters
      .map(
        (p) =>
          `  - ${p.name} (${p.type}${p.required ? ", requerido" : ", opcional"}): ${p.description}`,
      )
      .join("\n");
    return `### ${tool.name}\n${tool.description}\nParámetros:\n${params}`;
  }).join("\n\n");
}
