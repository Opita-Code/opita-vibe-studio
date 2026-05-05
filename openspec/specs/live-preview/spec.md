# Delta for Live Preview

## ADDED Requirements

### Requirement: Sandboxed Iframe Rendering

The live preview pane MUST render the project's entry HTML file inside a sandboxed iframe. The iframe SHALL use `sandbox="allow-scripts"` WITHOUT `allow-same-origin`. A strict Content Security Policy (CSP) MUST block: inline scripts (`script-src 'self'`), network requests to external domains, and filesystem access.

#### Scenario: Project renders in sandboxed preview

- GIVEN a project has `index.html`, `styles.css`, and `script.js`
- WHEN the preview pane loads
- THEN `index.html` renders inside the sandboxed iframe
- AND linked CSS/JS files are loaded from the local project files
- AND any `fetch()` call to an external URL is blocked by CSP

#### Scenario: Sandbox escape attempt is blocked

- GIVEN AI-generated code contains `<script>window.parent.document</script>`
- WHEN the preview renders this code
- THEN the script runs in the sandboxed context only
- AND access to the parent window (Tauri WebView) is denied by browser sandbox

### Requirement: Reload on Save

The preview iframe MUST reload automatically within 500ms of any project file being saved. A manual reload button SHALL also be available.

#### Scenario: Preview updates after file save

- GIVEN the preview is showing `index.html`
- WHEN the user edits and saves `styles.css` in the editor
- THEN the preview iframe reloads and reflects the new styles
- AND a subtle "Actualizado" indicator flashes momentarily

### Requirement: Error Display

When the previewed HTML/CSS/JS causes a runtime error, the system SHOULD capture the error via `window.onerror` (postMessage bridge) and display it in a non-blocking error bar above the preview. Errors MUST NOT crash the app.

#### Scenario: JavaScript error shown in preview

- GIVEN the project's `script.js` has a syntax error
- WHEN the preview loads
- THEN an error bar appears showing: "Error en script.js línea 5: Unexpected token"
- AND the preview frame does not crash or go blank
