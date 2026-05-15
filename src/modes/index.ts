/**
 * Modos de operación de Aura — Sistema simplificado.
 *
 * 4 modos:
 *   - Auto:      Aura detecta el modo por contexto
 *   - Construir: Crear, modificar, corregir, testear, optimizar código
 *   - Planear:   Explorar, analizar, proponer — sin tocar archivos
 *   - Vibe:      Pipeline SDD estricto (entender→construir→verificar)
 *
 * + detección de intención conversacional (chat inline)
 */

import { TOOL_DEFINITIONS, type ToolDefinition } from "@/tools/definitions";

// ─── Conversational Intent ──────────────────────────────────────

/**
 * Patrones que indican intención CONVERSACIONAL — el usuario quiere
 * que el agente responda con código EN EL CHAT, sin tocar archivos.
 * Estas señales tienen prioridad sobre los triggers de otros modos.
 */
const CONVERSATIONAL_INTENT = [
  // Indicadores explícitos de "en el chat"
  "en el chat", "en este chat", "aquí en el chat",
  "escríbelo aquí", "escribelo aqui", "escríbemelo aquí", "escribemelo aqui",
  "ponlo aquí", "ponlo aqui",
  // "Muéstrame" / "enséñame" / "mostrarme" → educativa, no filesystem
  "muéstrame", "muestrame", "enséñame", "enseñame",
  "mostrarme", "puedes mostrarme", "podrías mostrarme", "podrias mostrarme",
  "muéstrame cómo", "muestrame como",
  "cómo se ve", "como se ve", "cómo luce", "como luce",
  // Ejemplos
  "dame un ejemplo", "dame ejemplo", "ejemplo de", "ponme un ejemplo",
  // "Escríbeme" sin filesystem
  "escríbeme", "escribeme",
  // Educativo / hipotético
  "cómo sería", "como seria", "cómo quedaría", "como quedaria",
  "cómo se haría", "como se haria", "cómo se hace", "como se hace",
  // Preguntas sobre conceptos (no acciones sobre archivos)
  "qué es", "que es", "qué son", "que son",
  "para qué sirve", "para que sirve",
  "cuál es la diferencia", "cual es la diferencia",
  "explícame qué", "explicame que", "explícame la", "explicame la",
];

// ─── Types ─────────────────────────────────────────────────────

export type VibeModeId = "auto" | "construir" | "planear" | "vibe" | "chat";

export interface VibeMode {
  id: VibeModeId;
  name: string;
  icon: string;
  description: string;
  command: string | null;
  /** Keywords que activan el modo automáticamente (solo usado en modo auto) */
  triggers: string[];
  /** Prompt adicional que se inyecta al system prompt */
  systemPromptAddon: string;
  /** IDs de herramientas habilitadas (null = todas) */
  enabledTools: string[] | null;
  /** Color del badge */
  color: string;
  /** Si se muestra en el dropdown de selección */
  selectable: boolean;
}

// ─── Mode Definitions ──────────────────────────────────────────

/**
 * Chat — modo interno, no seleccionable. Activado por intención conversacional.
 */
const CHAT_MODE: VibeMode = {
  id: "chat",
  name: "Chat",
  icon: "💬",
  description: "Conversación libre sobre programación",
  command: null,
  triggers: [],
  systemPromptAddon: `
## Modo: Chat 💬
Estás en modo conversacional. El usuario quiere hablar, preguntar, o que le muestres código **directamente en la respuesta**.
- Responde con código en bloques markdown (\`\`\`tsx, \`\`\`css, etc.)
- NO uses herramientas de archivos (read_file, write_file, apply_diff) a menos que el usuario lo pida explícitamente
- Explica conceptos, muestra ejemplos, enseña
- Si el usuario dice "muéstrame", "escríbeme", "dame un ejemplo", "en el chat" → responde INLINE, no modifiques el proyecto
- Sé conciso y directo`,
  enabledTools: ["memory_save", "memory_search"],
  color: "slate",
  selectable: false,
};

export const VIBE_MODES: VibeMode[] = [
  CHAT_MODE,
  {
    id: "auto",
    name: "Auto",
    icon: "🧠",
    description: "Aura detecta el modo por contexto",
    command: null,
    triggers: [], // Auto no tiene triggers propios — usa los de los otros modos
    systemPromptAddon: "", // Dinámico — se inyecta según detección
    enabledTools: null,
    color: "cyan",
    selectable: true,
  },
  {
    id: "construir",
    name: "Construir",
    icon: "🏗️",
    description: "Crear, modificar, corregir y testear código",
    command: "/construir",
    triggers: [
      // Crear
      "crear", "hacer", "generar", "implementar",
      "nuevo", "nueva", "componente", "página", "pagina",
      "construir", "desarrollar", "armar", "montar", "añadir", "agregar",
      // Corregir
      "bug", "error", "falla", "no funciona", "no sirve", "se rompe",
      "arreglar", "corregir", "fix", "depurar", "debug", "rompe",
      "crashea", "problema", "issue",
      // Optimizar
      "mejorar", "mejora ", "optimizar", "optimiza", "rendimiento", "lento",
      "refactorizar", "refactor", "limpiar", "simplificar", "simplifica",
      "performance", "rápido", "eficiente", "reducir", "consolidar",
      // Testear
      "test", "tests", "prueba", "pruebas", "coverage", "cobertura",
      "testear", "validar", "unitario", "integración", "e2e",
    ],
    systemPromptAddon: `
## Modo: Construir 🏗️
Tu objetivo es crear, modificar, corregir, y testear código directamente.
- SIEMPRE lee archivos existentes antes de modificar para mantener consistencia
- Para archivos nuevos: write_file con contenido completo
- Para cambios: apply_diff para cambios quirúrgicos
- Para bugs: investiga primero (read_file + search_code), luego corrige
- Para tests: sigue la convención del proyecto (Vitest, Jest, etc.)
- Sigue las convenciones del proyecto (imports, naming, estilos)
- Si el archivo ya existe, prefiere apply_diff sobre write_file

Recuerda: UNA herramienta por respuesta. Lee primero, espera el resultado, luego actúa.`,
    enabledTools: null,
    color: "purple",
    selectable: true,
  },
  {
    id: "planear",
    name: "Planear",
    icon: "📋",
    description: "Analizar, explorar, y proponer — sin tocar archivos",
    command: "/planear",
    triggers: [
      // Explorar
      "explícame", "explicame", "explica ", "cómo funciona", "como funciona",
      "qué hace", "que hace", "analiza", "revisar", "entender",
      "recorre", "dónde está", "donde esta",
      // Planificar
      "arquitectura", "diseño", "plan", "planificar", "estructura",
      "organizar", "diagrama", "decisión", "decision", "trade-off",
      "comparar", "evaluar", "propuesta",
    ],
    systemPromptAddon: `
## Modo: Planear 📋
Tu objetivo es analizar, explorar, y proponer — SIN modificar archivos.
- Lee y analiza el código del proyecto con read_file y search_code
- Explica la arquitectura, flujos, y decisiones del código
- Propón cambios con justificación técnica
- Crea planes de implementación o documentos de diseño
- Identifica riesgos y trade-offs
- NO hagas cambios de código directamente — solo proponer
- Sé detallado, citando líneas y archivos específicos

Recuerda: UNA herramienta por respuesta. Lee un archivo, espera el resultado, luego analiza.`,
    enabledTools: ["read_file", "list_files", "search_code", "memory_search", "memory_save"],
    color: "rose",
    selectable: true,
  },
  {
    id: "vibe",
    name: "Modo Vibe",
    icon: "🔮",
    description: "Creación guiada paso a paso: entender → construir → verificar",
    command: "/vibe",
    triggers: [
      "creación guiada", "paso a paso", "vibe mode", "modo vibe", "modo estricto",
      "entender construir verificar", "ciclo completo",
    ],
    systemPromptAddon: `
## Modo: Vibe 🔮 (Creación Guiada)
Estás en modo Vibe — un proceso de creación estructurado paso a paso para asegurar la calidad sin abrumar al usuario. Usa un lenguaje amigable y accesible (sin jerga de ingeniería como TDD o SDD).
- FASE 1 (Entender): Analiza el pedido de forma sencilla, crea un plan claro, identifica qué vamos a construir o modificar.
- FASE 2 (Construir): Implementa el plan de forma segura. Crea o modifica archivos asegurándote de que todo funcione.
- FASE 3 (Verificar): Revisa visual o lógicamente que los cambios cumplan con lo que pidió el usuario.
- Evita usar términos técnicos avanzados en el chat; enfócate en el valor y el resultado visual/funcional.
- Si algo falla, intenta corregirlo automáticamente.

Recuerda: UNA herramienta por respuesta. Este modo es estructurado pero muy amigable.`,
    enabledTools: null,
    color: "amber",
    selectable: true,
  },
];

// ─── Mode Detection ────────────────────────────────────────────

/**
 * Triggers internos del modo "construir" — usados por detectMode en modo auto
 */
const CONSTRUIR_TRIGGERS = VIBE_MODES.find((m) => m.id === "construir")!.triggers;
const PLANEAR_TRIGGERS = VIBE_MODES.find((m) => m.id === "planear")!.triggers;
const VIBE_TRIGGERS = VIBE_MODES.find((m) => m.id === "vibe")!.triggers;

/**
 * Detecta el modo de IA basado en el mensaje del usuario.
 * Solo se usa cuando el modo está en "Auto".
 * Prioridad: comando manual > intención conversacional > keywords > default (construir)
 */
export function detectMode(text: string): VibeMode {
  const lower = text.toLowerCase().trim();

  // 1. Comando manual (ej: "/planear cómo funciona el auth")
  for (const mode of VIBE_MODES) {
    if (mode.command && lower.startsWith(mode.command)) {
      return mode;
    }
  }

  // 2. Intención conversacional → forzar chat (antes de keyword scan)
  if (CONVERSATIONAL_INTENT.some((p) => lower.includes(p))) {
    return CHAT_MODE;
  }

  // 3. Vibe mode triggers (antes de construir para evitar conflictos)
  if (VIBE_TRIGGERS.some((t) => lower.includes(t))) {
    return VIBE_MODES.find((m) => m.id === "vibe")!;
  }

  // 4. Planear triggers (antes de construir — "explícame" no es "crear")
  if (PLANEAR_TRIGGERS.some((t) => lower.includes(t))) {
    return VIBE_MODES.find((m) => m.id === "planear")!;
  }

  // 5. Construir triggers
  if (CONSTRUIR_TRIGGERS.some((t) => lower.includes(t))) {
    return VIBE_MODES.find((m) => m.id === "construir")!;
  }

  // 6. Default en modo auto: construir (el usuario abrió el IDE para hacer, no para hablar)
  return VIBE_MODES.find((m) => m.id === "construir")!;
}

/**
 * Extrae el texto real del mensaje (sin el comando manual).
 */
export function stripCommand(text: string): string {
  const lower = text.toLowerCase().trim();

  for (const mode of VIBE_MODES) {
    if (mode.command && lower.startsWith(mode.command)) {
      return text.slice(mode.command.length).trim();
    }
  }

  return text;
}

/**
 * Obtiene las herramientas filtradas para un modo específico.
 */
export function getToolsForMode(mode: VibeMode): ToolDefinition[] {
  if (mode.enabledTools === null) return TOOL_DEFINITIONS;
  return TOOL_DEFINITIONS.filter((t) => mode.enabledTools!.includes(t.name));
}

/**
 * Retorna los modos seleccionables para el dropdown.
 */
export function getSelectableModes(): VibeMode[] {
  return VIBE_MODES.filter((m) => m.selectable);
}

/**
 * Busca un modo por ID.
 */
export function getModeById(id: VibeModeId): VibeMode | undefined {
  return VIBE_MODES.find((m) => m.id === id);
}
