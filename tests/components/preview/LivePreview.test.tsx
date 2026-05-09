import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  LivePreview,
  buildPreviewContent,
} from "../../../src/components/preview/LivePreview";

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Simulates a postMessage from the sandboxed iframe.
 * jsdom doesn't have a real iframe contentWindow, so we dispatch
 * the event on window directly (same as the real listener).
 */
function simulateIframeMessage(data: Record<string, unknown>) {
  window.dispatchEvent(new MessageEvent("message", { data, origin: "*", source: null }));
}

// ─── Tests ───────────────────────────────────────────────────────

describe("LivePreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the sandboxed iframe", () => {
    render(<LivePreview htmlContent="<p>Hola</p>" isFullDocument={false} version={1} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
  });

  it("should render with empty content placeholder", () => {
    render(<LivePreview htmlContent="" isFullDocument={false} version={1} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    // srcdoc should contain the placeholder text
    expect(iframe?.getAttribute("srcdoc")).toContain("Sin contenido para mostrar");
  });

  it("should have CSP meta tag injected in srcdoc", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);
    const iframe = document.querySelector("iframe");
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("Content-Security-Policy");
    expect(srcdoc).toContain(
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    );
    expect(srcdoc).toContain("script-src 'unsafe-inline'");
  });

  it("should have error handler script injected in srcdoc", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);
    const iframe = document.querySelector("iframe");
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("window.onerror");
    expect(srcdoc).toContain("postMessage");
    expect(srcdoc).toContain("preview-error");
  });

  it("should show error banner when receiving preview-error message", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);

    act(() => {
      simulateIframeMessage({
        type: "preview-error",
        message: "Unexpected token",
        url: "script.js",
        line: 5,
        col: 10,
      });
    });

    expect(screen.getByText(/Error en la vista previa/)).toBeDefined();
    expect(screen.getByText(/Unexpected token/)).toBeDefined();
    expect(screen.getByText(/script.js:5/)).toBeDefined();
  });

  it("should clear error banner when new content is provided", () => {
    const { rerender } = render(
      <LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />,
    );

    act(() => {
      simulateIframeMessage({
        type: "preview-error",
        message: "Error message",
        url: "",
        line: 1,
        col: 0,
      });
    });

    expect(screen.getByText(/Error en la vista previa/)).toBeDefined();

    // Rerender with new content (version changes)
    rerender(
      <LivePreview htmlContent="<p>new content</p>" isFullDocument={false} version={2} />,
    );

    expect(screen.queryByText(/Error en la vista previa/)).toBeNull();
  });

  it("should dismiss error when close button is clicked", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);

    act(() => {
      simulateIframeMessage({
        type: "preview-error",
        message: "Some error",
        url: "",
        line: 0,
        col: 0,
      });
    });

    const closeBtn = screen.getByLabelText("Cerrar error");
    act(() => {
      closeBtn.click();
    });

    expect(screen.queryByText(/Error en la vista previa/)).toBeNull();
  });

  it("should show Actualizado flash on version increment", () => {
    const { rerender } = render(
      <LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />,
    );

    // Increment version
    rerender(
      <LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={2} />,
    );

    expect(screen.getByText("Actualizado")).toBeDefined();
  });

  it("should hide Actualizado flash after 2 seconds", () => {
    const { rerender } = render(
      <LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />,
    );

    rerender(
      <LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={2} />,
    );
    expect(screen.getByText("Actualizado")).toBeDefined();

    // Advance time past 2 seconds
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByText("Actualizado")).toBeNull();
  });

  it("should show loading indicator initially", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);
    expect(screen.getByText("Cargando vista previa...")).toBeDefined();
  });

  it("should hide loading when preview-loaded message received", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);

    act(() => {
      simulateIframeMessage({ type: "preview-loaded" });
    });

    expect(screen.queryByText("Cargando vista previa...")).toBeNull();
  });

  it("should hide loading after 5-second timeout", () => {
    render(<LivePreview htmlContent="<p>test</p>" isFullDocument={false} version={1} />);
    expect(screen.getByText("Cargando vista previa...")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(5500);
    });

    expect(screen.queryByText("Cargando vista previa...")).toBeNull();
  });

  it("should wrap non-document content in HTML template", () => {
    render(<LivePreview htmlContent="<p>Hola</p>" isFullDocument={false} version={1} />);
    const iframe = document.querySelector("iframe");
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toMatch(/^<!DOCTYPE html>/i);
    expect(srcdoc).toContain("<body><p>Hola</p></body>");
  });

  it("should keep full HTML document structure when isFullDocument=true", () => {
    const content =
      "<!DOCTYPE html><html><head><title>Test</title></head><body><p>Full</p></body></html>";
    render(<LivePreview htmlContent={content} isFullDocument={true} version={1} />);
    const iframe = document.querySelector("iframe");
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    // Should have injected into <head>
    expect(srcdoc).toContain("Content-Security-Policy");
    expect(srcdoc).toContain("<body><p>Full</p></body>");
    // The original <title> should be preserved
    expect(srcdoc).toContain("<title>Test</title>");
  });
});

// ─── buildPreviewContent unit tests ──────────────────────────────

describe("buildPreviewContent", () => {
  it("should return placeholder for empty content", () => {
    const result = buildPreviewContent("", null);
    expect(result.html).toContain("Sin contenido para mostrar");
    expect(result.isFullDocument).toBe(false);
  });

  it("should detect HTML content as full document when it starts with DOCTYPE", () => {
    const result = buildPreviewContent(
      "<!DOCTYPE html><html><body><p>Hi</p></body></html>",
      "/test/index.html",
    );
    expect(result.isFullDocument).toBe(true);
    expect(result.html).toContain("<p>Hi</p>");
  });

  it("should detect HTML content as fragment when no DOCTYPE or html tag", () => {
    const result = buildPreviewContent("<p>Hi</p>", "/test/index.html");
    expect(result.isFullDocument).toBe(false);
  });

  it("should wrap CSS content in style tags", () => {
    const result = buildPreviewContent("body { color: red; }", "/test/styles.css");
    expect(result.html).toContain("<style>");
    expect(result.html).toContain("body { color: red; }");
    expect(result.html).toContain("</style>");
    expect(result.isFullDocument).toBe(false);
  });

  it("should wrap JS content in script tags", () => {
    const result = buildPreviewContent("console.log('hello');", "/test/script.js");
    expect(result.html).toContain("<script>");
    expect(result.html).toContain("console.log('hello');");
    expect(result.isFullDocument).toBe(false);
  });

  it("should pass through content for unknown extensions", () => {
    const result = buildPreviewContent("some content", "/test/readme.md");
    expect(result.html).toBe("some content");
    expect(result.isFullDocument).toBe(false);
  });

  it("should handle null filePath gracefully", () => {
    const result = buildPreviewContent("<p>content</p>", null);
    expect(result.html).toBe("<p>content</p>");
    expect(result.isFullDocument).toBe(false);
  });
});
