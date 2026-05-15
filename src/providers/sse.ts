/**
 * Utilidad compartida para parsear SSE (Server-Sent Events)
 * de APIs compatibles con OpenAI (chat completions).
 */

export class SseError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SseError";
  }
}


/**
 * Consume un stream SSE de una API compatible con OpenAI.
 * Retorna un AsyncGenerator que emite cada delta de contenido
 * EN TIEMPO REAL conforme llegan del stream.
 *
 * Formato esperado por línea:
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: [DONE]
 */
export async function* streamOpenAICompatible(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new SseError(response.status, `API error ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error("Response body is null — streaming not supported");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Non-parseable SSE line — skip
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parsea el stream SSE de Gemini EN TIEMPO REAL.
 * Gemini usa un formato diferente: candidates[0].content.parts[0].text
 */
export async function* streamGemini(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new SseError(response.status, `Gemini API error ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6).trim();
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          const candidates = parsed.candidates;
          if (!candidates || candidates.length === 0) continue;
          const parts = candidates[0]?.content?.parts;
          if (!parts) continue;
          for (const part of parts) {
            if (part.text) {
              yield part.text;
            }
          }
        } catch {
          // Non-parseable line — skip
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6).trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          const parts = parsed.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.text) yield part.text;
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
