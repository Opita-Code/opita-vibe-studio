# SDD Proposal: Chat UX para Usuarios No-Code + Sistema de Personas

## Resumen

Rediseñar la experiencia de chat de Vibe Studio para que sea comprensible y útil para usuarios no-code/low-code, implementando dos mejoras principales:

1. **Message Sections Model** — Separar las respuestas del agente en secciones visuales distintas (thinking, texto, código, pasos) en vez de una pared de texto continua.
2. **Sistema de Personas** — Permitir al usuario elegir el perfil de comunicación de Aura (Neutral, Senior Engineer, Estudiante, Custom) que ajusta tono, detalle técnico, y formato de respuesta.

---

## Cambio 1: Message Sections Model

### Problema
Actualmente `MessageBubble.tsx` (504 líneas) es un god component que mete TODO en una sola burbuja. El usuario no-code ve:
- Razonamiento interno mezclado con la respuesta
- Tool calls como `[tool_call: read_file]` en el texto (arreglado parcialmente)
- Code blocks sin contexto de por qué están ahí
- Pasos de ejecución dentro del texto corrido

### Solución

Agregar `sections: MessageSection[]` al tipo `Message`. Cada sección tiene un tipo y se renderiza de forma independiente:

```typescript
interface MessageSection {
  id: string;
  type: "thinking" | "text" | "code" | "steps" | "summary" | "notice";
  content: string;
  /** Para tipo "code" */
  language?: string;
  /** Si la sección empieza colapsada */
  collapsed?: boolean;
  /** Metadata adicional */
  meta?: Record<string, unknown>;
}
```

### Rendering por sección

| Tipo | Visual | Comportamiento |
|---|---|---|
| `thinking` | Chip colapsable arriba de la burbuja, icono 🧠 | Colapsado por defecto. Label: "Analizó 3 archivos" |
| `text` | Markdown normal (actual) | Sin cambios |
| `code` | Code block con Apply/Copy (actual `ApplyCodeBlock`) | Sin cambios |
| `steps` | Roadmap inline (actual `InlineSteps`) | Sin cambios |
| `summary` | Card resumen al final con archivos tocados | Solo cuando hay file changes |
| `notice` | Banner informativo (ej. fallback de proveedor) | Auto-dismiss después de 10s |

### Backward Compatibility
- Si `message.sections` está vacío/undefined, se renderiza el `message.content` como ahora (legacy path)
- Migración gradual: el `useAgentHandler` empieza a poblar sections, el content sigue existiendo como fallback

---

## Cambio 2: Sistema de Personas

### Concepto

Las "personas" son **presets de comunicación** que modifican:
1. **Tono** del system prompt (cómo habla Aura)
2. **Nivel de detalle técnico** (qué explica y qué omite)
3. **Formato de respuesta** (secciones colapsadas por defecto, labels, etc.)

### Personas disponibles

| Persona | Tier | Comportamiento |
|---|---|---|
| **Estudiante** 🎓 | Free | Explica paso a paso, usa analogías, incluye "por qué" en cada decisión, sugiere recursos de aprendizaje |
| **Creador** ✨ | Free (default) | El Aura actual: directo, conciso, ejecuta sin exceso de explicación |
| **Ingeniero Senior** 🔧 | Pro | Usa terminología técnica, discute tradeoffs, menciona patrones de diseño, cita convenciones |
| **Neutral** ⚡ | Pro | Sin personalidad — respuestas mínimas, solo código y resultado |
| **Custom** ✏️ | Pro | El usuario define su propio prompt de comunicación |

### Implementación

La persona se inyecta como un addon al system prompt, ANTES de los mode addons:

```
AURA_SYSTEM_PROMPT (base)
  → PERSONA_ADDON (tono + nivel)
    → MODE_ADDON (chat/build/explore)
      → TDD_ADDON (conditional)
        → PROJECT_CONTEXT
          → CUSTOM_INSTRUCTIONS
```

### Prompt Addons por Persona

**Estudiante:**
```
## Tu audiencia: Estudiante
- Explica el "por qué" antes del "cómo" — el usuario quiere APRENDER
- Usa analogías del mundo real (cocina, construcción, organización)
- Cuando escribas código, agrega comentarios explicativos en cada bloque
- Al final de una tarea, incluye un "💡 Dato extra" con un concepto relacionado
- Si el usuario comete un error conceptual, corrígelo amablemente con un ejemplo
```

**Ingeniero Senior:**
```
## Tu audiencia: Ingeniero de Software
- Usa terminología técnica sin simplificar (DI, SOLID, race condition, etc.)
- Discute tradeoffs cuando propongas soluciones
- Menciona patrones de diseño relevantes (Strategy, Observer, etc.)
- Incluye consideraciones de performance y escalabilidad
- No expliques conceptos básicos a menos que te lo pidan
```

**Neutral:**
```
## Tu estilo: Neutral
- Respuestas mínimas — solo código y resultado
- Sin analogías, sin emojis, sin personalidad
- Si algo requiere explicación, una línea máximo
- Formato: resultado directo, sin preámbulos
```

### UX en la interfaz

- **Selector de persona**: En el sidebar de Settings > Personalización
- **Quick switch**: En el footer del chat panel, junto al selector de modelo
- **Persistencia**: Guardado en `settingsStore` con `persona: PersonaId`
- **Visual**: La burbuja de Aura muestra un mini badge con la persona activa (🎓/✨/🔧/⚡)

---

## Archivos afectados

### Message Sections
| Archivo | Cambio |
|---|---|
| `src/lib/types.ts` | Agregar `MessageSection` type y `sections?: MessageSection[]` a `Message` |
| `src/components/chat/MessageBubble.tsx` | Decompose: extraer `SectionRenderer`, `ThinkingChip`, `NoticeBar` |
| `src/agent/useAgentHandler.ts` | Acumular events como sections en vez de concat a content |
| `src/stores/chat.ts` | `appendSection()` action |

### Personas
| Archivo | Cambio |
|---|---|
| `src/agent/prompts.ts` | Agregar `PERSONA_ADDONS` y modificar `getSystemPrompt()` |
| `src/stores/settings.ts` | Agregar `persona: PersonaId` |
| `src/components/chat/PersonaSelector.tsx` | [NEW] Quick-switch en el footer del chat |
| `src/components/settings/PersonaSettings.tsx` | [NEW] Full settings panel |

---

## Verificación

1. **E2E existentes** — Los 32+ smoke tests deben seguir pasando (no rompen el chat API)
2. **Unit tests** — `prompts.test.ts` extender con persona injection tests
3. **Visual** — Verificar en producción que las secciones se renderizan correctamente
4. **Backward compat** — Mensajes sin `sections` se renderizan como antes

---

## Riesgos

1. **Streaming + sections**: Necesita cuidado — las secciones se acumulan durante streaming, no se puede re-renderizar todo el array en cada chunk
2. **Persona prompt inflation**: Los addons de persona agregan ~200-400 tokens al prompt. Monitorear el context window
3. **Custom persona abuse**: Usuarios Pro podrían inyectar prompts maliciosos → el AURA security block lo previene
