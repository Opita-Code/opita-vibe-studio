import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// generate-changelog.mjs is an executable script: it runs main() on import
// and calls process.exit() in some paths. We mock the I/O boundaries
// (git CLI + fs) and spy on process.exit so the worker is never killed.
const state = vi.hoisted(() => ({
  execSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const childProcessMock = {
  execSync: (...args) => state.execSync(...args),
};
const fsMock = {
  readFileSync: (...args) => state.readFileSync(...args),
  writeFileSync: (...args) => state.writeFileSync(...args),
};

vi.mock("node:child_process", () => ({
  ...childProcessMock,
  default: childProcessMock,
}));

vi.mock("node:fs", () => ({
  ...fsMock,
  default: fsMock,
}));

let exitSpy;

beforeEach(() => {
  state.execSync.mockReset();
  state.readFileSync.mockReset();
  state.writeFileSync.mockReset();
  process.env.TAG_NAME = "web/v0.5.0";
  vi.resetModules();
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`__PROCESS_EXIT__:${code}`);
  });
});

afterEach(() => {
  delete process.env.TAG_NAME;
  vi.restoreAllMocks();
});

const importChangelog = () => import("../../scripts/generate-changelog.mjs");

function logCalls() {
  return state.execSync.mock.calls.map(([cmd]) => cmd);
}

describe("scripts/generate-changelog.mjs", () => {
  it("prepends a changelog entry for the tagged version", async () => {
    state.readFileSync.mockReturnValue("[]");
    state.execSync.mockImplementation((cmd) => {
      if (cmd.startsWith("git tag")) {
        return "web/v0.4.0\nbackend/v0.4.0\nweb/v0.5.0\nbackend/v0.5.0";
      }
      if (cmd.startsWith("git log")) {
        return [
          "a1b2c3d feat(auth): add login flow",
          "e4f5g6h feat(landing): refresh hero",
          "i7j8k9l fix(api): fix cors",
        ].join("\n");
      }
      return "";
    });

    await importChangelog();

    expect(state.writeFileSync).toHaveBeenCalledTimes(1);
    const [path, json] = state.writeFileSync.mock.calls[0];
    expect(path).toMatch(/landing[\\/]changelog\.json$/);

    const list = JSON.parse(json);
    expect(list).toHaveLength(1);

    const entry = list[0];
    expect(entry.version).toBe("0.5.0");
    expect(entry.title).toBe("Add login flow");
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.components.map((c) => c.name)).toEqual(["Web App", "Backend"]);
    expect(entry.components.map((c) => c.tag)).toEqual([
      "web/v0.5.0",
      "backend/v0.5.0",
    ]);
    expect(entry.highlights).toHaveLength(3);
    expect(entry.details["Web App"]).toContain("✨ add login flow");
    expect(entry.details["Landing"]).toContain("✨ refresh hero");
    expect(entry.details["Backend"]).toContain("🐛 fix cors");

    // Previous tag resolution prefers web/v0.4.0
    expect(logCalls().join("\n")).toContain("git log --oneline web/v0.4.0..HEAD --no-merges");
  });

  it("is idempotent: skips when the version already exists", async () => {
    state.readFileSync.mockReturnValue(
      JSON.stringify([{ version: "0.5.0" }]),
    );

    await expect(importChangelog()).rejects.toThrow("__PROCESS_EXIT__:0");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(state.writeFileSync).not.toHaveBeenCalled();
    expect(state.execSync).not.toHaveBeenCalled();
  });

  it("falls back to `git log -20` when no previous version exists", async () => {
    state.readFileSync.mockReturnValue("[]");
    state.execSync.mockImplementation((cmd) => {
      if (cmd.startsWith("git tag")) return "web/v0.5.0";
      if (cmd.startsWith("git log")) return "abc1234 fix(auth): fix magic link\n";
      return "";
    });

    await importChangelog();

    expect(logCalls().join("\n")).toContain("git log --oneline -20 --no-merges");
    const entry = JSON.parse(state.writeFileSync.mock.calls[0][1])[0];
    expect(entry.version).toBe("0.5.0");
  });

  it("filters ci/test/chore(release) commits and maps scopes to components", async () => {
    process.env.TAG_NAME = "backend/v0.6.0";
    state.readFileSync.mockReturnValue("[]");
    state.execSync.mockImplementation((cmd) => {
      if (cmd.startsWith("git tag")) return "web/v0.5.0\nbackend/v0.6.0\n";
      if (cmd.startsWith("git log")) {
        return [
          "1111111 chore(release): bump version",
          "2222222 ci: deploy",
          "3333333 test: unit",
          "4444444 fix(desktop): fix tray icon",
          "5555555 fix(api): paginate",
        ].join("\n");
      }
      return "";
    });

    await importChangelog();

    const entry = JSON.parse(state.writeFileSync.mock.calls[0][1])[0];
    expect(entry.version).toBe("0.6.0");
    expect(entry.components.map((c) => c.name)).toEqual(["Backend"]);
    expect(entry.details["Desktop"]).toContain("🐛 fix tray icon");
    expect(entry.details["Backend"]).toContain("🐛 paginate");
    expect(entry.details["Web App"]).toBeUndefined();
    expect(Object.values(entry.details).flat()).not.toContain("deploy");
    expect(entry.title).toBe("2 correcciones");
  });

  it("generates a minimal entry when no meaningful commits exist", async () => {
    state.readFileSync.mockReturnValue("[]");
    state.execSync.mockImplementation((cmd) => {
      if (cmd.startsWith("git tag")) return "web/v0.7.0";
      if (cmd.startsWith("git log")) return "aaaa1111 ci: deploy only\n";
      return "";
    });

    await importChangelog();

    const entry = JSON.parse(state.writeFileSync.mock.calls[0][1])[0];
    expect(entry.title).toBe("Actualizaciones y mejoras");
    expect(entry.highlights).toEqual([]);
    expect(entry.details).toEqual({});
  });

  it("prepends the new entry ahead of existing ones", async () => {
    state.readFileSync.mockReturnValue(
      JSON.stringify([{ version: "0.4.0" }]),
    );
    state.execSync.mockImplementation((cmd) => {
      if (cmd.startsWith("git tag")) return "web/v0.4.0\nweb/v0.5.0";
      if (cmd.startsWith("git log")) return "ccc33333 fix: hotfix\n";
      return "";
    });

    await importChangelog();

    const list = JSON.parse(state.writeFileSync.mock.calls[0][1]);
    expect(list.map((e) => e.version)).toEqual(["0.5.0", "0.4.0"]);
  });

  it("starts from an empty changelog when the file cannot be read", async () => {
    process.env.TAG_NAME = "web/v0.8.0";
    state.readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    state.execSync.mockImplementation((cmd) => {
      if (cmd.startsWith("git tag")) return "web/v0.8.0";
      if (cmd.startsWith("git log")) return "bbb22222 fix: patch\n";
      return "";
    });

    await importChangelog();

    const entry = JSON.parse(state.writeFileSync.mock.calls[0][1])[0];
    expect(entry.version).toBe("0.8.0");
  });

  it("exits(1) when TAG_NAME is missing", async () => {
    delete process.env.TAG_NAME;
    state.readFileSync.mockReturnValue("[]");

    await expect(importChangelog()).rejects.toThrow("__PROCESS_EXIT__:1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("throws when the tag has no extractable version", async () => {
    process.env.TAG_NAME = "release-final";

    await expect(importChangelog()).rejects.toThrow(
      "Cannot extract version from tag: release-final",
    );
  });
});
