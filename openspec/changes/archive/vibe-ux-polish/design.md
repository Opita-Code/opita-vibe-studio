# Design: vibe-ux-polish

## Architecture
We will implement a lightweight, SPA-friendly router at the root level to manage navigation between the Landing Page and the IDE Shell without requiring external libraries like `react-router-dom`.

## Changes by Module

### 1. `src/Root.tsx` (New)
- Create a `Root` component that listens to the `popstate` event.
- Manage a `currentPath` state.
- Render `<LandingPage />` if `currentPath === '/'`, otherwise render `<App />`.

### 2. `src/main.tsx`
- Update to render `<Root />` instead of `<App />`.

### 3. `src/pages/LandingPage.tsx` (New)
- Build a full-screen layout utilizing the global `index.css` radial gradients.
- Include a hero section with the Vibe Studio glowing logo concept, a headline, and a "Comenzar a codear" button.
- The button handles navigation via `window.history.pushState({}, '', '/app'); window.dispatchEvent(new Event('popstate'));`.

### 4. `src/components/editor/EditorPanel.tsx`
- Modify the render logic to detect an empty project state.
- If no files exist in the project tree, render an Empty State UI.
- The Empty State UI will be a centered card using `bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-10`.
- The card will include a prominent button that triggers the folder selection flow (likely via `useProjectStore(s => s.openDirectory)` or similar existing action).

## Assets
- Will use standard Tailwind icons (or Lucide-react if available) for the folder icon in the empty state.

## Test Strategy
- Verify that loading `localhost:5173/` shows the landing page.
- Verify that clicking the CTA seamlessly transitions to `/app`.
- Verify that closing a project or entering `/app` freshly displays the new Glassmorphism empty state card.
