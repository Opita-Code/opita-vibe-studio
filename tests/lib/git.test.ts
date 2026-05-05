import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock IPC ────────────────────────────────────────────────────

const mockExecShell = vi.fn();

vi.mock("../../src/lib/ipc", () => ({
  execShell: mockExecShell,
}));

// ─── Tests ───────────────────────────────────────────────────────

describe("getGitBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return branch name when on a branch", async () => {
    mockExecShell.mockResolvedValue({
      stdout: "main\n",
      stderr: "",
      exit_code: 0,
    });

    const { getGitBranch } = await import("../../src/lib/git");
    const branch = await getGitBranch("/test/project");
    expect(branch).toBe("main");
    expect(mockExecShell).toHaveBeenCalledWith(
      "git rev-parse --abbrev-ref HEAD",
      "/test/project",
    );
  });

  it("should return branch name trimmed", async () => {
    mockExecShell.mockResolvedValue({
      stdout: "  feature/new-ui  \n",
      stderr: "",
      exit_code: 0,
    });

    const { getGitBranch } = await import("../../src/lib/git");
    const branch = await getGitBranch("/test/project");
    expect(branch).toBe("feature/new-ui");
  });

  it("should return null when not a git repo (non-zero exit)", async () => {
    mockExecShell.mockResolvedValue({
      stdout: "fatal: not a git repository\n",
      stderr: "fatal: not a git repository\n",
      exit_code: 128,
    });

    const { getGitBranch } = await import("../../src/lib/git");
    const branch = await getGitBranch("/test/project");
    expect(branch).toBeNull();
  });

  it("should return null when execShell throws", async () => {
    mockExecShell.mockRejectedValue(new Error("Command not found"));

    const { getGitBranch } = await import("../../src/lib/git");
    const branch = await getGitBranch("/test/project");
    expect(branch).toBeNull();
  });
});

describe("getGitStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse modified files", async () => {
    mockExecShell.mockResolvedValue({
      stdout: " M src/index.html\n",
      stderr: "",
      exit_code: 0,
    });

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    expect(status).toEqual({ "src/index.html": "M" });
  });

  it("should parse multiple status indicators", async () => {
    mockExecShell.mockResolvedValue({
      stdout: [
        " M src/index.html",
        "?? src/new-file.js",
        "A  src/added.ts",
        " D src/deleted.ts",
        " M src/modified.css",
      ].join("\n"),
      stderr: "",
      exit_code: 0,
    });

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    expect(Object.keys(status!)).toHaveLength(5);
    expect(status!["src/index.html"]).toBe("M");
    expect(status!["src/new-file.js"]).toBe("??");
    expect(status!["src/added.ts"]).toBe("A");
    expect(status!["src/deleted.ts"]).toBe("D");
    expect(status!["src/modified.css"]).toBe("M");
  });

  it("should handle staged+unstaged changes", async () => {
    mockExecShell.mockResolvedValue({
      stdout: "MM src/index.html\n",
      stderr: "",
      exit_code: 0,
    });

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    // Toma el indicador más significativo (staging)
    expect(status!["src/index.html"]).toBe("MM");
  });

  it("should return null when not a git repo", async () => {
    mockExecShell.mockResolvedValue({
      stdout: "",
      stderr: "fatal: not a git repository\n",
      exit_code: 128,
    });

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    expect(status).toBeNull();
  });

  it("should return null when execShell throws", async () => {
    mockExecShell.mockRejectedValue(new Error("Command failed"));

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    expect(status).toBeNull();
  });

  it("should handle empty output (clean repo)", async () => {
    mockExecShell.mockResolvedValue({
      stdout: "",
      stderr: "",
      exit_code: 0,
    });

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    expect(status).toEqual({});
  });

  it("should handle filenames with spaces", async () => {
    mockExecShell.mockResolvedValue({
      stdout: ' M "src/my file.html"\n',
      stderr: "",
      exit_code: 0,
    });

    const { getGitStatus } = await import("../../src/lib/git");
    const status = await getGitStatus("/test/project");
    // Los paths con espacios vienen entrecomillados desde git
    expect(status!['"src/my file.html"']).toBe("M");
  });
});
