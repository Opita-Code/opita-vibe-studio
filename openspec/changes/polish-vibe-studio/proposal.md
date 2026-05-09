# Proposal: Polish Vibe Studio

## Intent

Correct high-severity polish regressions found in exploration so Vibe Studio matches its brand, uses Colombian-neutral Spanish, and closes key accessibility gaps without changing features or architecture.

## Scope

### In Scope
- Align accent, hover, focus, and contrast styling with Vibe brand tokens; remove legacy VS Code blues.
- Replace Argentine voseo in prompts and UI copy with Colombian-neutral Spanish.
- Fix critical accessibility gaps: missing aria metadata, weak focus visibility, and key interactive labels.
- Remove low-risk debug noise, fix preview CSP for common assets, and correct Terminal dialog positioning.

### Out of Scope
- New shortcuts, new features, or visual redesign beyond targeted polish.
- Architecture changes, store refactors, or broad token-system expansion outside touched issues.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `brand-colors`: enforce indigo brand accents, working hover states, and accessible focus/contrast.
- `brand-copy`: require Colombian-neutral Spanish across prompts and UI text.
- `live-preview`: allow safe preview loading for common external images/fonts while keeping sandboxing.
- `code-editor`: add accessible tab and preview controls.
- `chat-assistant`: polish copy, labels, and focus treatment in chat surfaces.
- `terminal`: fix confirm-dialog anchoring and accessible terminal controls.
- `byok-config`: add accessible labels/actions and correct hover styling.
- `learning-layer`: align tip/banner branding and copy tone.

## Approach

Make a narrow UI polish pass over the affected components, reusing existing CSS vars and patterns. Prefer targeted copy/attribute/style fixes over structural edits, and keep every change backward-compatible.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/{chat,layout,editor,settings,terminal,learning}` | Modified | Copy, aria, focus, hover, and brand-color fixes |
| `src/components/preview/LivePreview.tsx` | Modified | Preview CSP adjustment and lint cleanup |
| `src/pipeline/prompts.ts` | Modified | Neutralize system-prompt Spanish |
| `src/providers/*.ts` | Modified | Remove production debug logs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CSP relaxation weakens preview isolation | Med | Limit to preview iframe asset needs only; keep sandbox and no app-level CSP changes |
| A11y polish changes UI behavior subtly | Low | Constrain changes to labels, roles, focus, and visual tokens |

## Rollback Plan

Revert the touched component, prompt, and provider files for this change set; no data migration or persisted-state change is involved.

## Dependencies

- Engram exploration artifact `sdd/polish-vibe-studio/explore`

## Success Criteria

- [ ] No legacy VS Code blue or broken CSS-var hover patterns remain in targeted surfaces.
- [ ] User-facing prompts/UI use Colombian-neutral Spanish in touched areas.
- [ ] Critical interactive controls in scoped components expose aria metadata and visible focus states.
- [ ] Preview loads common images/fonts safely, debug logs are removed, and no backward-incompatible behavior is introduced.
