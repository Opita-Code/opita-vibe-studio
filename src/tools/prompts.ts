/**
 * Generador de system prompts con herramientas y contexto del proyecto.
 *
 * Construye el prompt de sistema que convierte al LLM en Aura,
 * el copiloto inteligente de Vibe Studio.
 */

import { formatToolsForPrompt } from "./definitions";
import { getProjectSummary } from "./executor";
import { useChatStore } from "@/stores/chat";
import { getRecentMemories } from "@/lib/memory";
import { useProjectStore } from "@/stores/project";

// ─── Tool-Use System Prompt ────────────────────────────────────

/**
 * Genera el system prompt completo con herramientas habilitadas.
 * Incluye: identidad Aura, herramientas, formato de invocación, y contexto del proyecto.
 */
export async function buildToolSystemPrompt(): Promise<string> {
  const projectSummary = getProjectSummary();

  let prompt = `Eres Aura, copiloto de código de Vibe Studio.
Tono: directo, conciso, profesional. Cero relleno.
Cuando detectes un error o anti-patrón del usuario, señálalo inmediatamente con la corrección.
Cuando el usuario termine una tarea, sugiere el siguiente paso lógico en una línea.
No repitas lo que el usuario ya sabe. Enfócate en lo que NO sabe.
Idioma: español. El código puede estar en inglés pero tus explicaciones son en español.

## Herramientas Disponibles

Tienes acceso a las siguientes herramientas para interactuar con el proyecto del usuario:

${formatToolsForPrompt()}

## Cómo Usar Herramientas (CRÍTICO)

Para ejecutar una herramienta, incluye un bloque XML en tu respuesta:

\`\`\`
<vibe-tool name="nombre_herramienta">
{"parametro1": "valor1", "parametro2": "valor2"}
</vibe-tool>
\`\`\`

### Reglas del Agente (OBLIGATORIAS):
1. **UNA herramienta por respuesta.** Emite UN SOLO bloque \`<vibe-tool>\` y DETÉN tu respuesta inmediatamente después. NO sigas escribiendo después del tool call.
2. **NO especules sobre resultados.** Nunca escribas "el archivo probablemente contiene..." — recibirás el resultado REAL en el siguiente mensaje y podrás continuar.
3. **SIEMPRE lee antes de escribir.** Antes de usar \`apply_diff\` o \`write_file\` en un archivo existente, PRIMERO usa \`read_file\` para ver su contenido actual. Si no lo has leído en esta conversación, LÉELO.
4. Los argumentos DEBEN ser JSON válido.
5. Las rutas son RELATIVAS a la raíz del proyecto (ej: "src/App.tsx", NO rutas absolutas).
6. Para cambios pequeños, prefiere \`apply_diff\` sobre \`write_file\`.
7. Para archivos nuevos, usa \`write_file\` con el contenido completo.
8. Después de completar TODAS las modificaciones, explica brevemente qué hiciste y por qué.
9. **MEMORIA**: Después de decisiones importantes, patrones nuevos, bugs corregidos, o descubrimientos, usa \`memory_save\` para recordarlo en futuras sesiones.
10. **RECALL**: Cuando el usuario pregunte sobre algo que pudo haberse discutido antes, usa \`memory_search\` primero.

### Flujo correcto de trabajo:
1. Piensa qué necesitas hacer
2. Lee el archivo relevante (1 tool call → espera resultado)
3. Aplica el cambio con el contenido REAL que leíste (1 tool call → espera resultado)
4. Repite para cada archivo
5. Al terminar, resume lo que hiciste

## Navegación UI

Puedes controlar la interfaz del editor con estos tags:
- \`<vibe-action type="set-view" value="preview" />\` — Muestra la vista previa
- \`<vibe-action type="set-view" value="editor" />\` — Muestra el editor
- \`<vibe-action type="set-view" value="split" />\` — Muestra código y preview
- \`<vibe-action type="open-file" value="ruta/al/archivo" />\` — Abre un archivo en el editor
- \`<vibe-action type="toggle-explorer" value="true" />\` — Abre el explorador de archivos`;

  if (projectSummary) {
    prompt += `\n\n## Contexto del Proyecto Actual\n\n${projectSummary}`;
  } else {
    prompt += `\n\n## Estado del Proyecto\nNo hay un proyecto abierto actualmente. Puedes ayudar con preguntas generales de programación, pero no podrás usar herramientas de archivos hasta que el usuario abra un proyecto.`;
  }

  // Inyectar memorias persistentes (auto-recall)
  const projectId = useProjectStore.getState().activeWorkspaceId;
  if (projectId) {
    try {
      const memories = await getRecentMemories(projectId, 5);
      if (memories.length > 0) {
        const formatted = memories.map((m) => {
          const age = Date.now() - m.createdAt;
          const days = Math.floor(age / (1000 * 60 * 60 * 24));
          const timeAgo = days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
          return `- [${m.type}] "${m.title}" (${timeAgo}): ${m.content.slice(0, 150)}${m.content.length > 150 ? "..." : ""}`;
        }).join("\n");

        prompt += `\n\n## Memoria del Proyecto\nRecuerdas estas observaciones de sesiones anteriores:\n${formatted}\n\nUsa \`memory_search\` para buscar más contexto si lo necesitas.`;
      }
    } catch {
      // Memory module not available, skip
    }
  }

  // Inyectar addon del modo activo (incluye chat mode)
  const activeMode = useChatStore.getState().activeMode;
  try {
    const { VIBE_MODES } = await import("@/modes");
    const mode = VIBE_MODES.find((m) => m.id === activeMode);
    if (mode?.systemPromptAddon) {
      prompt += `\n${mode.systemPromptAddon}`;
    }
  } catch {
    // Modes module not available, skip
  }

  return prompt;
}

/**
 * Genera la advertencia de contexto cuando la conversación está casi llena.
 * Uses estimated token counts for consistency with token-aware context management.
 */
export function buildContextWarning(
  currentTokenEstimate: number,
  maxTokenBudget: number = 32_000,
): string | null {
  const ratio = currentTokenEstimate / maxTokenBudget;
  if (ratio < 0.8) return null;

  const pct = Math.round(ratio * 100);
  return `\n\n⚠️ AVISO DEL SISTEMA: El contexto de esta conversación está al ${pct}% de capacidad. Sugiere sutilmente al usuario que inicie una "Nueva conversación" para mantener un buen rendimiento.`;
}
