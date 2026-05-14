# Especificación: vibe-responsive-polish

## Requisitos Funcionales
1. **Responsividad del IDE (`App.tsx`)**:
   - En pantallas `md` y superiores (>=768px), mantener el diseño side-by-side de siempre.
   - En pantallas menores a `md` (<768px), el `ChatPanel` debe ocultarse del flujo principal para ceder 100% de ancho al `EditorPanel`.
   - Incluir un botón flotante tipo FAB ("✨ IA") en la esquina inferior derecha para abrir el chat en móviles.
   - Al tocar el botón, el `ChatPanel` debe aparecer como un overlay fijo cubriendo la pantalla.

2. **Responsividad del Landing (`landing/index.html`)**:
   - Ajustar márgenes de la barra de navegación para que no colapse en teléfonos estrechos (ej. 320px).
   - Ajustar tamaño de fuentes del H1 y de la *feature card* para pantallas pequeñas.

## Requisitos No Funcionales
- **Retención de Estado**: El chat debe mantener sus mensajes, variables de estado y progreso de stream cuando entra y sale del modo overlay (no debe desmontarse).
- **Consistencia Visual**: El modal/overlay del chat debe seguir usando el fondo Glassmorphism y tener un botón claro para "Cerrar".
