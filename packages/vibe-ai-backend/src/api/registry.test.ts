/**
 * Registry API — unit tests.
 *
 * Mocks S3 and sst; uses a real temp directory for the local manifest
 * in coupleProject (no network).
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const hoisted = vi.hoisted(() => {
  const send = vi.fn();
  const transform = vi.fn();
  class BaseCmd {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  const GetObjectCommand = class GetObjectCommand extends BaseCmd {};
  const PutObjectCommand = class PutObjectCommand extends BaseCmd {};
  const DeleteObjectCommand = class DeleteObjectCommand extends BaseCmd {};
  return { send, transform, GetObjectCommand, PutObjectCommand, DeleteObjectCommand };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send: typeof hoisted.send;
    constructor() {
      this.send = hoisted.send;
    }
  },
  GetObjectCommand: hoisted.GetObjectCommand,
  PutObjectCommand: hoisted.PutObjectCommand,
  DeleteObjectCommand: hoisted.DeleteObjectCommand,
}));

vi.mock("sst", () => ({ Resource: { VibeStorage: { name: "vibe-storage" } } }));

import {
  loadRegistry,
  saveRegistry,
  loadProjectManifest,
  saveProjectManifest,
  coupleProject,
  decoupleProject,
} from "./registry.js";

const MANIFEST = { projectId: "p1", name: "Proyecto 1", description: "d" };
const REGISTRY_JSON = JSON.stringify({ activeProjects: [{ projectId: "old", path: "/x", coupledAt: 1 }] });

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-registry-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.transform.mockReset();
  hoisted.transform.mockImplementation(async () => REGISTRY_JSON);
});

function s3Body(str: string | null) {
  if (str === null) return { Body: undefined };
  return { Body: { transformToString: hoisted.transform.mockResolvedValueOnce(str) } };
}

describe("loadRegistry", () => {
  it("parsa JSON desde S3", async () => {
    hoisted.send.mockImplementation(async () => s3Body(REGISTRY_JSON));
    const reg = await loadRegistry();
    expect(reg.activeProjects).toHaveLength(1);
  });

  it("retorna vacío cuando no hay body", async () => {
    hoisted.send.mockImplementation(async () => ({ Body: undefined }));
    const reg = await loadRegistry();
    expect(reg).toEqual({ activeProjects: [] });
  });

  it("retorna vacío ante NoSuchKey", async () => {
    hoisted.send.mockImplementation(async () => {
      const e = new Error("missing") as any;
      e.name = "NoSuchKey";
      throw e;
    });
    const reg = await loadRegistry();
    expect(reg).toEqual({ activeProjects: [] });
  });

  it("retorna vacío ante otros errores", async () => {
    hoisted.send.mockImplementation(async () => {
      throw new Error("s3 down");
    });
    const reg = await loadRegistry();
    expect(reg).toEqual({ activeProjects: [] });
  });
});

describe("saveRegistry", () => {
  it("escribe el registry como JSON a S3", async () => {
    const inputs: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) inputs.push(cmd.input);
      return {};
    });
    await saveRegistry({ activeProjects: [] });
    expect(inputs.length).toBe(1);
    expect(inputs[0].Bucket).toBe("vibe-storage");
    expect(inputs[0].Key).toBe("admin/coupled-projects.json");
    expect(inputs[0].ContentType).toBe("application/json");
    expect(JSON.parse(inputs[0].Body)).toEqual({ activeProjects: [] });
  });
});

describe("loadProjectManifest / saveProjectManifest", () => {
  it("carga manifest desde S3", async () => {
    hoisted.send.mockImplementation(async () => s3Body(JSON.stringify(MANIFEST)));
    const manifest = await loadProjectManifest("p1");
    expect(manifest).toEqual(MANIFEST);
  });

  it("retorna null ante error S3", async () => {
    hoisted.send.mockImplementation(async () => {
      throw new Error("boom");
    });
    expect(await loadProjectManifest("p1")).toBeNull();
  });

  it("guarda manifest a S3", async () => {
    const inputs: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.PutObjectCommand) inputs.push(cmd.input);
      return {};
    });
    await saveProjectManifest("p1", MANIFEST);
    expect(inputs[0].Key).toBe("admin/projects/p1/opita-ops.json");
    expect(JSON.parse(inputs[0].Body)).toEqual(MANIFEST);
  });
});

describe("coupleProject", () => {
  function routeWithRegistry(reg: string, manifestResult: string | null = null) {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetObjectCommand) {
        const key = cmd.input.Key as string;
        if (key.endsWith("coupled-projects.json")) return s3Body(reg);
        if (key.endsWith("opita-ops.json")) return s3Body(manifestResult);
      }
      return {};
    });
  }

  it("acopla con manifest local válido", async () => {
    const manifestPath = path.join(tmpDir, "opita-ops.json");
    fs.writeFileSync(manifestPath, JSON.stringify(MANIFEST));
    routeWithRegistry(REGISTRY_JSON);
    const puts: any[] = [];
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetObjectCommand) return s3Body(REGISTRY_JSON);
      if (cmd instanceof hoisted.PutObjectCommand) puts.push(cmd.input);
      return {};
    });
    const res = await coupleProject("p1", tmpDir);
    expect(res.success).toBe(true);
    expect(res.manifest).toEqual(MANIFEST);
    expect(puts.length).toBe(2); // manifest + registry
    const regPut = puts.find((p) => p.Key === "admin/coupled-projects.json");
    const parsed = JSON.parse(regPut.Body);
    expect(parsed.activeProjects.some((p: any) => p.projectId === "p1")).toBe(true);
  });

  it("dedupe: re-acoplar un proyecto ya existente", async () => {
    routeWithRegistry(JSON.stringify({ activeProjects: [{ projectId: "p1", path: "/old", coupledAt: 5 }] }));
    const res = await coupleProject("p1", tmpDir);
    expect(res.success).toBe(true);
    const regPut = hoisted.send.mock.calls
      .map((c: any) => c[0])
      .filter((c: any) => c instanceof hoisted.PutObjectCommand && c.input.Key.endsWith("coupled-projects.json"));
    const parsed = JSON.parse(regPut[regPut.length - 1].input.Body);
    expect(parsed.activeProjects).toHaveLength(1);
  });

  it("usa manifest desde S3 cuando falta local", async () => {
    const emptyDir = path.join(tmpDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetObjectCommand) {
        const key = cmd.input.Key as string;
        if (key.endsWith("coupled-projects.json")) return s3Body(REGISTRY_JSON);
        return s3Body(JSON.stringify(MANIFEST));
      }
      return {};
    });
    const res = await coupleProject("p1", emptyDir);
    expect(res.success).toBe(true);
  });

  it("falla cuando no hay manifest ni local ni S3", async () => {
    hoisted.send.mockImplementation(async () => {
      const e = new Error("NoSuchKey") as any;
      e.name = "NoSuchKey";
      throw e;
    });
    const res = await coupleProject("p1", path.join(tmpDir, "nope"));
    expect(res.success).toBe(false);
    expect(res.message).toContain("no se encontró opita-ops.json");
  });

  it("rechaza manifest con projectId distinto", async () => {
    const dir = path.join(tmpDir, "wrongid");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "opita-ops.json"), JSON.stringify({ ...MANIFEST, projectId: "other" }));
    const res = await coupleProject("p1", dir);
    expect(res.success).toBe(false);
    expect(res.message).toContain("no coincide");
  });
});

describe("decoupleProject", () => {
  it("falla si el proyecto no está acoplado", async () => {
    hoisted.send.mockImplementation(async () => s3Body(REGISTRY_JSON));
    const res = await decoupleProject("missing");
    expect(res.success).toBe(false);
    expect(res.message).toContain("no está acoplado");
  });

  it("desacopla y elimina el manifest", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetObjectCommand) return s3Body(REGISTRY_JSON);
      return {};
    });
    const res = await decoupleProject("old");
    expect(res.success).toBe(true);
    const del = hoisted.send.mock.calls
      .map((c: any) => c[0])
      .find((c: any) => c instanceof hoisted.DeleteObjectCommand);
    expect(del).toBeDefined();
    expect((del as any).input.Key).toBe("admin/projects/old/opita-ops.json");
  });

  it("tolera error al borrar el manifest", async () => {
    hoisted.send.mockImplementation(async (cmd: any) => {
      if (cmd instanceof hoisted.GetObjectCommand) return s3Body(REGISTRY_JSON);
      if (cmd instanceof hoisted.DeleteObjectCommand) throw new Error("delete failed");
      return {};
    });
    const res = await decoupleProject("old");
    expect(res.success).toBe(true);
  });
});
