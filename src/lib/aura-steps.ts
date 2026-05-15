/**
 * Aura Smart Next-Step Engine — Sugerencias contextuales de siguiente paso.
 *
 * 100% client-side. 0 tokens LLM.
 * Analiza el último mensaje del agente y el estado de la app
 * para sugerir 1-2 acciones lógicas como siguiente paso.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface AuraStep {
  /** Texto visible del chip */
  label: string;
  /** Texto que se inyecta en el input al clickear */
  action: string;
  /** Icono del chip */
  icon: string;
}

interface StepContext {
  /** Contenido del último mensaje del asistente */
  lastAssistantContent: string;
  /** Si el pipeline tiene una fase activa */
  pipelinePhase: string | null;
  /** Si hay un proyecto abierto */
  hasProject: boolean;
  /** Si hay archivos abiertos */
  hasOpenFiles: boolean;
  /** Número de mensajes en la sesión */
  messageCount: number;
}

// ─── Pattern Rules ─────────────────────────────────────────────

const FILE_CREATED_PATTERN = /(?:✅\s*Archivo\s+cread|creé|modifiqué|escribí|generé)/i;
const CONCEPT_EXPLAINED_PATTERN = /(?:esto\s+(?:significa|quiere\s+decir)|en\s+resumen|básicamente|la\s+diferencia\s+(?:es|entre))/i;
const ERROR_FIXED_PATTERN = /(?:corregí|arreglé|solucioné|el\s+(?:error|bug)\s+(?:era|estaba))/i;
const TEST_MENTIONED_PATTERN = /(?:test|prueba|spec|\.test\.|\.spec\.)/i;
const PLAN_PATTERN = /(?:plan|pasos?|primero|después|luego)/i;
const COMPONENT_PATTERN = /(?:componente|component|widget)/i;

interface StepRule {
  test: (ctx: StepContext) => boolean;
  steps: AuraStep[];
  priority: number;
}

const STEP_RULES: StepRule[] = [
  // Componente creado → VibeLens y tests (más específico, va primero)
  {
    test: (ctx) => COMPONENT_PATTERN.test(ctx.lastAssistantContent) && FILE_CREATED_PATTERN.test(ctx.lastAssistantContent),
    priority: 0,
    steps: [
      { label: "VibeLens", action: "Aísla el componente en VibeLens para previsualizarlo", icon: "🔬" },
      { label: "Agregar tests", action: "Crea tests unitarios para el componente", icon: "🧪" },
    ],
  },
  // Tests creados → ejecutar
  {
    test: (ctx) => TEST_MENTIONED_PATTERN.test(ctx.lastAssistantContent) && FILE_CREATED_PATTERN.test(ctx.lastAssistantContent),
    priority: 0,
    steps: [
      { label: "Correr tests", action: "Ejecuta los tests que creaste", icon: "🧪" },
    ],
  },
  // Archivos creados/modificados (genérico) → sugerir tests y preview
  {
    test: (ctx) => FILE_CREATED_PATTERN.test(ctx.lastAssistantContent),
    priority: 1,
    steps: [
      { label: "Ejecutar tests", action: "Ejecuta los tests del proyecto", icon: "🧪" },
      { label: "Previsualizar", action: "Muéstrame la vista previa", icon: "👁️" },
    ],
  },
  // Error corregido → verificar y tests
  {
    test: (ctx) => ERROR_FIXED_PATTERN.test(ctx.lastAssistantContent),
    priority: 1,
    steps: [
      { label: "Verificar fix", action: "¿Funciona correctamente ahora?", icon: "✅" },
      { label: "Agregar test", action: "Crea un test para prevenir que esto vuelva a pasar", icon: "🧪" },
    ],
  },
  // Concepto explicado → construir o pedir ejemplo
  {
    test: (ctx) => CONCEPT_EXPLAINED_PATTERN.test(ctx.lastAssistantContent),
    priority: 2,
    steps: [
      { label: "Implementarlo", action: "Ahora implementa eso en mi proyecto", icon: "🏗️" },
      { label: "Ejemplo real", action: "Dame un ejemplo concreto con código", icon: "📝" },
    ],
  },
  // Plan explicado → ejecutar
  {
    test: (ctx) => PLAN_PATTERN.test(ctx.lastAssistantContent) && !FILE_CREATED_PATTERN.test(ctx.lastAssistantContent),
    priority: 3,
    steps: [
      { label: "Ejecutar plan", action: "Ejecuta el plan que propusiste", icon: "⚡" },
    ],
  },
  // Conversación nueva con proyecto → explorar
  {
    test: (ctx) => ctx.messageCount <= 2 && ctx.hasProject,
    priority: 4,
    steps: [
      { label: "Explorar proyecto", action: "Explora la estructura de mi proyecto", icon: "🔍" },
      { label: "Ver README", action: "Lee el README del proyecto", icon: "📖" },
    ],
  },
  // Sin proyecto → abrir
  {
    test: (ctx) => !ctx.hasProject && ctx.messageCount <= 2,
    priority: 5,
    steps: [
      { label: "Abrir proyecto", action: "¿Cómo abro un proyecto en Vibe Studio?", icon: "📂" },
    ],
  },
];

// ─── Public API ────────────────────────────────────────────────

/**
 * Genera las sugerencias de siguiente paso basadas en el contexto.
 * Retorna máximo 2 sugerencias ordenadas por relevancia.
 */
export function getNextSteps(ctx: StepContext): AuraStep[] {
  if (!ctx.lastAssistantContent && ctx.messageCount > 2) return [];

  const matches = STEP_RULES
    .filter((rule) => rule.test(ctx))
    .sort((a, b) => a.priority - b.priority);

  if (matches.length === 0) return [];

  // Tomar las sugerencias de la regla más prioritaria
  return matches[0].steps.slice(0, 2);
}

/**
 * Construye el contexto de steps a partir del estado de la app.
 */
export function buildStepContext(
  messages: Array<{ role: string; content: string }>,
  pipelinePhase: string | null,
  hasProject: boolean,
  hasOpenFiles: boolean,
): StepContext {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return {
    lastAssistantContent: lastAssistant?.content ?? "",
    pipelinePhase,
    hasProject,
    hasOpenFiles,
    messageCount: messages.length,
  };
}
