/**
 * Think Block Parser — Manejo de bloques `<think>...</think>` en SSE.
 *
 * MiniMax-M3 (y otros modelos de razonamiento) emiten bloques de
 * reasoning envueltos en `<think>...</think>` que llegan en MÚLTIPLES
 * chunks SSE. El parser debe:
 *
 * 1. Acumular el contenido entre `<think>` y `</think>` como reasoning
 *    (no como texto visible al usuario).
 * 2. Tolerar edge cases de MiniMax: `</think>` doble, `<think` sin `>`,
 *    `</think` sin `>`, o el opening y closing en el mismo chunk.
 * 3. Colapsar los tags: el usuario NUNCA debe ver `<think>` ni `</think>`
 *    literal en el chat.
 *
 * Diseño: clase con estado (inThink, thinkBuffer). El caller alimenta
 * chunks de texto y recibe eventos estructurados. Funciona entre chunks
 * porque el estado vive en la instancia. Cada feed() devuelve un array
 * NUEVO de eventos — no se comparte estado de array entre llamadas.
 */

/** Límite de razonamiento acumulado antes de forzar cierre (evita OOM). */
export const MAX_THINK_BUFFER = 50 * 1024; // 50KB

export type ThinkChunkEvent =
  | { kind: "reasoning"; content: string }
  | { kind: "text"; content: string }
  | { kind: "warning"; message: string };

export class ThinkParser {
  private inThink = false;
  private thinkBuffer = "";
  private truncated = false;

  /** Reinicia el estado (nuevo stream). */
  reset(): void {
    this.inThink = false;
    this.thinkBuffer = "";
    this.truncated = false;
  }

  /**
   * Procesa un chunk de texto del modelo.
   * Devuelve los eventos que deben emitirse.
   */
  feed(content: string): ThinkChunkEvent[] {
    const events: ThinkChunkEvent[] = [];
    if (!content) return events;
    this.feedInto(content, events);
    return events;
  }

  /**
   * Lógica interna. Acumula eventos en `events` (array local del feed()).
   * La recursión SIEMPRE usa el mismo array local — nunca se duplica
   * porque el resultado de cada sub-llamada se vuelca una sola vez.
   */
  private feedInto(content: string, events: ThinkChunkEvent[]): void {
    if (this.inThink) {
      this.feedInsideThink(content, events);
      return;
    }
    this.feedOutsideThink(content, events);
  }

  /** Chunk mientras estamos dentro de un bloque <think> (o abriéndolo). */
  private feedInsideThink(content: string, events: ThinkChunkEvent[]): void {
    const closeIdx = content.indexOf("</think>");

    if (closeIdx === -1) {
      // Sin closing: acumular todo como reasoning.
      this.appendThink(content);
      return;
    }

    // Closing encontrado: split en el primero.
    const beforeClose = content.slice(0, closeIdx);
    const afterClose = content.slice(closeIdx + "</think>".length);

    this.appendThink(beforeClose);
    this.flushThink(events);

    // El texto posterior al cierre puede contener ANOTHER `<think>`
    // (caso raro) o directamente texto visible.
    if (afterClose) {
      // Strip cualquier `</think>` residual (doble cierre).
      const cleaned = afterClose.replace(/<\/think>/g, "");
      this.feedOutsideThink(cleaned, events);
    }
  }

  /** Chunk mientras estamos FUERA de un bloque <think>. */
  private feedOutsideThink(content: string, events: ThinkChunkEvent[]): void {
    const openIdx = content.indexOf("<think>");
    const openIdxNoGt = content.indexOf("<think"); // sin '>' (falso positivo)

    // Si hay apertura real (con '>')...
    if (openIdx !== -1) {
      const beforeOpen = content.slice(0, openIdx);
      const afterOpen = content.slice(openIdx + "<think>".length);

      if (beforeOpen) {
        events.push({ kind: "text", content: beforeOpen });
      }

      // Entrar en modo think y procesar el resto del chunk.
      this.inThink = true;
      this.thinkBuffer = "";
      this.truncated = false;
      if (afterOpen) {
        this.feedInsideThink(afterOpen, events);
      }
      return;
    }

    // `<think` sin '>' → no es apertura válida; tratar como texto.
    if (openIdxNoGt !== -1) {
      events.push({ kind: "warning", message: "tag <think> incompleto detectado" });
    }

    events.push({ kind: "text", content });
  }

  /** Acumula contenido al buffer de reasoning con límite. */
  private appendThink(content: string): void {
    if (this.truncated) return;
    this.thinkBuffer += content;
    if (this.thinkBuffer.length > MAX_THINK_BUFFER) {
      this.thinkBuffer = this.thinkBuffer.slice(0, MAX_THINK_BUFFER) + "... (razonamiento truncado)";
      this.truncated = true;
    }
  }

  /** Emite el buffer acumulado como reasoning y limpia estado. */
  private flushThink(events: ThinkChunkEvent[]): void {
    if (this.thinkBuffer) {
      events.push({ kind: "reasoning", content: this.thinkBuffer });
    }
    this.inThink = false;
    this.thinkBuffer = "";
    this.truncated = false;
  }

  /** ¿Estamos dentro de un bloque <think>? (para estado del UI) */
  get isThinking(): boolean {
    return this.inThink;
  }
}

/**
 * Helper: procesa el campo content de un chunk SSE (texto plano).
 * Retorna los chunks tipados SSE (reasoning/text) que deben emitirse.
 * Conveniencia para parsers que ya tienen estructura de eventos propia.
 */
export function processThinkContent(
  parser: ThinkParser,
  content: string,
): Array<{ type: "reasoning" | "text"; content: string }> {
  const events = parser.feed(content);
  return events
    .filter((e): e is Extract<ThinkChunkEvent, { kind: "reasoning" | "text" }> =>
      e.kind === "reasoning" || e.kind === "text"
    )
    .map((e) => ({ type: e.kind, content: e.content }));
}
