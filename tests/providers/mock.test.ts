import { describe, it, expect } from "vitest";
import { mockStreamResponse } from "../../src/providers/mock";

describe("mockStreamResponse", () => {
  it("should yield text chunks character by character", async () => {
    const chunks: string[] = [];

    for await (const chunk of mockStreamResponse()) {
      if (chunk.type === "text") {
        chunks.push(chunk.content);
      }
    }

    const fullText = chunks.join("");
    expect(fullText).toBe("Hola, soy Vibe Studio. ¿En qué te puedo ayudar?");
    // Each chunk should be a single character
    expect(chunks.length).toBe(fullText.length);
  });

  it("should yield a done chunk at the end", async () => {
    let lastChunk;

    for await (const chunk of mockStreamResponse()) {
      lastChunk = chunk;
    }

    expect(lastChunk).toBeDefined();
    expect(lastChunk.type).toBe("done");
    expect(lastChunk.content).toBe("");
  });

  it("should yield at least one text chunk", async () => {
    let textChunks = 0;

    for await (const chunk of mockStreamResponse()) {
      if (chunk.type === "text") {
        textChunks++;
      }
    }

    expect(textChunks).toBeGreaterThan(0);
  });
});
