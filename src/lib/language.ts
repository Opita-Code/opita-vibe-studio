/**
 * Detecta el lenguaje de Monaco a partir de la extensión de un archivo.
 * Útil para el editor y para testeo independiente de Monaco.
 *
 * Monaco language identifiers:
 *   - typescript / typescriptreact (JSX)
 *   - javascript / javascriptreact (JSX)
 *   - html, css, scss, less, json, jsonc, markdown, xml, yaml, shell, python, etc.
 *
 * @see https://github.com/microsoft/monaco-editor/tree/main/src/basic-languages
 */
export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const name = path.split(/[/\\]/).pop()?.toLowerCase() ?? "";

  // ── Special filenames ─────────────────────────────────────
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name === ".env" || name.startsWith(".env.")) return "ini";
  if (name === ".gitignore" || name === ".dockerignore") return "plaintext";
  if (name === "makefile") return "plaintext";

  switch (ext) {
    // ── Web Core ────────────────────────────────────────────
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "less":
      return "less";

    // ── JavaScript / TypeScript ─────────────────────────────
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascriptreact";
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "tsx":
      return "typescriptreact";

    // ── Data ────────────────────────────────────────────────
    case "json":
      return "json";
    case "jsonc":
      return "jsonc";
    case "yaml":
    case "yml":
      return "yaml";
    case "xml":
    case "svg":
    case "plist":
      return "xml";
    case "toml":
      return "ini"; // Monaco doesn't have native toml — ini is close

    // ── Markup ──────────────────────────────────────────────
    case "md":
    case "mdx":
      return "markdown";

    // ── Scripting ───────────────────────────────────────────
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "ps1":
    case "psm1":
      return "powershell";
    case "bat":
    case "cmd":
      return "bat";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    case "php":
      return "php";
    case "lua":
      return "lua";
    case "pl":
    case "pm":
      return "perl";

    // ── Systems ─────────────────────────────────────────────
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "java":
      return "java";
    case "kt":
    case "kts":
      return "kotlin";
    case "swift":
      return "swift";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return "cpp";
    case "cs":
      return "csharp";

    // ── Query / Schema ──────────────────────────────────────
    case "sql":
      return "sql";
    case "graphql":
    case "gql":
      return "graphql";
    case "prisma":
      return "plaintext"; // No Monaco support

    // ── Config ──────────────────────────────────────────────
    case "ini":
    case "cfg":
    case "conf":
    case "properties":
      return "ini";
    case "env":
      return "ini";

    // ── Other ───────────────────────────────────────────────
    case "r":
      return "r";
    case "dart":
      return "dart";
    case "dockerfile":
      return "dockerfile";
    case "tf":
    case "tfvars":
      return "hcl";
    case "lock":
      return "plaintext";

    default:
      return "plaintext";
  }
}

// ─── File Extension by Language ────────────────────────────────

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  javascript: "js",
  javascriptreact: "jsx",
  typescript: "ts",
  typescriptreact: "tsx",
  json: "json",
  jsonc: "jsonc",
  markdown: "md",
  xml: "xml",
  yaml: "yml",
  shell: "sh",
  powershell: "ps1",
  bat: "bat",
  python: "py",
  ruby: "rb",
  php: "php",
  rust: "rs",
  go: "go",
  java: "java",
  kotlin: "kt",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  sql: "sql",
  graphql: "graphql",
  ini: "ini",
  dockerfile: "Dockerfile",
  dart: "dart",
  lua: "lua",
  perl: "pl",
  r: "r",
  plaintext: "txt",
};

/**
 * Sugiere una extensión de archivo para un lenguaje de código dado.
 * Útil cuando se quiere guardar un bloque de código del chat como archivo.
 */
export function getLanguageExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language] ?? "txt";
}

/**
 * Sugiere un nombre de archivo por defecto para un lenguaje de código.
 */
export function suggestFilename(language: string): string {
  const ext = getLanguageExtension(language);
  switch (language) {
    case "html":
      return `index.${ext}`;
    case "css":
    case "scss":
    case "less":
      return `styles.${ext}`;
    case "javascript":
    case "javascriptreact":
      return `script.${ext}`;
    case "typescript":
    case "typescriptreact":
      return `script.${ext}`;
    case "python":
      return `script.${ext}`;
    case "shell":
    case "bash":
      return `script.${ext}`;
    default:
      return `codigo.${ext}`;
  }
}
