# Exploración: Identidad y Branding de Vibe Studio

## 1. Contexto y Objetivos
**Problema:** Vibe Studio actualmente utiliza un logo genérico heredado (`opita-symbol.png`) y una paleta de colores básica introducida ad-hoc (`vibe-purple`, `vibe-cyan`). El proyecto se siente "sin cara propia", más como una plantilla que como un producto maduro.
**Objetivo:** Desarrollar desde cero la identidad visual (Branding) de Vibe Studio. Esto incluye el diseño de un nuevo ícono/logo, la definición estricta de tokens de diseño (colores, tipografía, espaciado) y la estandarización de componentes UI bajo esta nueva marca.

## 2. Estado Actual (Análisis Visual)
- **Ícono:** Se usa un placeholder (símbolo de Opita).
- **Colores (Tokens actuales):** En la configuración de Tailwind tenemos `vibe-indigo`, `vibe-purple` y `vibe-cyan`, pero no hay una escala formal (ej. 100-900) ni tokens semánticos (ej. `bg-surface`, `border-glass`).
- **Tipografía:** Se confía en la fuente del sistema por defecto (San Francisco/Segoe UI). No hay una fuente distintiva para la UI ni una fuente recomendada estricta para el código (monospace).
- **Estilo General:** La estética "Glass & Glow" (fondos oscuros con orbes difuminados y bordes translúcidos) existe, pero no está formalizada en variables CSS.

## 3. Direcciones de Exploración

### Dirección A: Diseño del Logo (Isotipo + Logotipo)
- **Concepto "Vibe":** Frecuencia, onda, energía, IA, magia (resplandor).
- **Concepto "Studio":** Lienzo, corchetes `{}`, terminal, estructura.
- **Acción:** Usar herramientas de generación de imágenes para proponer 3 conceptos visuales para el ícono de la aplicación (que luego se convertirá en el `.ico` nativo de Tauri).

### Dirección B: Sistema de Tokens (Design System)
- **Paleta Base (Core):** Fondos `Slate` profundos (`#0f172a`, `#1e293b`).
- **Paleta Acento (Glow):** Un espectro de colores neón controlados. Cian para código/acciones exitosas, Púrpura/Magenta para IA/magia.
- **Tokens Semánticos CSS:** En lugar de hardcodear `bg-slate-800/40`, crear clases/variables como `--color-surface-glass` y `--color-border-glass`.

### Dirección C: Tipografía
- **UI (Interfaz):** Adoptar una tipografía geométrica moderna como `Outfit`, `Inter` o `Plus Jakarta Sans` para darle un toque premium.
- **Código (Mono):** Establecer `JetBrains Mono` o `Fira Code` (con ligaduras) como la fuente oficial de Vibe Studio para los editores.

## 4. Conclusión
El rebranding requerirá dos frentes: uno creativo (generación y elección de logo/colores) y uno técnico (traducción de estos elementos a `index.css` y `tailwind.config.ts`).

**Próximo Paso:** La fase `sdd-propose` deberá presentar opciones tangibles de color, fuentes y lanzar la generación del logotipo para que el usuario pueda elegir.
