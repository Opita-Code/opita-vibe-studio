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
