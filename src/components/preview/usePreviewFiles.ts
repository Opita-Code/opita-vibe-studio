/**
 * usePreviewFiles — Maps project files from Zustand store to Sandpack virtual filesystem.
 *
 * Responsibilities:
 * - Filters only web-previewable files (tsx, jsx, css, html, etc.)
 * - Auto-detects the appropriate Sandpack template
 * - Debounces updates to prevent re-bundling on every keystroke
 * - Limits file count for Sandpack performance
 */

import { useMemo } from "react";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";

// ─── Constants ──────────────────────────────────────────────────

/** File extensions that Sandpack can handle */
const PREVIEWABLE_EXTENSIONS = new Set([
  ".tsx", ".jsx", ".ts", ".js", ".mjs",
  ".css", ".scss", ".less",
  ".html", ".htm",
  ".json",
  ".svg",
  ".md", ".mdx",
]);

/** Directories to exclude from preview */
const EXCLUDED_DIRS = new Set([
  "node_modules", "dist", "build", ".git", ".next", ".nuxt",
  "coverage", ".cache", "__pycache__", ".turbo",
  "__tests__", "__test__", "__mocks__",
]);

/** File patterns to exclude */
const EXCLUDED_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.stories\.[jt]sx?$/,
  /\.config\.[jt]s$/,
  /vite\.config/,
  /tsconfig/,
  /eslint/,
  /prettier/,
  /\.d\.ts$/,
];

/** Maximum files to send to Sandpack (performance limit) */
const MAX_SANDPACK_FILES = 30;

// ─── Types ──────────────────────────────────────────────────────

export type SandpackTemplate = "react-ts" | "react" | "vanilla-ts" | "vanilla" | "static";

export interface PreviewFiles {
  /** Files mapped for Sandpack: { "/path": content } */
  files: Record<string, string>;
  /** Auto-detected template */
  template: SandpackTemplate;
  /** Whether there are any files worth previewing */
  hasPreviewableFiles: boolean;
  /** Count of previewable files found */
  fileCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Checks if a file path should be included in the preview.
 */
export function isPreviewableFile(relativePath: string): boolean {
  // Check extension
  const ext = "." + (relativePath.split(".").pop() || "").toLowerCase();
  if (!PREVIEWABLE_EXTENSIONS.has(ext)) return false;

  // Check excluded directories
  const segments = relativePath.replace(/\\/g, "/").split("/");
  for (const seg of segments) {
    if (EXCLUDED_DIRS.has(seg)) return false;
  }

  // Check excluded patterns
  const basename = segments[segments.length - 1];
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(basename)) return false;
  }

  return true;
}

/**
 * Detects the best Sandpack template from file extensions present.
 *
 * Priority:
 * 1. React (.tsx/.jsx) → react-ts / react
 * 2. HTML-first (root index.html, NO src/ folder) → static
 *    Pure HTML+JS/CSS sites where JS is loaded via <script> tags.
 * 3. HTML + src/ folder (e.g. Vite/CRA app) → vanilla-ts / vanilla
 *    The index.html is a shell; bundled JS drives the page.
 * 4. TypeScript without HTML → vanilla-ts
 * 5. Fallback → vanilla
 */
export function detectTemplate(filePaths: string[]): SandpackTemplate {
  if (filePaths.length === 0) return "vanilla";

  const extensions = new Set(
    filePaths.map((p) => "." + (p.split(".").pop() || "").toLowerCase())
  );

  // React projects always take priority
  if (extensions.has(".tsx")) return "react-ts";
  if (extensions.has(".jsx")) return "react";

  // Check for src/ folder — indicates a bundled app (Vite, CRA, etc.)
  const hasSrcFiles = filePaths.some((p) =>
    p.replace(/\\/g, "/").startsWith("src/") || p.replace(/\\/g, "/").includes("/src/")
  );

  // HTML-first detection: root index.html WITHOUT a src/ folder = static site.
  // JS/CSS files alongside are loaded via <script>/<link> tags, not as entry points.
  // But if there's a src/ folder, the HTML is just a shell for a bundled app.
  const hasRootHtml = filePaths.some((p) => {
    const normalized = p.replace(/\\/g, "/").replace(/^\/+/, "");
    return /^(index|main)\.(html|htm)$/i.test(normalized);
  });

  if (hasRootHtml && !hasSrcFiles) return "static";

  // JS/TS-only projects (no HTML entry point)
  if (extensions.has(".ts")) return "vanilla-ts";
  return "vanilla";
}

/**
 * Converts a project-relative path to a Sandpack-compatible path.
 * Sandpack expects paths starting with "/"
 */
function toSandpackPath(relativePath: string, rootPath: string): string {
  let cleaned = relativePath
    .replace(rootPath, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  // Remove "src/" prefix if present — Sandpack expects flat-ish structure
  // but we keep it to maintain import compatibility
  return "/" + cleaned;
}

// ─── Hook ───────────────────────────────────────────────────────

/**
 * Maps the current project's file contents to Sandpack's virtual filesystem.
 *
 * Returns memoized result that only updates when fileContents change.
 */
export function usePreviewFiles(): PreviewFiles {
  const fileContents = useProjectStore((s) => s.fileContents);
  const rootPath = useProjectStore((s) => s.activeWorkspaceId) || "";
  const previewTarget = useUIStore((s) => s.previewTarget);
  const vibeLensEnabled = useUIStore((s) => s.vibeLensEnabled);

  return useMemo(() => {
    const entries = Object.entries(fileContents);

    if (entries.length === 0) {
      return { files: {}, template: "react-ts" as const, hasPreviewableFiles: false, fileCount: 0 };
    }

    // Filter and map files
    const sandpackFiles: Record<string, string> = {};
    const includedPaths: string[] = [];
    let count = 0;

    for (const [fullPath, content] of entries) {
      if (count >= MAX_SANDPACK_FILES) break;

      const relativePath = fullPath
        .replace(rootPath, "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

      if (!isPreviewableFile(relativePath)) continue;

      const sandpackPath = toSandpackPath(fullPath, rootPath);
      sandpackFiles[sandpackPath] = content;
      includedPaths.push(relativePath);
      count++;
    }

    // Modo Aislado (Intelligent Preview)
    // Si tenemos un previewTarget (ej. /src/components/Boton.tsx) y está habilitado,
    // inyectamos un App.tsx efímero que lo monta centrado.
    if (vibeLensEnabled && previewTarget) {
      // previewTarget usualmente viene como ruta absoluta local, debemos pasarla a ruta Sandpack
      const targetSandpackPath = toSandpackPath(previewTarget, rootPath);
      
      // Verificamos si existe en los archivos que estamos mandando
      if (sandpackFiles[targetSandpackPath]) {
        // Le quitamos la extensión para el import
        const importPath = "." + targetSandpackPath.replace(/\.[jt]sx?$/, "");
        
        sandpackFiles["/App.tsx"] = `
import React from 'react';
import Component from '${importPath}';

export default function IsolatedPreview() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem' }}>
      <Component />
    </div>
  );
}
`;
        // Forzamos la plantilla a react-ts para que use nuestro App.tsx
        return {
          files: sandpackFiles,
          template: "react-ts",
          hasPreviewableFiles: true,
          fileCount: count + 1,
        };
      }
    }

    const hasPreviewableFiles = count > 0;
    let template = hasPreviewableFiles ? detectTemplate(includedPaths) : "static";

    // INJECT FALLBACK HTML:
    // To prevent "Cannot set properties of null (setting 'innerHTML')" errors
    // when AI writes to #root or #app, we guarantee an index.html exists with both mount points
    // if the user hasn't explicitly created one.
    if (hasPreviewableFiles && !sandpackFiles["/index.html"] && !sandpackFiles["/public/index.html"]) {
      const isReact = template === "react-ts" || template === "react";
      const htmlPath = isReact ? "/public/index.html" : "/index.html";
      
      sandpackFiles[htmlPath] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Studio Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <div id="app"></div>
  </body>
</html>`;
    }

    // INJECT REACT ENTRY POINTS:
    // Sandpack react/react-ts templates require /src/index.tsx (or .jsx) and /src/App.tsx.
    // Without them, Sandpack's internal bundler fetches /src/main.jsx → 404.
    // We inject minimal entry points that mount whatever App component exists.
    if (template === "react-ts" || template === "react") {
      const ext = template === "react-ts" ? "tsx" : "jsx";

      if (!sandpackFiles[`/src/index.${ext}`] && !sandpackFiles["/src/index.js"] && !sandpackFiles["/src/index.tsx"]) {
        sandpackFiles[`/src/index.${ext}`] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;
      }

      if (!sandpackFiles["/src/App.tsx"] && !sandpackFiles["/src/App.jsx"] && !sandpackFiles["/App.tsx"]) {
        sandpackFiles[`/src/App.${ext}`] = `import React from "react";

export default function App() {
  return <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
    <h1>Vista previa</h1>
    <p>Escribe código React para verlo aquí.</p>
  </div>;
}
`;
      }
    }

    return {
      files: sandpackFiles,
      template,
      hasPreviewableFiles,
      fileCount: count,
    };
  }, [fileContents, rootPath, previewTarget, vibeLensEnabled]);
}
