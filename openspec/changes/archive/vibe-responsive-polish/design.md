# Diseño: vibe-responsive-polish

## Cambios de Interfaz (Tailwind)

### 1. `src/App.tsx` (Layout Core)
En el div contenedor principal que separa el chat del editor:
- En lugar de usar una lógica booleana exclusiva de JS para desmontar el panel, usaremos clases responsivas.
- Pero como el `chatPosition` de Zustand decide el orden del render, será mejor seguir renderizando el `ChatPanel`, pero envolverlo en un contenedor que cambia sus estilos en base al breakpoint `md`.

**Diseño del Contenedor del Chat**:
- Clases base (Móvil): `fixed inset-0 z-50 transform transition-transform duration-300` + estado `translate-x-0` (abierto) o `translate-x-full` (cerrado).
- Clases desktop (`md:`): `relative inset-auto z-auto transform-none transition-none w-[var(--chat-width)]`.

**Botón Flotante (FAB)**:
- Un `<button>` renderizado condicionalmente o con clases `md:hidden` en `App.tsx`.
- Posición: `fixed bottom-10 right-4 z-40`.

### 2. `src/components/layout/ChatPanel.tsx`
- Necesita aceptar una prop adicional `onCloseMobile?: () => void` para renderizar el botón "X" en la parte superior derecha, o el padre (`App.tsx`) renderiza el botón de cerrar encima. Lo más limpio es que `App.tsx` maneje el contenedor responsivo y el botón de cerrar móvil, mientras que `ChatPanel` siga ignorante del entorno, o añadir el botón en `ChatPanel`. Añadirlo en `App.tsx` es mejor para no tocar tanto el Chat.

### 3. `landing/index.html`
- El `<nav>`: reducir `gap-4` a `gap-2` en móviles, o escalar el texto a `text-xs`.
- La Card Inferior: En móvil el bloque de código sobresale. Añadir `overflow-x-auto` al bloque de código.
