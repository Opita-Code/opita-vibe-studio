/**
 * Executor — Virtual workspace + path security tests.
 *
 * Tests the helper functions that handle virtual (template://) workspaces
 * and path validation/resolution.
 */

import { describe, it, expect } from "vitest";
import { isBlockedCommand } from "../executor";

// ─── Path Validation (exported for testing) ────────────────────

// We'll test validatePath and isVirtualWorkspace via the executor's
// exported helpers after refactoring.

// For now, test the existing exported function.

describe("isBlockedCommand", () => {
  it("blocks format C: command", () => {
    expect(isBlockedCommand("format C:")).not.toBeNull();
  });

  it("blocks shutdown", () => {
    expect(isBlockedCommand("shutdown /s /f")).not.toBeNull();
  });

  it("blocks rm -rf /", () => {
    expect(isBlockedCommand("rm -rf /")).not.toBeNull();
  });

  it("allows npm install", () => {
    expect(isBlockedCommand("npm install")).toBeNull();
  });

  it("allows vitest run", () => {
    expect(isBlockedCommand("npx vitest run")).toBeNull();
  });
});

// ─── Virtual Workspace Helpers ─────────────────────────────────

// We import these after they're created in the refactor.
// Using dynamic import so tests fail RED first if not yet exported.

describe("isVirtualWorkspace", () => {
  it("returns true for template:// paths", async () => {
    const { isVirtualWorkspace } = await import("../executor");
    expect(isVirtualWorkspace("template://portfolio")).toBe(true);
    expect(isVirtualWorkspace("template://react-landing")).toBe(true);
  });

  it("returns false for real filesystem paths", async () => {
    const { isVirtualWorkspace } = await import("../executor");
    expect(isVirtualWorkspace("C:\\Users\\nicou\\project")).toBe(false);
    expect(isVirtualWorkspace("/home/user/project")).toBe(false);
  });

  it("returns false for null/empty", async () => {
    const { isVirtualWorkspace } = await import("../executor");
    expect(isVirtualWorkspace(null)).toBe(false);
    expect(isVirtualWorkspace("")).toBe(false);
  });
});

describe("sanitizePath", () => {
  it("strips template:// prefix from paths", async () => {
    const { sanitizePath } = await import("../executor");
    expect(sanitizePath("template://portfolio/index.html")).toBe("index.html");
    expect(sanitizePath("template://react/src/App.tsx")).toBe("src/App.tsx");
  });

  it("strips leading slashes", async () => {
    const { sanitizePath } = await import("../executor");
    expect(sanitizePath("/index.html")).toBe("index.html");
    expect(sanitizePath("\\styles.css")).toBe("styles.css");
  });

  it("returns clean relative paths unchanged", async () => {
    const { sanitizePath } = await import("../executor");
    expect(sanitizePath("src/App.tsx")).toBe("src/App.tsx");
    expect(sanitizePath("styles.css")).toBe("styles.css");
  });

  it("rejects path traversal attempts", async () => {
    const { sanitizePath } = await import("../executor");
    expect(() => sanitizePath("../../../etc/passwd")).toThrow();
    expect(() => sanitizePath("src/../../secret")).toThrow();
  });

  it("rejects absolute Windows paths", async () => {
    const { sanitizePath } = await import("../executor");
    expect(() => sanitizePath("C:\\Windows\\System32")).toThrow();
  });
});
