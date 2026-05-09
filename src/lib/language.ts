/**
 * Detecta el lenguaje de Monaco a partir de la extensión de un archivo.
 * Útil para el editor y para testeo independiente de Monaco.
 */
export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
      return "html";
    case "css":
      return "css";
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "md":
    case "mdx":
      return "markdown";
    case "xml":
      return "xml";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "bash":
      return "shell";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "toml":
      return "plaintext";
    default:
      return "plaintext";
  }
}

// ─── File Extension by Language ────────────────────────────────

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  html: "html",
  css: "css",
  javascript: "js",
  typescript: "ts",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  markdown: "md",
  xml: "xml",
  yaml: "yml",
  shell: "sh",
  bash: "sh",
  python: "py",
  rust: "rs",
  toml: "toml",
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
      return `styles.${ext}`;
    case "javascript":
      return `script.${ext}`;
    case "typescript":
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
