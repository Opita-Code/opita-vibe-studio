# Tasks: Chat UX para Usuarios No-Code + Sistema de Personas

## Review Workload Forecast
- **Estimated changed lines**: ~750 across 3 PRs
- **400-line budget risk**: Low (each PR < 300 lines)
- **Chained PRs recommended**: Yes (3 PRs)
- **Decision needed before apply**: No (auto-chain cached)

---

## PR 1: Message Sections Foundation (~300 lines)

### T1.1: MessageSection type definition
- **File**: `src/lib/types.ts`
- **Action**: Add `MessageSection` interface and `PersonaId` type
- **Details**:
  - `MessageSection { id, type, content, language?, collapsed?, label?, meta? }`
  - `sections?: MessageSection[]` on `Message` interface
  - `PersonaId = "student" | "creator" | "senior" | "neutral" | "custom"`
  - `PersonaConfig { id, label, icon, tier, description }`
- **Spec**: S1.2 (backward compat — sections is optional)

### T1.2: Chat store — appendSection action
- **File**: `src/stores/chat.ts`
- **Action**: Add `appendSection(messageId, section)` and `appendToSection(messageId, sectionId, content)` actions
- **Details**:
  - `appendSection`: pushes new section to message.sections[]
  - `appendToSection`: appends content string to existing section
  - Both create `sections: []` if undefined (lazy init)
- **Spec**: S1.6 (streaming accumulation)

### T1.3: ThinkingChip component
- **File**: `src/components/chat/ThinkingChip.tsx` [NEW]
- **Action**: Create collapsible thinking indicator
- **Details**:
  - Props: `{ content: string; label?: string; defaultCollapsed?: boolean }`
  - Collapsed state: shows chip with icon 🧠 + label
  - Expanded: shows thinking content in muted, italic text
  - Animation: framer-motion for expand/collapse
  - Auto-generate label if not provided: count file references in content
- **Spec**: S1.3 (collapsed by default, executive label)

### T1.4: NoticeSection component
- **File**: `src/components/chat/NoticeSection.tsx` [NEW]
- **Action**: Create inline notice banner
- **Details**:
  - Props: `{ content: string; autoDismissMs?: number }`
  - Visual: info banner with ℹ️ icon, subtle bg
  - Auto-collapse after autoDismissMs (default 10000)
  - Stays visible but minimized (one-line) after dismiss
- **Spec**: S1.5 (auto-dismiss)

### T1.5: SectionRenderer component
- **File**: `src/components/chat/SectionRenderer.tsx` [NEW]
- **Action**: Switch component that delegates to section-specific renderers
- **Details**:
  - Switch on `section.type`
  - `thinking` → ThinkingChip
  - `text` → existing ReactMarkdown block (extracted)
  - `code` → existing ApplyCodeBlock
  - `steps` → existing InlineSteps
  - `summary` → existing FileChangeSummary
  - `notice` → NoticeSection
- **Spec**: S1.1 (sections render independently)

### T1.6: MessageBubble refactor
- **File**: `src/components/chat/MessageBubble.tsx`
- **Action**: Decompose — use SectionRenderer when sections exist, legacy path otherwise
- **Details**:
  - If `message.sections?.length > 0`: render via SectionRenderer loop
  - Else: render `message.content` as before (legacy path)
  - Extract ReactMarkdown block into reusable function
  - Remove god-component patterns — delegate to sub-components
  - Keep AgentExecutionHeader, PendingMessageActions as-is
- **Spec**: S1.1, S1.2, S1.4

---

## PR 2: Agent Handler Sections (~200 lines)

### T2.1: useAgentHandler sections accumulation
- **File**: `src/agent/useAgentHandler.ts`
- **Action**: Modify streaming handler to create sections instead of concatenating content
- **Details**:
  - Track `currentSectionType` and `currentSectionId`
  - On `text` chunk: if currentType === "text" → appendToSection, else create new text section
  - On `thinking_visible` chunk: create/append thinking section
  - On `step` event: existing behavior (handled by agentExecution)
  - On `error` event: create notice section with error content
  - ALSO still set `message.content` for backward compat (concat all text sections)
- **Spec**: S1.6, S1.4

### T2.2: Notice injection for fallback
- **File**: `src/agent/useAgentHandler.ts`
- **Action**: When receiving a fallback notice from backend (ℹ️ prefix), create notice section
- **Details**:
  - Detect content starting with `> ℹ️` (the fallback notice format)
  - Create section type "notice" instead of "text"
  - Strip the notice from the main text content
- **Spec**: S1.5

---

## PR 3: Persona System (~250 lines)

### T3.1: Persona addons in prompts.ts
- **File**: `src/agent/prompts.ts`
- **Action**: Add PERSONA_ADDONS constant and inject in getSystemPrompt
- **Details**:
  - Define 4 persona addons (student, senior, neutral, creator=no addon)
  - Modify `PromptConfig` to include `persona?: PersonaId`
  - Modify `getSystemPrompt` to inject persona addon after AURA_BASE
  - Add `customPersonaPrompt?: string` to PromptConfig for custom persona
- **Spec**: S2.1, S2.2

### T3.2: Settings store — persona state
- **File**: `src/stores/settings.ts`
- **Action**: Add persona field with persistence
- **Details**:
  - `persona: PersonaId` (default: "creator")
  - `customPersonaPrompt: string` (default: "")
  - Persisted via localStorage (existing pattern)
  - `setPersona(id: PersonaId)` action
  - `setCustomPersonaPrompt(prompt: string)` action with 500 char limit
- **Spec**: S2.3, S2.5

### T3.3: PersonaSelector component
- **File**: `src/components/chat/PersonaSelector.tsx` [NEW]
- **Action**: Create dropdown persona switcher
- **Details**:
  - Trigger: small badge in chat footer showing current persona icon
  - Dropdown: 5 options with icon, label, tier badge
  - Pro options: show lock icon + "Pro" badge for free users
  - Custom: shows textarea (max 500 chars) inline in dropdown
  - Integration: read/write settingsStore.persona
- **Spec**: S2.4, S2.7

### T3.4: Wire persona into agent pipeline
- **File**: `src/agent/useAgentHandler.ts` + `src/agent/orchestrator.ts`
- **Action**: Read persona from settingsStore and pass to getSystemPrompt
- **Details**:
  - useAgentHandler reads `settingsStore.persona` at stream start
  - Passes to orchestrator config → agent config → getSystemPrompt
  - For custom persona, also passes `settingsStore.customPersonaPrompt`
- **Spec**: S2.2, S2.6

### T3.5: Persona unit tests
- **File**: `src/agent/__tests__/prompts.test.ts`
- **Action**: Extend with persona injection tests
- **Details**:
  - Test each persona addon is injected correctly
  - Test prompt order (AURA → PERSONA → MODE → etc.)
  - Test custom persona respects 500 char limit
  - Test "creator" persona adds no extra addon
- **Spec**: S2.1, S2.2, S2.5

---

## Dependency Graph

```
T1.1 (types) ──┬── T1.2 (store actions)
               ├── T1.3 (ThinkingChip)
               ├── T1.4 (NoticeSection)
               └── T1.5 (SectionRenderer) ── T1.6 (MessageBubble refactor)

T1.2 + T1.5 ── T2.1 (handler sections) ── T2.2 (notice injection)

T3.1 (prompts) ── T3.2 (settings) ── T3.3 (PersonaSelector)
                                    └── T3.4 (wire pipeline)
T3.1 ── T3.5 (tests)
```
