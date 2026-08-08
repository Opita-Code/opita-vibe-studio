import { describe, it, expect } from "vitest";
import { vibePadTheme, vibePadHighlight } from "../../../src/components/editor/vibe-pad-theme";

describe("vibe-pad-theme", () => {
  it("should export a CodeMirror extension for the editor theme", () => {
    expect(vibePadTheme).toBeDefined();
  });

  it("should export a syntax highlighting extension", () => {
    expect(vibePadHighlight).toBeDefined();
  });
});
