import { describe, it, expect } from "vitest";
import {
  buildPreviewContent,
} from "../../../src/components/preview/LivePreview";

/**
 * LivePreview was rewritten to use Sandpack (VibeLens).
 * The old srcdoc/iframe/CSP tests no longer apply.
 *
 * Component-level rendering tests require Sandpack mocks which are
 * complex and low-value. The real preview is validated via E2E.
 *
 * These tests cover the exported utility function.
 */
describe("LivePreview", () => {
  describe("buildPreviewContent (backward compat stub)", () => {
    it("should return empty html with isFullDocument=false", () => {
      const result = buildPreviewContent();
      expect(result.html).toBe("");
      expect(result.isFullDocument).toBe(false);
    });
  });

  // The actual VibeLens preview is validated via:
  // 1. E2E tests (tests/e2e/comprehensive.spec.ts)
  // 2. Visual inspection in the dev server
  // 3. The Sandpack provider handles sandboxing, CSP, etc.
});
