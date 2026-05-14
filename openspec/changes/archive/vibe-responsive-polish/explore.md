# Exploración: vibe-responsive-polish

## Objetivo
El usuario solicitó "una ronda de pulida para movil y para web" para mejorar la responsividad de la aplicación. 

## Análisis del Estado Actual

### App.tsx (IDE)
1. **Layout Principal**: La estructura divide la pantalla horizontalmente: `ChatPanel` (ancho fijo por Zustand, ej. 300px) y `EditorPanel` (flex-1).
2. **Problema en Móviles**: Si la pantalla es pequeña (ej. iPhone 375px), el chat toma 300px y el editor 75px. Resulta inutilizable.
3. **Controles Superiores**: El `Header` tiene el título, botones de exportar y auth. En móvil puede que el texto se superponga si los botones ocupan mucho.
4. **Solución Posible (Móvil)**:
   - Apilar elementos de forma absoluta (ej. el Chat como un *Drawer* off-canvas, o pestañas inferiores para alternar entre Código y Chat).
   - O simplemente usar Tailwind: `flex-col` en móviles y `flex-row` en desktop, aunque un IDE vertical es difícil.
   - Alternativa más sencilla: Ocultar el chat por defecto en pantallas pequeñas (`< md`) y mostrar un botón flotante para "Abrir IA". Cuando se abre, toma 100% del ancho o se desliza.

### Landing Page (`landing/index.html`)
1. Ya cuenta con flexbox responsive (`flex-col sm:flex-row`).
2. Título usa `text-5xl md:text-7xl` (correcto).
3. Podría necesitar márgenes o paddings más amistosos en móvil para la tarjeta del "Entorno Local Seguro".

## Opciones de Implementación para el IDE
1. **Tabs Inferiores (Bottom Navigation)**: Solo visible en móvil. Permite cambiar entre Vista de Explorador, Editor y Chat.
2. **Chat como Drawer/Overlay (Recomendado)**: En móvil, el `EditorPanel` ocupa 100%. Un botón flotante abre el `ChatPanel` superpuesto en toda la pantalla (z-50) con un botón para cerrarlo. Esto mantiene la experiencia de Vibe-coding sin exprimir el espacio.

## Recomendación (Propuesta)
Avanzar con la **Opción 2**: implementar un diseño adaptable en `App.tsx` usando media queries de Tailwind (`md:`) para que el `ChatPanel` sea un panel lateral en desktop, y un overlay a pantalla completa (o drawer lateral) en móvil. La `Landing Page` requiere ajustes mínimos de padding.
