# Especificación: vibe-premium-ux

## Requisitos Funcionales y Visuales
1. **Unificación Glass & Glow**: Los componentes base (`ViewTabs`, `ChatPanel`, `MessageList`, `LivePreview`) deben adoptar la paleta de colores de Tailwind (`slate-900`, `vibe-purple`, `vibe-cyan`) y abandonar los grises duros heredados (`#252526`, `#333`).
2. **ChatPanel Premium**:
   - Reemplazar el banner de autenticación por una UI atractiva estilo "Glass", con icono decorativo, gradiente en texto y un botón con estado `hover` fluido.
   - En el `MessageList`, limpiar los colores de texto rígidos (`#969696`) y usar semánticos (`text-slate-400`).
3. **Pestañas Mejoradas (`ViewTabs`)**:
   - Fondo translúcido en lugar de gris sólido.
   - Pestaña activa destacada con borde neón (`border-vibe-cyan` o similar) y texto blanco.
4. **Empty State de Vista Previa (`LivePreview`)**:
   - Inyectar el tema oscuro moderno: fondo `#0f172a`, bordes translúcidos de blanco (`rgba(255,255,255,0.05)`).
   - Aplicar el color púrpura oficial a íconos o etiquetas (`#a855f7`).
