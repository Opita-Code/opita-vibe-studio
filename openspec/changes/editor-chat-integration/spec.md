# Spec: Editor-Chat Integration Architecture Polish

## S1: DeepSeek & Gemini Model Registry & Plan Locks

### S1.1: Model Catalog Expansion
- **GIVEN** the model registry is loaded
- **WHEN** listing the models for DeepSeek and Gemini
- **THEN** it MUST include `deepseek-v4-flash`, `deepseek-v4-pro`, `deepseek-reasoner` under DeepSeek
- **AND** it MUST include `gemini-2.5-flash` and `gemini-2.5-pro` under Gemini.

### S1.2: Dropdown Selection and Locking by Tier
- **GIVEN** a user with plan tier $T$ looking at the model selector dropdown
- **WHEN** rendering the models:
  - `gemini-2.5-flash`: Requires Tier 0 (everyone)
  - `deepseek-v4-flash`: Requires Tier 1 (Estudiante+)
  - `deepseek-v4-pro`, `gemini-2.5-pro`, `deepseek-reasoner`: Requires Tier 2 (Pro)
- **THEN** models above the user's tier $T$ MUST be rendered with a lock icon.
- **AND** clicking a locked model MUST NOT activate the model but MUST trigger checkout intents `estudiante_model` or `pro_model` based on the required tier.

### S1.3: Frontend V4 Routing for Subagents
- **GIVEN** a Pro plan user running a high-cognitive SDD phase (`sdd-explore`, `sdd-propose`, `sdd-design`, `sdd-verify`)
- **WHEN** the frontend model router `selectModel` is invoked
- **THEN** it MUST select `"deepseek-v4-pro"` as the `modelId`
- **AND** it MUST NOT assign `"deepseek-reasoner"`.

### S1.4: Frontend V4 Routing for Chat
- **GIVEN** a user running a general conversation or a non-cognitive subagent phase
- **WHEN** the model router `selectModel` is invoked and the provider is DeepSeek
- **THEN** it MUST select `"deepseek-v4-flash"` as the `modelId`.

### S1.5: Backend Model Support
- **GIVEN** the backend receives a request with `modelId` set to `"deepseek-v4-pro"` or `"deepseek-v4-flash"`
- **WHEN** `getModel()` is invoked in the backend
- **THEN** it MUST instantiate the client using that exact model ID without renaming or mapping to legacy endpoints.

### S1.6: Backend R1 Tool-Calling Protection
- **GIVEN** a request with `modelId` set to `"deepseek-reasoner"` (DeepSeek R1)
- **WHEN** the request contains non-empty `tools` definitions (meaning a ReAct loop is active)
- **THEN** the backend MUST swap the model to `"deepseek-v4-pro"` (or `"deepseek-chat"`) before calling `streamText`
- **AND** it MUST NOT crash the connection with an HTTP 400 error.

### S1.7: Reciprocal Fallback
- **GIVEN** the primary provider is DeepSeek and the API request fails (e.g. rate limit, auth, or network)
- **WHEN** the backend processes the error and Gemini is configured on the backend
- **THEN** it MUST transparently fallback to `"gemini-2.5-flash"`
- **AND** it MUST write a brief notification line to the response stream indicating the fallback.

---

## S2: Editor AI Quick Actions

### S2.1: Toolbar UI Buttons
- **GIVEN** an active file is open in the editor (`projectStore.activeTab` is not null)
- **WHEN** the `EditorToolbar` is rendered
- **THEN** it MUST display four action buttons: **Explicar**, **Optimizar**, **Fix**, and **Tests**
- **AND** these buttons MUST have distinct icons and tooltips.

### S2.2: Chat Activation and Prompt Injection
- **GIVEN** an active file open in the editor
- **WHEN** the user clicks any AI Quick Action in the toolbar
- **THEN** it MUST ensure the chat panel is visible (expand if collapsed)
- **AND** it MUST programmatically submit a prompt with the active file's code attached
- **AND** the prompt templates MUST correspond to the action clicked:
  - **Explicar**: `"Explica detalladamente la estructura y lógica de este código."`
  - **Optimizar**: `"Optimiza este código analizando complejidad y rendimiento."`
  - **Fix**: `"Encuentra y corrige bugs o malas prácticas en este código."`
  - **Tests**: `"Escribe pruebas unitarias completas para este código usando vitest."`

---

## S3: Active File Context Sharing

### S3.1: Context Indicator UI
- **GIVEN** a project is open and a file is active in the editor
- **WHEN** the chat input panel is rendered
- **THEN** it MUST display a context indicator above the text area: `📎 Contexto activo: [filename]`
- **AND** it MUST display a toggle switch to enable or disable sharing the active file context.

### S3.2: Full Code Context Injection
- **GIVEN** a user writes a chat message and the context toggle is enabled
- **WHEN** the user clicks send or presses Enter
- **THEN** the frontend MUST append the active file's complete content to the conversation context
- **AND** it MUST bypass the 300-line exclusion limit of the default `getProjectSummary` helper.

### S3.3: Large File Safeguard
- **GIVEN** the active file size exceeds 1500 lines of code
- **WHEN** the file is opened or selected
- **THEN** the context toggle SHOULD automatically switch to disabled
- **AND** it SHOULD display a warning badge explaining that sharing the file could consume too many tokens.
