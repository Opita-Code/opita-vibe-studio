# Design: vibe-visual-identity

## Architecture
This change implements the "Glass & Glow" UI paradigm using standard CSS and Tailwind CSS classes, without introducing heavy new component libraries.

## Changes by Module

### 1. Typography & Global CSS (`index.html` & `index.css`)
- **Google Fonts**: Import `Outfit` (or `Inter`) and `JetBrains Mono` in `index.html`.
- **CSS Variables (`index.css`)**:
  - Define glowing gradient or blob backgrounds on the `body` or a root `#app` wrapper. 
  - Example background:
    ```css
    body {
      background-color: #0f172a; /* tailwind slate-900 */
      background-image: 
        radial-gradient(circle at 15% 50%, rgba(168, 85, 247, 0.15), transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.15), transparent 25%);
      color: #f8fafc;
    }
    ```

### 2. Tailwind Configuration (`tailwind.config.js`)
- **Theme Extension**:
  - Set `fontFamily.sans` to `['Outfit', 'sans-serif']`.
  - Set `fontFamily.mono` to `['JetBrains Mono', 'monospace']`.
  - Ensure `backdropBlur` utilities are available (default in Tailwind v3+).

### 3. Application Shell (`src/components/DesktopShell.tsx` or equivalent root layout)
- **Glassmorphism**:
  - Replace solid background colors on structural panels (sidebar, header, bottom bar) with translucent ones.
  - Example classes: `bg-slate-900/60 backdrop-blur-md border-r border-white/10`.
  - Ensure the main editor space remains high-contrast for code readability (often `#1e1e1e` or `slate-950`).

## Data Models
- No changes to data structures. Visual layer only.

## Assets
- The newly generated `vibe_studio_logo_concept_*.png` will serve as the reference for the `app-icon` replacement.

## Test Strategy
- Visually verify the application in the browser (`npm run dev`) to ensure the typography loads, the gradients appear, and the glassmorphism does not severely impact rendering performance (no lag when resizing panels).
