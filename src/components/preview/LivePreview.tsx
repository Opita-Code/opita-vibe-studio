import { useState, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────

interface PreviewError {
  message: string;
  url: string;
  line: number;
  col: number;
}

interface LivePreviewProps {
  /** HTML content to render inside the sandboxed iframe */
  htmlContent: string;
  /** Whether the content is a full HTML document (has <html>/<!DOCTYPE>) */
  isFullDocument: boolean;
  /** Incrementing version number — changes trigger "Actualizado" flash */
  version: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Builds a secure srcdoc string by injecting CSP and error-handling scripts.
 *
 * - If the content is a full HTML document, injects into <head>.
 * - Otherwise wraps in a minimal HTML template.
 */
function buildSrcdoc(userContent: string, isFullDocument: boolean): string {
  const csp =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self' 'unsafe-inline'; script-src 'unsafe-inline';\">";
  const errorScript = `<script>
window.onerror=function(m,u,l,c){
  window.parent.postMessage({type:"preview-error",message:m,url:u||"",line:l||0,col:c||0},"*");
};
window.addEventListener("error",function(e){
  window.parent.postMessage({type:"preview-error",message:e.message||"",url:e.filename||"",line:e.lineno||0,col:e.colno||0},"*");
});
window.addEventListener("load",function(){
  window.parent.postMessage({type:"preview-loaded"},"*");
});
</script>`;
  const headInjection = csp + errorScript;

  // Handle empty content — show placeholder
  const content =
    userContent ||
    "<p style='color:#888;padding:2rem;font-family:sans-serif;text-align:center;'>Sin contenido para mostrar</p>";

  if (isFullDocument && /<\/head>/i.test(content)) {
    return content.replace(/<\/head>/i, headInjection + "</head>");
  }

  // Wrap in minimal template
  return `<!DOCTYPE html><html><head>${headInjection}</head><body>${content}</body></html>`;
}

// ─── Component ───────────────────────────────────────────────────

/**
 * Sandboxed live preview panel.
 *
 * Renders HTML content inside a strictly-sandboxed iframe with
 * `allow-scripts` only — no allow-same-origin, no allow-popups,
 * no allow-top-navigation. CSP is injected via meta tag.
 *
 * Errors from the iframe are caught via postMessage bridge and
 * displayed in a non-blocking error banner.
 */
export function LivePreview({ htmlContent, isFullDocument, version }: LivePreviewProps) {
  const [error, setError] = useState<PreviewError | null>(null);
  const [showUpdated, setShowUpdated] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevVersionRef = useRef(version);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Detect save (version increment) → show "Actualizado" flash ──
  useEffect(() => {
    if (version === prevVersionRef.current) return;
    const isInitial = prevVersionRef.current === 0;
    prevVersionRef.current = version;
    if (isInitial) return;

    setShowUpdated(true);
    const timer = setTimeout(() => setShowUpdated(false), 2000);
    return () => clearTimeout(timer);
  }, [version]);

  // ── Build srcdoc from content ─────────────────────────────────
  const srcdoc = buildSrcdoc(htmlContent, isFullDocument);

  // ── Listen for postMessage from sandboxed iframe ──────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview-error") {
        setError({
          message: e.data.message,
          url: e.data.url,
          line: e.data.line,
          col: e.data.col,
        });
        setLoading(false);
      } else if (e.data?.type === "preview-loaded") {
        setLoading(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── 5-second timeout safety ──────────────────────────────────
  useEffect(() => {
    setLoading(true);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [srcdoc]);

  // ── Clear errors on content change ───────────────────────────
  useEffect(() => {
    setError(null);
  }, [htmlContent, version]);

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Error banner */}
      {error && (
        <div className="shrink-0 bg-red-900/80 text-red-200 text-xs px-3 py-2 border-b border-red-800 flex items-center gap-2 z-10">
          <span className="font-medium shrink-0">Error en la vista previa:</span>
          <span className="truncate">{error.message}</span>
          {error.line > 0 && (
            <span className="shrink-0 opacity-70">
              ({error.url ? error.url.split("/").pop() : "script"}:{error.line})
            </span>
          )}
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-red-300 hover:text-red-100 px-1 rounded"
            aria-label="Cerrar error"
          >
            X
          </button>
        </div>
      )}

      {/* "Actualizado" flash */}
      {showUpdated && (
        <div className="absolute top-2 right-2 z-20 bg-green-700/80 text-green-200 text-xs px-2 py-1 rounded animate-pulse">
          Actualizado
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]/60 z-10">
          <span className="text-xs text-[#888] animate-pulse">
            Cargando vista previa...
          </span>
        </div>
      )}

      {/* Sandboxed iframe — CRITICAL: allow-scripts ONLY */}
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="w-full flex-1 border-0 bg-white"
        title="Vista previa"
      />
    </div>
  );
}

// ─── Utility: build preview content from editor state ─────────────

/**
 * Determines the preview HTML content based on the active file.
 *
 * - .html files → content as-is (full document detection)
 * - .css files → wrapped in HTML template with <style> tags
 * - .js files → wrapped in HTML template with <script> tags
 * - Other / empty → wrapped in basic placeholder template
 */
export function buildPreviewContent(
  content: string,
  filePath: string | null,
): { html: string; isFullDocument: boolean } {
  if (!content) {
    return {
      html: "<p style='color:#888;padding:2rem;font-family:sans-serif;text-align:center;'>Sin contenido para mostrar</p>",
      isFullDocument: false,
    };
  }

  if (!filePath) {
    return { html: content, isFullDocument: false };
  }

  const ext = filePath.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "html":
    case "htm": {
      const isFull =
        /^<!DOCTYPE\s+html/i.test(content.trim()) || /^<html/i.test(content.trim());
      return { html: content, isFullDocument: isFull };
    }
    case "css": {
      return {
        html: `<style>\n${content}\n</style>`,
        isFullDocument: false,
      };
    }
    case "js": {
      return {
        html: `<script>\n${content}\n</script>`,
        isFullDocument: false,
      };
    }
    default: {
      return { html: content, isFullDocument: false };
    }
  }
}
