import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamAwsSse } from "@/services/aiService";
import { useAuthStore } from "@/stores/auth";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("aiService - streamAwsSse", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore.setState({ session: { token: "test-token", expiresAt: 999 } } as any);
  });

  it("yields UPGRADE_REQUIRED when server responds with 403 upgrade_required", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "upgrade_required", message: "Pay up" })
    });

    const generator = streamAwsSse([], "deepseek");
    const result = await generator.next();

    expect(result.value).toEqual({
      type: "error",
      errorType: "server",
      content: "UPGRADE_REQUIRED: Pay up"
    });
  });

  it("sends action and subagentId in the body payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined })
        })
      },
      headers: new Headers({ "content-type": "text/event-stream" })
    });

    const generator = streamAwsSse([], "deepseek", "dummy", undefined, undefined, {
      action: "subagent",
      subagentId: "sdd-apply"
    });
    
    await generator.next();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"subagent"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"subagentId":"sdd-apply"'),
      })
    );
  });
});
