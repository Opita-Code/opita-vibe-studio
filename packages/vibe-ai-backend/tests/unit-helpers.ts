import { vi } from "vitest";

/**
 * Shared unit-test helpers for the Lambda handlers.
 * Lives outside src/ so it is NOT included in coverage.
 */

/** Fake Lambda response stream that records writes (used by chat/admin). */
export function createStream() {
  const writes: string[] = [];
  const stream: Record<string, unknown> = {
    setContentType: vi.fn(),
    write: (s: string) => {
      writes.push(s);
    },
    end: vi.fn(),
    headers: undefined,
    statusCode: undefined,
  };
  Object.defineProperty(stream, "output", {
    get: () => writes.join(""),
    enumerable: false,
  });
  return stream as unknown as {
    setContentType: ReturnType<typeof vi.fn>;
    write: (s: string) => void;
    end: ReturnType<typeof vi.fn>;
    output: string;
  };
}

/** Provide the AWS Lambda `awslambda` global used by chat.ts / admin.ts. */
export function setupAwslambdaGlobal() {
  (globalThis as unknown as Record<string, unknown>).awslambda = {
    streamifyResponse: (fn: unknown) => fn,
    HttpResponseStream: {
      from: (stream: unknown) => stream,
    },
  };
}

/** Build a plain (non-streaming) API Gateway Lambda event. */
export function makeEvent(overrides: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: string;
  sourceIp?: string;
  queryStringParameters?: Record<string, string>;
  isBase64Encoded?: boolean;
} = {}) {
  return {
    path: overrides.path || "/",
    requestContext: {
      http: {
        method: overrides.method || "GET",
        path: overrides.path || "/",
        sourceIp: overrides.sourceIp || "1.2.3.4",
      },
    },
    headers: overrides.headers || {},
    body: overrides.body !== undefined ? overrides.body : null,
    queryStringParameters: overrides.queryStringParameters || {},
    isBase64Encoded: overrides.isBase64Encoded || false,
  };
}

/** Parse the JSON body of a plain handler response. */
export function responseBody(response: { statusCode?: number; body?: string }) {
  try {
    return JSON.parse(response.body || "{}");
  } catch {
    return response.body;
  }
}

/** Shared DynamoDB DocumentClient mock factory: returns { send } bound to a vi.fn. */
export function makeDdbSend() {
  return vi.fn();
}

/** Type of the `awslambda.streamifyResponse` inner handler (chat.ts / admin.ts). */
export type StreamHandler = (
  event: any,
  stream: any,
  context: unknown,
) => Promise<void>;

