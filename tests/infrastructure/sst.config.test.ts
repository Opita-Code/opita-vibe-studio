import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sst.config.ts is an SST v4 config: it expects SST globals ($config, $app,
// sst) at evaluation time and dynamically imports @pulumi/aws + dotenv inside
// run(). We stub the globals and mock both dynamic imports so the whole
// resource graph can be exercised in-memory (no real AWS, no pulumi runtime).

const state = vi.hoisted(() => ({
  ssmGet: vi.fn(),
  dotenvConfig: vi.fn(),
}));

const created = vi.hoisted(() => ({ resources: [] }));

class Dynamo {
  constructor(name, props) {
    this.name = name;
    this.props = props;
    created.resources.push({ kind: "Dynamo", name, props });
  }
  subscribe() {
    created.resources.push({ kind: "subscribe", name: this.name });
  }
}

class Bucket {
  constructor(name, props) {
    this.name = name;
    this.props = props;
    created.resources.push({ kind: "Bucket", name, props });
  }
}

class Function {
  constructor(name, props) {
    this.name = name;
    this.props = props;
    created.resources.push({ kind: "Function", name, props });
    this.url = `https://${name.toLowerCase()}.example.com`;
  }
}

vi.mock("@pulumi/aws", () => ({
  ssm: { getParameter: (...args) => state.ssmGet(...args) },
  default: { ssm: { getParameter: (...args) => state.ssmGet(...args) } },
}));
// The alias in vite.config.ts resolves @pulumi/aws to the stub file; mock the
// resolved path too so the interception is unambiguous.
vi.mock("../../tests/stubs/pulumi-aws-stub.mjs", () => ({
  ssm: { getParameter: (...args) => state.ssmGet(...args) },
  default: { ssm: { getParameter: (...args) => state.ssmGet(...args) } },
}));

vi.mock("dotenv", () => ({ config: (...args) => state.dotenvConfig(...args) }));

const loadConfig = () => import("../../sst.config");

function resourcesOf(kind, name) {
  return created.resources.find(
    (r) => r.kind === kind && r.name === name,
  );
}

describe("sst.config.ts", () => {
  beforeEach(() => {
    created.resources.length = 0;
    state.ssmGet.mockReset().mockRejectedValue(new Error("SSM param not found"));
    state.dotenvConfig.mockReset();
    globalThis.$config = (cfg) => cfg;
    globalThis.$app = { stage: "dev" };
    globalThis.sst = { aws: { Dynamo, Bucket, Function } };
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.$config;
    delete globalThis.$app;
    delete globalThis.sst;
    delete process.env.JWT_SECRET;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SES_FROM_EMAIL;
    delete process.env.FRONTEND_URL;
  });

  it("exports a $config object with app() and run()", async () => {
    const cfg = (await loadConfig()).default;
    expect(typeof cfg).toBe("object");
    expect(typeof cfg.app).toBe("function");
    expect(typeof cfg.run).toBe("function");
  });

  it("app() returns stage-aware removal policies", async () => {
    const cfg = (await loadConfig()).default;
    expect(cfg.app({ stage: "dev" })).toEqual({
      name: "opita-vibe-studio",
      removal: "remove",
      home: "aws",
    });
    expect(cfg.app({ stage: "prod" })).toEqual({
      name: "opita-vibe-studio",
      removal: "retain",
      home: "aws",
    });
    expect(cfg.app(undefined)).toEqual({
      name: "opita-vibe-studio",
      removal: "remove",
      home: "aws",
    });
  });

  it("run() creates the full resource graph and returns outputs (dev + SSM fallbacks)", async () => {
    globalThis.$app = { stage: "dev" };
    const cfg = (await loadConfig()).default;

    const outputs = await cfg.run();

    expect(outputs).toMatchObject({
      ChatApiUrl: "https://chatstreamapi.example.com",
      SyncApiUrl: "https://syncapi.example.com",
      StorageApiUrl: "https://storageapi.example.com",
      BillingApiUrl: "https://billingapi.example.com",
      CoreApiUrl: "https://coreapi.example.com",
      ResearchApiUrl: "https://researchapi.example.com",
      TableName: "Conversations",
      BucketName: "VibeStorage",
      DataLakeBucketName: "OpitaDataLake",
    });

    // DynamoDB tables
    for (const name of [
      "Conversations",
      "Projects",
      "Transactions",
      "TokenUsage",
      "AnalyticsEvents",
    ]) {
      expect(resourcesOf("Dynamo", name)).toBeTruthy();
    }
    // Buckets
    for (const name of ["OpitaDataLake", "VibeStorage"]) {
      expect(resourcesOf("Bucket", name)).toBeTruthy();
    }
    // Functions
    for (const name of [
      "TelemetryStreamProcessor",
      "ChatStreamAPI",
      "StorageAPI",
      "BillingAPI",
      "CoreAPI",
      "ResearchAPI",
      "SyncAPI",
    ]) {
      expect(resourcesOf("Function", name)).toBeTruthy();
    }

    // Analytics stream subscription
    expect(created.resources).toContainEqual(
      expect.objectContaining({ kind: "subscribe", name: "AnalyticsEvents" }),
    );

    // Chat API: SSM fallbacks for table names + empty LLM keys in dev
    const chat = resourcesOf("Function", "ChatStreamAPI");
    expect(chat.props.environment.USERS_TABLE_NAME).toBe(
      "opita-vibe-studio-dev-UsersTable-bofxhecu",
    );
    expect(chat.props.environment.USER_KEYS_TABLE_NAME).toBe(
      "opita-vibe-studio-dev-UserKeysTable-bctnrwvd",
    );
    expect(chat.props.environment.DEEP_SEEK_KEY).toBe("");
    expect(chat.props.environment.MINIMAX_API_KEY).toBe("");
    expect(chat.props.streaming).toBe(true);
    expect(chat.props.link).toEqual(
      expect.arrayContaining([expect.any(Dynamo)]),
    );

    // Billing: external Dynamo permissions point at the fallback tables
    const billing = resourcesOf("Function", "BillingAPI");
    const ext = billing.props.permissions.find((p) => Array.isArray(p.resources));
    expect(ext.resources).toContain(
      "arn:aws:dynamodb:us-east-1:*:table/opita-vibe-studio-dev-UsersTable-bofxhecu",
    );
    expect(ext.resources).toContain(
      "arn:aws:dynamodb:us-east-1:*:table/opita-vibe-studio-dev-UserKeysTable-bctnrwvd",
    );

    // Core API: dev FRONTEND_URL default + SES default
    const core = resourcesOf("Function", "CoreAPI");
    expect(core.props.environment.FRONTEND_URL).toBe("http://localhost:3000");
    expect(core.props.environment.SES_FROM_EMAIL).toBe("noreply@opitacode.com");

    // Storage API: presigned URLs, no CORS object
    const storage = resourcesOf("Function", "StorageAPI");
    expect(storage.props.url).toBe(true);

    // SSM parameters queried with the right names + decryption flag
    const ssmNames = state.ssmGet.mock.calls.map(([arg]) => arg.name);
    expect(ssmNames).toContain("/opita-account/dev/users-table-name");
    expect(ssmNames).toContain("/opita-account/dev/user-keys-table-name");
    expect(ssmNames).toContain("/opita-account/dev/auth-api-url");
    expect(ssmNames).toContain("/opita-llm/minimax-api-key");
    expect(ssmNames).toContain("/opita-llm/deepseek-api-key");
    expect(
      state.ssmGet.mock.calls.some(([arg]) => arg.withDecryption === true),
    ).toBe(true);

    // dotenv was loaded
    expect(state.dotenvConfig).toHaveBeenCalled();
  });

  it("rethrows SSM errors in prod", async () => {
    globalThis.$app = { stage: "prod" };
    const cfg = (await loadConfig()).default;

    await expect(cfg.run()).rejects.toThrow("SSM param not found");
  });

  it("uses SSM values when present instead of fallbacks", async () => {
    globalThis.$app = { stage: "dev" };
    state.ssmGet.mockImplementation(async ({ name }) => ({ value: `resolved:${name}` }));
    const cfg = (await loadConfig()).default;

    await cfg.run();

    const chat = resourcesOf("Function", "ChatStreamAPI");
    expect(chat.props.environment.USERS_TABLE_NAME).toBe(
      "resolved:/opita-account/dev/users-table-name",
    );
    expect(chat.props.environment.USER_KEYS_TABLE_NAME).toBe(
      "resolved:/opita-account/dev/user-keys-table-name",
    );
    expect(chat.props.environment.MINIMAX_API_KEY).toBe(
      "resolved:/opita-llm/minimax-api-key",
    );
    expect(chat.props.environment.DEEP_SEEK_KEY).toBe(
      "resolved:/opita-llm/deepseek-api-key",
    );
    expect(state.dotenvConfig).toHaveBeenCalled();
  });

  it("strips UTF-8 BOM from env vars and wires prod URLs", async () => {
    globalThis.$app = { stage: "prod" };
    process.env.JWT_SECRET = "\uFEFFjwt-value\uFEFF";
    process.env.OPENAI_API_KEY = "\uFEFFsk-openai";
    process.env.SES_FROM_EMAIL = "dev@opitacode.com";
    state.ssmGet.mockImplementation(async () => ({ value: "param" }));
    const cfg = (await loadConfig()).default;

    await cfg.run();

    // BOM stripped in place
    expect(process.env.JWT_SECRET).toBe("jwt-value");
    expect(process.env.OPENAI_API_KEY).toBe("sk-openai");

    const core = resourcesOf("Function", "CoreAPI");
    expect(core.props.environment.FRONTEND_URL).toBe(
      "https://vibe.opitacode.com",
    );
    expect(core.props.environment.JWT_SECRET).toBe("jwt-value");
    expect(core.props.environment.SES_FROM_EMAIL).toBe("dev@opitacode.com");

    const chat = resourcesOf("Function", "ChatStreamAPI");
    expect(chat.props.environment.OPENAI_API_KEY).toBe("sk-openai");

    // Research API prod JWKS URL
    const research = resourcesOf("Function", "ResearchAPI");
    expect(research.props.environment.OCAIS_JWKS_URL).toBe(
      "https://api.opitacode.com/.well-known/jwks.json",
    );
    expect(research.props.timeout).toBe("30 seconds");

    // Sync API streaming
    const sync = resourcesOf("Function", "SyncAPI");
    expect(sync.props.streaming).toBe(true);
  });
});
