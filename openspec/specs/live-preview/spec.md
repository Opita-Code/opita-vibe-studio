# Live Preview Specification

## Purpose

Real-time component preview using Sandpack (CodeSandbox runtime). Renders user-generated React components in an isolated iframe with dark-mode styling.

## Architecture

- **VibeSandpackOverlay**: `src/components/preview/VibeSandpackOverlay.tsx` — Dark cover overlay that hides white flash during Vite initialization. Shows "Show Preview" button until user interacts.
- **VibeEnginePreview**: `src/components/preview/VibeEnginePreview.tsx` — Sandpack wrapper component
- **EmptyPreviewState**: `src/components/preview/EmptyPreviewState.tsx` — Shown when no preview target is set
- **LivePreview**: `src/components/preview/LivePreview.tsx` — Legacy iframe preview
- **Extension**: `src/extensions/vibe-preview/index.ts` — Registers preview view in EditorSlot

## Requirements

### Requirement: Dark Mode Cover

The preview iframe MUST be covered with a dark overlay (`#020617`) during initialization to prevent white flash. The cover is removed when the user clicks "Show Preview" or performs their first code edit.

#### Scenario: Initial preview load

- GIVEN a component is set as preview target
- WHEN the Sandpack runtime initializes
- THEN a dark cover hides the iframe
- AND the cover shows the Vibe Studio logo and "Show Preview" button

### Requirement: Empty State

When no preview target is set, the preview area shows an empty state with guidance text.

### Requirement: Sandpack Integration

The preview uses `@codesandbox/sandpack-react` to create a real browser environment. Generated files from the AI pipeline are injected into Sandpack's virtual file system.

## Files

- `src/components/preview/VibeSandpackOverlay.tsx`
- `src/components/preview/VibeEnginePreview.tsx`
- `src/components/preview/EmptyPreviewState.tsx`
- `src/components/preview/LivePreview.tsx`
- `src/extensions/vibe-preview/index.ts`
