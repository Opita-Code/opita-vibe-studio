import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// setup-athena.mjs is a straight-line script that shells out to the AWS CLI.
// We mock child_process so no real AWS calls happen, and spy on process.exit
// for the "no bucket resolved" fatal path.
const state = vi.hoisted(() => ({ execSync: vi.fn() }));

// The script imports from the bare specifier "child_process"; mock both forms.
const childProcessMock = {
  execSync: (...args) => state.execSync(...args),
};

vi.mock("child_process", () => ({
  ...childProcessMock,
  default: childProcessMock,
}));
vi.mock("node:child_process", () => ({
  ...childProcessMock,
  default: childProcessMock,
}));

let exitSpy;

beforeEach(() => {
  state.execSync.mockReset();
  vi.resetModules();
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`__PROCESS_EXIT__:${code}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const importAthena = () => import("../../scripts/setup-athena.mjs");

function athenaCalls() {
  return state.execSync.mock.calls
    .map(([cmd]) => cmd)
    .filter((cmd) => cmd.includes("aws athena"));
}

describe("scripts/setup-athena.mjs", () => {
  it("runs the Athena DDL queries against the stack-output bucket", async () => {
    state.execSync.mockImplementation((cmd) => {
      if (cmd.includes("cloudformation describe-stacks")) {
        return "opita-data-lake-prod\n";
      }
      if (cmd.includes("aws athena")) return '{"QueryExecutionId":"q-123"}';
      return "";
    });

    await importAthena();

    const all = state.execSync.mock.calls.map(([cmd]) => cmd);
    expect(all[0]).toContain("cloudformation describe-stacks");
    expect(all[0]).toContain("prod-opita-vibe-studio");

    const athena = athenaCalls();
    expect(athena).toHaveLength(3);
    expect(athena[0]).toContain(
      "CREATE DATABASE IF NOT EXISTS opita_analytics_db",
    );
    expect(athena[1]).toContain(
      "CREATE EXTERNAL TABLE IF NOT EXISTS opita_analytics_db.events",
    );
    expect(athena[1]).toContain("PARTITIONED BY");
    expect(athena[1]).toContain("OutputLocation=s3://opita-data-lake-prod/athena-results/");
    expect(athena[2]).toContain("MSCK REPAIR TABLE opita_analytics_db.events");
    expect(athena[2]).toContain("OutputLocation=s3://opita-data-lake-prod/athena-results/");
  });

  it("falls back to `aws s3 ls` when describe-stacks fails", async () => {
    state.execSync.mockImplementation((cmd) => {
      if (cmd.includes("cloudformation describe-stacks")) {
        throw new Error("stack not deployed");
      }
      if (cmd.includes("aws s3 ls")) {
        return "2026-08-01 10:00:00  opitadatalake-events\n";
      }
      if (cmd.includes("aws athena")) return '{"QueryExecutionId":"q-fallback"}';
      return "";
    });

    await importAthena();

    expect(
      state.execSync.mock.calls.some(([cmd]) => cmd.includes("aws s3 ls")),
    ).toBe(true);

    const athena = athenaCalls();
    expect(athena[0]).toContain(
      "OutputLocation=s3://opitadatalake-events/athena-results/",
    );
  });

  it("continues past a failed Athena submission (returns null)", async () => {
    let athenaCount = 0;
    state.execSync.mockImplementation((cmd) => {
      if (cmd.includes("cloudformation describe-stacks")) return "bucket-x\n";
      if (cmd.includes("aws athena")) {
        athenaCount += 1;
        if (athenaCount === 1) throw new Error("query failed");
        return '{"QueryExecutionId":"q-ok"}';
      }
      return "";
    });

    // Should NOT throw: the failure is caught inside runAthenaQuery.
    await importAthena();

    expect(athenaCalls()).toHaveLength(3);
  });

  it("exits(1) when no bucket can be resolved", async () => {
    state.execSync.mockImplementation((cmd) => {
      if (cmd.includes("cloudformation describe-stacks")) {
        throw new Error("stack not deployed");
      }
      if (cmd.includes("aws s3 ls")) return "no buckets in this account\n";
      return "";
    });

    await expect(importAthena()).rejects.toThrow("__PROCESS_EXIT__:1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
