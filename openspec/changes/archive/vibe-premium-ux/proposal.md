# Propuesta: vibe-premium-ux

## Objetivo
Transformar el IDE actual en una herramienta visualmente deslumbrante que cumpla con la estética "Glass & Glow", abandonando por completo los colores planos legados de VS Code.

## Cambios Arquitectónicos / Visuales Propuestos

1. **Unificación de Componentes (Erradicar `#252526`)**:
   - `ViewTabs`: Cambiar el fondo sólido gris a un fondo translúcido (`bg-white/5` o `bg-slate-800/30`) con un `backdrop-blur`. Los botones inactivos tendrán menor opacidad y al estar activos tendrán un borde inferior con gradiente brillante.
   - `ChatPanel`: Eliminar su fondo `#252526`. Dejar que herede el fondo dark/glass del layout base. Reemplazar los bordes duros `#333` por `border-white/5`.
   - `LivePreview` (Empty State): Reescribir la cadena HTML estática para que los colores de fondo, tarjetas y textos usen los códigos HEX exactos de Tailwind (ej. `#0f172a` para slate-900, `#a855f7` para púrpura).

2. **Mejora del Chat de IA**:
   - Rediseñar el "Login Prompt": En vez de ser un div cuadrado plano, será una tarjeta flotante o un panel estilo "Glass" con iconos sutiles, indicando que "Tu asistente personal espera. Inicia sesión para despertar la IA".

3. **Interacciones (Micro-animaciones)**:
   - Añadir `transition-all duration-200` en los tabs, botones y elementos interactivos para que reaccionen al *hover* con un brillo sutil (`hover:bg-white/5` o `hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]`).

## Impacto en UX
El usuario ya no sentirá que "Vibe Studio" es un clon genérico de VS Code, sino un producto premium del ecosistema Opita, coherente con su Landing Page y diseñado explícitamente para el código impulsado por IA.
