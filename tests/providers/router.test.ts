import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { routeRequest, streamFromProvider } from "../../src/providers/router";
import { resetRegistry, registerProvider } from "../../src/providers/registry";
import type { AIProvider, ChatChunk, ChatOptions, Message } from "../../src/lib/types";

function makeMsg(
  content: string,
  role: "user" | "assistant" | "system" = "user",
): Message {
  return {
    id: `msg-${Date.now()}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

function makeTestProvider(
  id: string,
  name: string,
  tier: "free" | "byok" = "free",
  shouldSucceed = true,
): AIProvider {
  return {
    id,
    name,
    tier,
    chat: async function* (
      _messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!shouldSucceed) {
        yield {
          type: "error",
          content: `${id} no configurado`,
        };
        return;
      }
      yield { type: "text", content: `respuesta de ${id}` };
      yield { type: "done", content: "" };
    },
    countTokens: (_messages: Message[]) => 10,
  };
}

describe("Provider Router", () => {
  beforeEach(() => {
    resetRegistry();
    // Set up test providers
    registerProvider(makeTestProvider("provider-a", "Provider A", "free", true));
    registerProvider(makeTestProvider("provider-b", "Provider B", "free", true));
    registerProvider(
      makeTestProvider("provider-fail", "Failing Provider", "free", false),
    );
    registerProvider(makeTestProvider("provider-byok", "BYOK Provider", "byok", true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use preferred provider when specified", async () => {
    const context = [makeMsg("Hola")];
    const chunks: (ChatChunk & { providerId?: string })[] = [];

    for await (const chunk of routeRequest(context, {
      preferredProvider: "provider-a",
    })) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
    expect(textChunks[0].content).toBe("respuesta de provider-a");
  });

  it("should failover from failing provider to next free provider", async () => {
    const context = [makeMsg("Hola")];
    const chunks: (ChatChunk & { providerId?: string })[] = [];

    for await (const chunk of routeRequest(context, {
      preferredProvider: "provider-fail",
    })) {
      chunks.push(chunk);
    }

    // Should skip provider-fail and fall through to free providers
    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
    // Should get response from a working free provider
    const responseText = textChunks.map((c) => c.content).join("");
    expect(responseText).toMatch(/respuesta de/);
  });

  it("should fallback with config message when all providers fail", async () => {
    resetRegistry();
    // Register only failing providers
    registerProvider(makeTestProvider("fail-a", "Fail A", "free", false));
    registerProvider(makeTestProvider("fail-b", "Fail B", "free", false));

    const context = [makeMsg("Hola")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of routeRequest(context, {})) {
      chunks.push(chunk);
    }

    const errorChunks = chunks.filter((c) => c.type === "error");
    expect(errorChunks.length).toBeGreaterThan(0);
    // Should contain the fallback message
    const fullText = errorChunks.map((c) => c.content).join("");
    expect(fullText).toContain("Configurá una API key");
  });

  it("should yield done chunk at the end", async () => {
    const context = [makeMsg("Hola")];
    let lastChunk: (ChatChunk & { providerId?: string }) | undefined;

    for await (const chunk of routeRequest(context, {
      preferredProvider: "provider-a",
    })) {
      lastChunk = chunk;
    }

    expect(lastChunk).toBeDefined();
    expect(lastChunk!.type).toBe("done");
  });

  it("should include providerId and model in route result chunks", async () => {
    const context = [makeMsg("Hola")];

    for await (const chunk of routeRequest(context, {
      preferredProvider: "provider-a",
    })) {
      if (chunk.type === "text") {
        expect((chunk as ChatChunk & { providerId?: string }).providerId).toBe(
          "provider-a",
        );
      }
      if (chunk.type === "done") break;
    }
  });

  it("should try BYOK providers after free providers", async () => {
    resetRegistry();
    // Register only failing free providers + working BYOK
    registerProvider(makeTestProvider("free-fail", "Free Fail", "free", false));
    registerProvider(makeTestProvider("byok-working", "BYOK Working", "byok", true));

    const context = [makeMsg("Hola")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of routeRequest(context, {})) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toContain("byok-working");
  });

  // ── DeepSeek → Gemini fallback ────────────────────────────

  it("should fallback from deepseek to gemini when deepseek fails", async () => {
    resetRegistry();
    registerProvider(makeTestProvider("deepseek", "DeepSeek V3", "free", false));
    registerProvider(makeTestProvider("gemini", "Gemini Flash", "free", true));

    const context = [makeMsg("Creá una página")];
    const chunks: (ChatChunk & { providerId?: string })[] = [];

    for await (const chunk of routeRequest(context, {
      preferredProvider: "deepseek",
    })) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);

    // Should have received response from gemini (not deepseek)
    const geminiChunks = chunks.filter(
      (c) => (c as ChatChunk & { providerId?: string }).providerId === "gemini",
    );
    expect(geminiChunks.length).toBeGreaterThan(0);
  });

  it("should return fallback message when both deepseek and gemini fail", async () => {
    resetRegistry();
    registerProvider(makeTestProvider("deepseek", "DeepSeek V3", "free", false));
    registerProvider(makeTestProvider("gemini", "Gemini Flash", "free", false));

    const context = [makeMsg("Creá una página")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of routeRequest(context, {
      preferredProvider: "deepseek",
    })) {
      chunks.push(chunk);
    }

    const errorChunks = chunks.filter((c) => c.type === "error");
    const fullText = errorChunks.map((c) => c.content).join("");
    expect(fullText).toContain("Configurá una API key");
  });

  // ── streamFromProvider ────────────────────────────────────

  it("streamFromProvider should combine context and prompt", async () => {
    resetRegistry();
    registerProvider(makeTestProvider("provider-a", "Provider A", "free", true));

    const context = [makeMsg("mensaje anterior"), makeMsg("nuevo prompt")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of streamFromProvider(
      context,
      "provider-a",
    )) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
  });

  it("streamFromProvider should work without preferred provider", async () => {
    resetRegistry();
    registerProvider(makeTestProvider("provider-a", "Provider A", "free", true));

    const context = [makeMsg("solo prompt")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of streamFromProvider(context)) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
  });

  it("streamFromProvider should inject UI Navigation system prompt", async () => {
    resetRegistry();
    let capturedContext: Message[] = [];
    const testProvider = makeTestProvider("provider-a", "Provider A", "free", true);
    testProvider.chat = async function* (messages: Message[]) {
      capturedContext = messages;
      yield { type: "done", content: "" };
    };
    registerProvider(testProvider);

    const context = [makeMsg("solo prompt")];
    const chunks: ChatChunk[] = [];
    for await (const chunk of streamFromProvider(context, "provider-a")) {
      chunks.push(chunk);
    }

    const systemMessage = capturedContext.find(m => m.role === "system");
    expect(systemMessage).toBeDefined();
    expect(systemMessage!.content).toContain("[SISTEMA: Herramientas de Navegación UI]");
    expect(systemMessage!.content).toContain("<vibe-action");
  });

  it("streamFromProvider should propagate action and subagentId options", async () => {
    resetRegistry();
    let capturedOptions: ChatOptions | undefined;
    const testProvider = makeTestProvider("provider-a", "Provider A", "free", true);
    testProvider.chat = async function* (messages: Message[], options?: ChatOptions) {
      capturedOptions = options;
      yield { type: "done", content: "" };
    };
    registerProvider(testProvider);

    const context = [makeMsg("solo prompt")];
    const chunks: ChatChunk[] = [];
    for await (const chunk of streamFromProvider(context, "provider-a", {
      action: "subagent",
      subagentId: "sdd-explore"
    })) {
      chunks.push(chunk);
    }

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions!.action).toBe("subagent");
    expect(capturedOptions!.subagentId).toBe("sdd-explore");
  });
});
