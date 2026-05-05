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
 * Procesa líneas individuales de un stream SSE de API compatible con OpenAI.
 * Cada línea debe empezar con "data: ".
 */
function processOpenAILine(line: string, onContent: (content: string) => void): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return;

  const data = trimmed.slice(6).trim();
  if (data === "[DONE]") return;

  try {
    const parsed = JSON.parse(data);
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) {
      onContent(content);
    }
  } catch {
    // Línea SSE no parseable — se omite silenciosamente
  }
}

/**
 * Procesa líneas individuales de un stream SSE de Gemini.
 */
function processGeminiLine(line: string, onContent: (content: string) => void): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return;

  const data = trimmed.slice(6).trim();
  if (!data) return;

  try {
    const parsed = JSON.parse(data);
    const candidates = parsed.candidates;
    if (!candidates || candidates.length === 0) return;

    const parts = candidates[0]?.content?.parts;
    if (!parts) return;

    for (const part of parts) {
      if (part.text) {
        onContent(part.text);
      }
    }
  } catch {
    // Línea no parseable — se omite
  }
}

/**
 * Lee un stream SSE desde un ReadableStream, dividiendo por líneas
 * y procesando cada línea completa.
 * El buffer retiene líneas incompletas entre lecturas.
 */
async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  processLine: (line: string) => void,
): Promise<void> {
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // La última línea puede estar incompleta — guardarla
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    }

    // Procesar el buffer restante después de que el stream se cierre
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        processLine(line);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Consume un stream SSE de una API compatible con OpenAI.
 * Retorna un AsyncGenerator que emite cada delta de contenido.
 *
 * Formato esperado por línea:
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: [DONE]
 */
export async function* streamOpenAICompatible(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ ...body, stream: true }),
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

  const pending: string[] = [];

  await readSSEStream(reader, decoder, (line) => {
    processOpenAILine(line, (content) => {
      pending.push(content);
    });
  });

  // Emitir los deltas recolectados
  for (const content of pending) {
    yield content;
  }
}

/**
 * Parsea el stream SSE de Gemini.
 * Gemini usa un formato diferente: candidates[0].content.parts[0].text
 */
export async function* streamGemini(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
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

  const pending: string[] = [];

  await readSSEStream(reader, decoder, (line) => {
    processGeminiLine(line, (content) => {
      pending.push(content);
    });
  });

  for (const content of pending) {
    yield content;
  }
}
