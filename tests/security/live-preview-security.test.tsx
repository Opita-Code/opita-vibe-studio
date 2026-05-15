import { describe, it, expect } from "vitest";
import { buildPreviewContent } from "@/components/preview/LivePreview";

// ─── Security Audit: Live Preview Sandbox Isolation ──────────────
//
// NOTE: LivePreview was rewritten to use Sandpack (VibeLens).
// The old srcdoc/iframe/CSP tests no longer apply — Sandpack
// manages its own sandboxing and CSP internally.
//
// Sandpack provides:
// 1. Sandboxed iframe with allow-scripts only
// 2. Internal CSP enforcement  
// 3. No direct srcdoc injection — uses bundler
//
// These tests validate the backward-compat stub and the
// general principle that no dangerous patterns exist.
// ─────────────────────────────────────────────────────────────────

describe("Live Preview Security", () => {
  describe("buildPreviewContent (backward compat stub)", () => {
    it("should return safe empty content", () => {
      const result = buildPreviewContent();
      expect(result.html).toBe("");
      expect(result.isFullDocument).toBe(false);
    });

    it("buildPreviewContent should NOT use innerHTML or eval", () => {
      const source = buildPreviewContent.toString();
      // Verify no dangerous patterns exist in the source
      expect(source).not.toContain("innerHTML");
      expect(source).not.toContain(".innerHTML");
      expect(source).not.toContain("eval(");
      expect(source).not.toContain("Function(");
    });
  });

  // The actual VibeLens security is validated via:
  // 1. Sandpack's built-in sandbox (allow-scripts only)
  // 2. E2E tests (tests/e2e/comprehensive.spec.ts)
  // 3. Manual inspection of iframe attributes in dev server
});
