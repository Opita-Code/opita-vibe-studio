# Exploration: vibe-ux-polish

## Current Flow Analysis
Presently, navigating to the Vibe Studio app loads the `<App />` component (the IDE shell) instantly. There is no landing page, no welcoming onboarding, and if no folder is selected, the IDE displays a somewhat barren empty state. 

For students and newcomers, this abrupt entry is confusing. We need to introduce a "Smarter User Flow" that guides the user from awareness (Landing Page) to action (Opening a Project) using our new "Glass & Glow" visual identity.

## UX Flow Proposals

### Flow 1: The Zero-Friction Flow (Recommended)
1. **Landing Page (`/`)**: A dedicated landing page with a hero section featuring the Vibe Studio glowing logo, a catchy headline ("Vibe-coding para estudiantes"), and a primary CTA "Abrir el Studio".
2. **The Transition**: Clicking the CTA smoothly fades out the landing and mounts the IDE shell (`/app`).
3. **The Empty State**: Once inside the IDE, if no project is loaded, the main editor area displays a beautifully crafted "Glassmorphism" card with an "Abrir Carpeta" button, a brief explanation of how local files work securely via BrowserFS, and recent projects (if any).
4. **Auth Gating**: Guests can open local folders without logging in, reducing friction. Login is only prompted for cloud-sync features.

### Flow 2: The Auth-First Flow
1. **Landing Page**: Similar to above.
2. **The Transition**: Clicking CTA prompts a "Sign In to Continue" modal.
3. **Pros/Cons**: High drop-off rate for students who just want to try the editor.

### Flow 3: The Interactive Landing Flow
1. **Landing Page**: The landing page *is* a read-only version of the IDE showing a demo file (e.g., "Welcome.md").
2. **The Transition**: Clicking "Start your own project" asks for a folder and transitions the demo into the real editor.
3. **Pros/Cons**: Very impressive, but technically complex to implement as a quick win.

## Recommendation
**Flow 1 (Zero-Friction)** is the most intelligent and realistic approach. We can implement a simple client-side router (or state-based routing) to separate the Landing View from the App View. We will design a stunning Landing Page using our "Glass & Glow" styling, and a polished Empty State inside the IDE.
