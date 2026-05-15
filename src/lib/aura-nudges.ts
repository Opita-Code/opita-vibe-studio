/**
 * Aura Nudges — Sistema de detección de anti-patrones y guía proactiva.
 *
 * 100% client-side. 0 tokens LLM.
 * Analiza el input del usuario y el estado de la UI para generar
 * nudges contextuales que guían al usuario hacia buenas prácticas.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface AuraNudge {
  /** Mensaje corto para mostrar al usuario */
  message: string;
  /** Tipo visual del nudge */
  type: "tip" | "warning" | "info";
  /** ID único para evitar duplicados */
  id: string;
}

interface NudgeContext {
  /** Texto actual del input del usuario */
  input: string;
  /** Número de mensajes en la sesión actual */
  messageCount: number;
  /** Ratio de uso del contexto (0-1) */
  contextRatio: number;
  /** Si hay un proyecto abierto */
  hasProject: boolean;
  /** Último mensaje del asistente */
  lastAssistantMessage?: string;
  /** Cantidad de mensajes del usuario seguidos sin respuesta útil */
  consecutiveUserMessages: number;
}

// ─── Anti-Pattern Detectors ────────────────────────────────────

const ABSOLUTE_PATH_PATTERN = /[A-Z]:\\|\/(?:home|Users|root)\//i;
const INLINE_STYLE_PATTERN = /style\s*=\s*\{\{|style\s*=\s*"/i;
const ANY_TYPE_PATTERN = /:\s*any\b|<any>/;
const NO_TEST_MENTION = /(?:sin\s+tests?|no\s+(?:hay|tiene)\s+tests?|skip\s+tests?)/i;
const CONSOLE_LOG_PATTERN = /console\.log\(/;
const TODO_HACK_PATTERN = /(?:TODO|HACK|FIXME|XXX)\b/;
const IMPORTANT_PATTERN = /!important/;
const VAGUE_REQUEST = /^(?:hazlo|arréglalo|cámbialo|modifícalo|corrígelo)\s*$/i;

interface PatternRule {
  id: string;
  test: (ctx: NudgeContext) => boolean;
  nudge: AuraNudge;
}

const PATTERN_RULES: PatternRule[] = [
  {
    id: "absolute-path",
    test: (ctx) => ABSOLUTE_PATH_PATTERN.test(ctx.input),
    nudge: {
      id: "absolute-path",
      type: "warning",
      message: "📍 Usa rutas relativas: src/App.tsx en vez de rutas absolutas",
    },
  },
  {
    id: "inline-styles",
    test: (ctx) => INLINE_STYLE_PATTERN.test(ctx.input),
    nudge: {
      id: "inline-styles",
      type: "tip",
      message: "🎨 Mejor usar CSS modules o clases — los inline styles no escalan",
    },
  },
  {
    id: "any-type",
    test: (ctx) => ANY_TYPE_PATTERN.test(ctx.input),
    nudge: {
      id: "any-type",
      type: "warning",
      message: "🛡️ Evita 'any' — usa tipos específicos para aprovechar TypeScript",
    },
  },
  {
    id: "skip-tests",
    test: (ctx) => NO_TEST_MENTION.test(ctx.input),
    nudge: {
      id: "skip-tests",
      type: "warning",
      message: "🧪 Evita saltarte las pruebas. Probar cada función te ahorra dolores de cabeza futuros.",
    },
  },
  {
    id: "console-log",
    test: (ctx) => CONSOLE_LOG_PATTERN.test(ctx.input),
    nudge: {
      id: "console-log",
      type: "tip",
      message: "🔇 Usa un logger adecuado en producción — console.log es para debug",
    },
  },
  {
    id: "todo-hack",
    test: (ctx) => TODO_HACK_PATTERN.test(ctx.input),
    nudge: {
      id: "todo-hack",
      type: "info",
      message: "📌 Los TODO son deuda técnica — mejor resolver ahora que acumular",
    },
  },
  {
    id: "important-css",
    test: (ctx) => IMPORTANT_PATTERN.test(ctx.input),
    nudge: {
      id: "important-css",
      type: "warning",
      message: "⚠️ !important indica un problema de especificidad — mejor corregir la cascada",
    },
  },
  {
    id: "vague-request",
    test: (ctx) => VAGUE_REQUEST.test(ctx.input.trim()),
    nudge: {
      id: "vague-request",
      type: "tip",
      message: "💡 Sé más específico — ¿qué exactamente quieres cambiar y por qué?",
    },
  },
  {
    id: "no-project",
    test: (ctx) => !ctx.hasProject && ctx.input.length > 10 && /(?:crea|modifica|escrib|genera|agrega)/i.test(ctx.input),
    nudge: {
      id: "no-project",
      type: "info",
      message: "📂 Abre un proyecto primero para que Aura pueda trabajar con tus archivos",
    },
  },
  {
    id: "context-full",
    test: (ctx) => ctx.contextRatio >= 0.8,
    nudge: {
      id: "context-full",
      type: "warning",
      message: "⚡ Contexto casi lleno — inicia un nuevo chat para mantener calidad",
    },
  },
  {
    id: "repeated-messages",
    test: (ctx) => ctx.consecutiveUserMessages >= 3,
    nudge: {
      id: "repeated-messages",
      type: "tip",
      message: "💡 ¿Aura no entiende? Reformula tu pedido con más contexto",
    },
  },
];

// ─── Public API ────────────────────────────────────────────────

/**
 * Detecta el nudge más relevante dado el contexto actual.
 * Retorna el primer nudge que coincida, o null si no hay ninguno.
 *
 * Prioridad: warnings > tips > info
 */
export function detectNudge(ctx: NudgeContext): AuraNudge | null {
  // Ordenar por prioridad: warning primero, luego tip, luego info
  const priorityOrder: Record<AuraNudge["type"], number> = {
    warning: 0,
    tip: 1,
    info: 2,
  };

  const matches = PATTERN_RULES
    .filter((rule) => rule.test(ctx))
    .map((rule) => rule.nudge)
    .sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

  return matches[0] ?? null;
}

/**
 * Construye el contexto de nudge a partir del estado de la aplicación.
 * Helper para ser usado en los componentes de UI.
 */
export function buildNudgeContext(
  input: string,
  messages: Array<{ role: string; content: string }>,
  hasProject: boolean,
  maxMessages: number = 50,
): NudgeContext {
  const messageCount = messages.length;
  const contextRatio = messageCount / maxMessages;

  // Contar mensajes consecutivos del usuario al final
  let consecutiveUserMessages = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      consecutiveUserMessages++;
    } else {
      break;
    }
  }

  // Último mensaje del asistente
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return {
    input,
    messageCount,
    contextRatio,
    hasProject,
    lastAssistantMessage: lastAssistant?.content,
    consecutiveUserMessages,
  };
}
