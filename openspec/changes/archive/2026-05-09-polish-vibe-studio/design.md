# Design: Polish Vibe Studio

## Technical Approach

Apply a narrow polish pass on existing React/Tailwind components without changing stores, provider contracts, or pipeline flow. Fixes stay local: replace legacy blue classes with brand-token usage, neutralize Rioplatense copy in touched UX strings/prompts, add missing accessible names, remove provider debug logs, and relax preview iframe CSP only enough for common remote assets.

## Architecture Decisions

| Decision           | Choice                                                                                                                                                                                                                                                        | Alternatives considered                                                       | Rationale                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Color fix pattern  | Replace `bg-[#007acc]`/`bg-[#1e4d8c]` with vibe tokens; for `hover:bg-[var(--vibe-indigo)]/80`, use inline `style={{ backgroundColor: 'var(--vibe-indigo)' }}` plus opacity/filter/state classes on the element instead of Tailwind arbitrary opacity syntax. | Add new Tailwind config color alias.                                          | Fastest safe fix in Tailwind 3.4 because `bg-[var(...)]/80` is brittle; avoids config churn for a small polish change.                                                                                                                                                               |
| Copy normalization | Update prompts/UI strings to Colombian-neutral Spanish only in touched surfaces.                                                                                                                                                                              | Global copy rewrite.                                                          | Keeps scope tight and matches proposal. Verified voseo exists in `src/pipeline/prompts.ts`, `src/components/terminal/TerminalPanel.tsx`, `src/components/chat/ChatInput.tsx`, `src/components/chat/MessageList.tsx`, `src/components/settings/ByokPanel.tsx`, and `src/lib/tips.ts`. |
| A11y labels        | Add explicit accessible names to icon-only and context-light controls; keep visible text unchanged.                                                                                                                                                           | Structural refactors with new wrappers.                                       | Minimal-risk improvement that satisfies current component patterns.                                                                                                                                                                                                                  |
| Provider logging   | Remove production `console.log` token telemetry from provider chat implementations.                                                                                                                                                                           | Gate logs behind env flag.                                                    | Proposal asks for debug-noise removal; no consumer depends on these logs.                                                                                                                                                                                                            |
| Preview CSP        | Expand iframe `srcdoc` CSP to allow common remote assets (`img-src`, likely `font-src`, `connect-src` if needed) while keeping `sandbox="allow-scripts"` and no app-level CSP change.                                                                         | Keep current `default-src 'none'`; allow broader preview sandbox permissions. | Fixes broken preview assets without weakening host-app isolation.                                                                                                                                                                                                                    |

## Data Flow

User/UI action → existing component handler → local prop/store update → render with corrected token/copy/aria.

AI chat flow remains unchanged:

`prompt builder -> provider.chat() -> stream parser -> UI`

Preview flow change is isolated:

`Editor content -> buildSrcdoc() -> iframe CSP/meta -> remote assets load inside sandbox`

## File Changes

| File                                                                                   | Action | Description                                                                                                                |
| -------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/components/layout/Sidebar.tsx`                                                    | Modify | Replace legacy CTA blue; add aria-label to icon-only open-folder button.                                                   |
| `src/components/chat/ChatInput.tsx`                                                    | Modify | Replace legacy blue/focus ring; neutralize placeholder copy.                                                               |
| `src/components/chat/MessageBubble.tsx`                                                | Modify | Replace user bubble blue with vibe token.                                                                                  |
| `src/components/editor/FileTabs.tsx`                                                   | Modify | Convert close glyph span to button with aria-label using filename/path.                                                    |
| `src/components/layout/EditorPanel.tsx`                                                | Modify | Add aria-labels to preview toggle/reload buttons.                                                                          |
| `src/components/terminal/TerminalPanel.tsx`                                            | Modify | Neutralize helper/placeholder copy, add aria-labels to toolbar/actions, keep dangerous dialog anchored to panel container. |
| `src/components/settings/ByokPanel.tsx`                                                | Modify | Fix hover color pattern, add ids/htmlFor or aria-labels for select/inputs and row action buttons.                          |
| `src/components/preview/LivePreview.tsx`                                               | Modify | Relax iframe CSP for common external assets only.                                                                          |
| `src/pipeline/prompts.ts`                                                              | Modify | Replace `Sos/Respondé/Generá/Usá/Revisá` style voseo with neutral Spanish.                                                 |
| `src/providers/{deepseek,openai,gemini,custom,openrouter}.ts`                          | Modify | Remove `console.log` token telemetry.                                                                                      |
| `tests/components/{chat/ChatInput.test.tsx,TerminalPanel.test.tsx,chat/a11y.test.tsx}` | Modify | Update copy/placeholder assertions and any new aria queries.                                                               |
| `tests/pipeline/pipeline.test.ts`                                                      | Modify | Update assertions that inspect prompt wording (`Revisá` etc.) if prompt normalization changes them.                        |

## Interfaces / Contracts

No new interfaces. Existing component props, Zustand stores, provider APIs, and pipeline message formats remain unchanged.

## Testing Strategy

| Layer       | What to Test                               | Approach                                                                                            |
| ----------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Unit        | Prompt builders and provider behavior      | Keep provider stream tests; update prompt-string expectations in `tests/pipeline/pipeline.test.ts`. |
| Integration | Accessible names and normalized copy in UI | Update RTL tests for `ChatInput`, `TerminalPanel`, `FileTabs`/a11y surfaces.                        |
| E2E         | N/A                                        | No e2e layer in repo.                                                                               |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Confirm the exact neutral replacements for student-facing copy in `ChatInput`, `TerminalPanel`, and tips so tests lock the final wording once.
