/**
 * Vibe Pad — Dynamic language loading.
 *
 * Lazy-loads CodeMirror language extensions on demand.
 * Only the grammar for the active file is loaded, reducing initial bundle.
 */

import type { Extension } from "@codemirror/state";

/**
 * Loads the appropriate CodeMirror language extension for a given language ID.
 * Language IDs match those returned by `detectLanguage()` from `@/lib/language`.
 *
 * @returns A CM6 Extension (or empty array for plaintext)
 */
export async function loadLanguage(langId: string): Promise<Extension> {
  switch (langId) {
    // ── JavaScript / TypeScript ────────────────────────────────
    case "javascript":
    case "javascriptreact":
      return (await import("@codemirror/lang-javascript")).javascript({
        jsx: true,
      });
    case "typescript":
    case "typescriptreact":
      return (await import("@codemirror/lang-javascript")).javascript({
        jsx: true,
        typescript: true,
      });

    // ── Web ───────────────────────────────────────────────────
    case "html":
      return (await import("@codemirror/lang-html")).html();
    case "css":
    case "scss":
    case "less":
      return (await import("@codemirror/lang-css")).css();

    // ── Data ──────────────────────────────────────────────────
    case "json":
    case "jsonc":
      return (await import("@codemirror/lang-json")).json();
    case "xml":
      return (await import("@codemirror/lang-xml")).xml();
    case "yaml":
      return (await import("@codemirror/lang-yaml")).yaml();

    // ── Markup ────────────────────────────────────────────────
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();

    // ── Scripting ─────────────────────────────────────────────
    case "python":
      return (await import("@codemirror/lang-python")).python();

    // ── Plaintext / unsupported ───────────────────────────────
    default:
      return [];
  }
}
