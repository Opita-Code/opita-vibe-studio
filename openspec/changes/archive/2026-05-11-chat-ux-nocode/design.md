# Design: Chat UX para Usuarios No-Code + Sistema de Personas

## Arquitectura de Datos

### MessageSection type

```typescript
// src/lib/types.ts

interface MessageSection {
  id: string;
  type: "thinking" | "text" | "code" | "steps" | "summary" | "notice";
  content: string;
  language?: string;      // para type: "code"
  collapsed?: boolean;    // thinking empieza true
  label?: string;         // "Analizó 3 archivos", "💡 Dato extra"
  meta?: Record<string, unknown>;
}

// Extensión a Message (ya existente)
interface Message {
  // ... campos existentes ...
  sections?: MessageSection[];  // nuevo, optional para backward compat
}
```

### PersonaId type

```typescript
// src/lib/types.ts

type PersonaId = "student" | "creator" | "senior" | "neutral" | "custom";

interface PersonaConfig {
  id: PersonaId;
  label: string;
  icon: string;
  tier: "free" | "pro";
  description: string;
}
```

---

## Component Architecture

### Decomposición de MessageBubble

```
MessageBubble.tsx (orquestador, ~80 líneas)
├── SectionRenderer.tsx (switch por section.type)
│   ├── ThinkingChip.tsx        → chip colapsable, label ejecutivo
│   ├── TextSection.tsx         → ReactMarkdown (extraído del actual)
│   ├── CodeSection.tsx         → ApplyCodeBlock wrapper
│   ├── StepsSection.tsx        → InlineSteps (existente)
│   ├── SummarySection.tsx      → FileChangeSummary (existente)
│   └── NoticeSection.tsx       → banner informativo animado
├── AgentExecutionHeader.tsx    → (existente, sin cambios)
└── PendingMessageActions.tsx   → (existente, sin cambios)
```

### PersonaSelector component

```
PersonaSelector.tsx
├── Trigger: badge en footer del chat (junto a modelo)
├── Dropdown: 5 opciones con icon + label + tier badge
├── Pro gate: opciones Pro muestran lock icon para Free users
└── Custom textarea: solo visible cuando persona === "custom"
```

---

## State Flow

### Sections accumulation (streaming)

```
AgentEvent (from build-agent.ts)
  → useAgentHandler.ts
    → chatStore.appendSection(messageId, section)
      → MessageBubble re-renders specific section
```

**Regla clave**: El handler mantiene un `currentSectionType` state. Cuando llega un chunk:
- Si el tipo es igual al currentSectionType → append al content de la sección actual
- Si el tipo es diferente → crear nueva sección, actualizar currentSectionType

```typescript
// useAgentHandler.ts — pseudo-lógica
let currentSectionId: string | null = null;
let currentSectionType: string | null = null;

function handleChunk(event: AgentEvent) {
  if (event.type === "text") {
    if (currentSectionType === "text") {
      chatStore.appendToSection(msgId, currentSectionId, event.content);
    } else {
      currentSectionId = crypto.randomUUID();
      currentSectionType = "text";
      chatStore.appendSection(msgId, {
        id: currentSectionId,
        type: "text",
        content: event.content,
      });
    }
  }
  // Similar for thinking_visible, etc.
}
```

### Persona injection

```
settingsStore.persona → "student"
  → useAgentHandler reads persona at stream start
    → passes to getSystemPrompt({ ..., persona: "student" })
      → prompts.ts composes: AURA_BASE + STUDENT_ADDON + MODE_ADDON + ...
```

---

## Prompt Composition Chain

```
getSystemPrompt(config):
  1. AURA_SYSTEM_PROMPT          (identity, security)
  2. PERSONA_ADDONS[persona]     (tone, detail level) ← NEW
  3. MODE_ADDON                  (chat/build/explore)
  4. TDD_ADDON                   (if applicable)
  5. PROJECT_CONTEXT             (if available)
  6. CUSTOM_INSTRUCTIONS         (if provided, separate from persona)
```

La persona "Custom" usa el campo `customPersonaPrompt` del settingsStore como su addon,
DIFERENTE de `customInstructions` (que son las instrucciones del proyecto, no de comunicación).

---

## Delivery Strategy: auto-chain

### PR 1: Message Sections Foundation (~300 lines)
- `src/lib/types.ts` — MessageSection type
- `src/stores/chat.ts` — appendSection action
- `src/components/chat/MessageBubble.tsx` — section rendering (with legacy fallback)
- `src/components/chat/ThinkingChip.tsx` — [NEW]
- `src/components/chat/NoticeSection.tsx` — [NEW]

### PR 2: Agent Handler Sections (~200 lines)  
- `src/agent/useAgentHandler.ts` — accumulate as sections
- Update streaming logic to create sections instead of concat

### PR 3: Persona System (~250 lines)
- `src/agent/prompts.ts` — persona addons + getSystemPrompt modification
- `src/stores/settings.ts` — persona state
- `src/components/chat/PersonaSelector.tsx` — [NEW]
- `src/agent/prompts.test.ts` — extend with persona tests

---

## Testing Strategy

| What | How |
|---|---|
| Section rendering | Unit: SectionRenderer with each type |
| Legacy compat | Unit: MessageBubble with message without sections |
| Persona prompt | Unit: getSystemPrompt with each persona |
| Pro gate | Unit: PersonaSelector denies Pro personas to Free |
| E2E | Existing 32 smoke tests (no backend changes) |
