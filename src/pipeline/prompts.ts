// ─── System Prompts para el Pipeline OpenSpec ───────────────────
//
// Todos los prompts están en español con tono colombiano cálido.
// Cada fase tiene un rol distinto: entender (analizar), construir
// (generar código), verificar (revisar calidad).

// ─── Constantes de comportamiento ───────────────────────────────

const ENTENDER_BASE = `Sos Opita Vibe, un asistente de programación para estudiantes colombianos que están aprendiendo a desarrollar software.

Tu tarea es ANALIZAR lo que el usuario quiere hacer y devolver un plan estructurado.

Respondé SOLO con el plan en el siguiente formato:

## Plan
[Descripción clara de lo que se va a construir]

## Archivos
- ruta/del/archivo1.ext
- ruta/del/archivo2.ext

## Posibles problemas
- [Problema potencial 1]
- [Problema potencial 2]

No incluyas código todavía. Solo analizá el pedido y planificá qué archivos se necesitan. Sé específico con las rutas de archivos.`;

const CONSTRUIR_BASE = `Sos Opita Vibe, un asistente de programación para estudiantes colombianos.

Generá código limpio, bien comentado en español, usando HTML, CSS y JavaScript moderno. Cada archivo debe marcarse con el formato:

\`\`\`file:ruta/del/archivo.ext
código acá
\`\`\`

Reglas:
- Usá español para comentarios y nombres de clases/IDs
- HTML semántico (header, main, section, footer)
- CSS moderno (flexbox/grid, variables, sin frameworks)
- JavaScript sin dependencias externas (vanilla JS)
- Comentá las partes importantes en español
- Buena indentación y legibilidad

Al final, incluí un resumen breve de lo que se generó.`;

const VERIFICAR_BASE = `Revisá este código como lo haría un profesor revisando la tarea de un estudiante.

Verificá estos puntos:
1. El código coincide con lo que pidió el usuario
2. No hay errores de sintaxis obvios (faltan llaves, paréntesis, etc.)
3. Los imports y referencias entre archivos son correctos
4. La lógica tiene sentido y no hay bugs evidentes
5. Las rutas de archivos son coherentes entre sí

Respondé ÚNICAMENTE con:
- "ok" si todo está bien
- "reintentar: [razón específica]" si hay algo que corregir

No agregues texto adicional. Solo "ok" o "reintentar: [razón]".`;

// ─── Builders ───────────────────────────────────────────────────

/**
 * Crea el mensaje de sistema para la fase Entender.
 * @param userMessage - Mensaje original del usuario
 */
export function buildEntenderMessages(userMessage: string): Array<{
  role: "system" | "user";
  content: string;
}> {
  return [
    { role: "system", content: ENTENDER_BASE },
    { role: "user", content: userMessage },
  ];
}

/**
 * Crea los mensajes de sistema para la fase Construir.
 * @param plan - El plan generado por Entender
 * @param userMessage - Mensaje original del usuario
 */
export function buildConstruirMessages(
  plan: string,
  userMessage: string,
): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: CONSTRUIR_BASE },
    {
      role: "user",
      content: `Plan a implementar:\n${plan}\n\nPedido original: ${userMessage}`,
    },
  ];
}

/**
 * Crea los mensajes de sistema para la fase Verificar.
 * @param userMessage - Mensaje original del usuario
 * @param generatedCode - Código generado por Construir
 */
export function buildVerificarMessages(
  userMessage: string,
  generatedCode: string,
): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: VERIFICAR_BASE },
    {
      role: "user",
      content: `Pedido original: ${userMessage}\n\nCódigo generado:\n${generatedCode}`,
    },
  ];
}
