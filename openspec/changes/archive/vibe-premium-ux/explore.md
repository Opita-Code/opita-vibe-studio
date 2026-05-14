# Exploración: vibe-premium-ux

## Análisis del Estado Actual
El usuario ha indicado que la app no se ve ni se siente "premium" y ha adjuntado una captura de pantalla. Al revisar el código y la captura, hemos identificado los siguientes problemas clave en el flujo y la interfaz del IDE:

1. **Inconsistencia Temática ("Frankenstein Theme")**:
   - Mientras que la Landing Page y el contenedor principal (`App.tsx`) utilizan el nuevo diseño *Glass & Glow* (fondos `slate-900`, degradados púrpuras, `backdrop-blur`), los componentes internos del IDE (heredados de la primera versión) utilizan colores tipo "VS Code Clásico":
     - `ViewTabs.tsx` tiene un fondo fijo `bg-[#252526]` y bordes `border-[#333]`.
     - `ChatPanel.tsx` tiene fondos `#252526` y bordes sólidos grises oscuros.
     - `LivePreview.tsx` inyecta CSS estático con `#161616` para su estado vacío.

2. **Tipografía y Espaciado**:
   - Los componentes usan `text-xs` o `text-sm` sin un buen contraste.
   - Los bordes (`border-white/10` vs `border-[#333]`) chocan visualmente.

3. **Empty States**:
   - El estado vacío de "Vista Previa" (atajos de teclado y tips) es muy utilitario, no tiene la "magia" del Glassmorphism.
   - El banner de "Iniciar Sesión" en el chat es un bloque que interrumpe la experiencia y parece fuera de lugar dentro de una UI premium.

4. **Botones y Acciones**:
   - Los "tabs" de arriba (`Vista Previa`, `Editor + Archivos`) se ven como simples botones de texto. En un IDE moderno como Cursor o Zed, las pestañas superiores se integran sutilmente en la barra del título o tienen un diseño flotante con transiciones suaves.

## Flujos Afectados
- **Flujo de Usuario No Autenticado**: Entra al IDE y ve un fondo gris opaco con un bloque oscuro pidiendo login en el chat. La primera impresión en el espacio de trabajo es débil y desentona con la Landing Page.
- **Flujo de Preview de Código**: Al no tener archivos abiertos, el canvas de vista previa domina la pantalla con colores apagados.

## Resumen
La capa visual "Glass & Glow" se quedó solo en la superficie (`App.tsx` y `index.css`). Necesitamos sumergir a los componentes core (`ChatPanel`, `ViewTabs`, `LivePreview`) en este mismo ecosistema de diseño para unificar la experiencia y lograr el nivel de calidad premium esperado.
