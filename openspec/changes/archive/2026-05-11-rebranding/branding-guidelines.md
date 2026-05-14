# Vibe Studio: Guía de Marca y Reglas de Uso (Branding Guidelines)

Esta guía establece las normativas estrictas para el uso de los activos visuales (assets), logotipos y tokens de color de **Vibe Studio**, un producto hermano dentro del ecosistema Opita Code v4.

## 1. El Logotipo Oficial
El logotipo oficial de Vibe Studio es la **"V" Geométrica Plana**, derivada de la estructura del Opita Symbol v4.

### ✅ Reglas de Uso Correcto
- **Espacio Seguro (Clear Space):** El logotipo siempre debe estar rodeado de un espacio vacío equivalente a, al menos, el 25% de su ancho total. No lo aglomeres junto a texto u otros íconos.
- **Fondos Oscuros:** El logotipo está diseñado explícitamente para el modo oscuro. Siempre debe usarse sobre fondos pertenecientes a los tokens de la marca (`vibe-bg: #0a0f1c` o `vibe-surface: #131b2e`).
- **Escalabilidad:** Al escalar el logotipo (ej. en el ActionBar o como favicon), asegúrate de que mantiene la misma relación de aspecto cuadrática (1:1).

### 🚫 Reglas de Uso Incorrecto
- **No añadir efectos 3D o Sombras Sueltas exageradas.** El símbolo es estrictamente plano (flat vector).
- **No añadir "Glow" o Neón exterior.** El resplandor (glow) pertenece exclusivamente a los fondos de la UI, no al logotipo.
- **No alterar el gradiente.** El logotipo incluye un gradiente bloqueado de Púrpura (`#b026ff`) a Cian (`#00f0ff`). No invertir los colores ni usar colores sólidos ajenos a la marca.

## 2. Tipografía Oficial
Vibe Studio emplea dos familias tipográficas:
1. **Tipografía UI (Interfaz de Usuario):** `Outfit` (sans-serif) para títulos prominentes, y `Inter` o Sistema (`sans-serif`) para textos corporales y menús pequeños.
2. **Tipografía Técnica (Código/Terminal):** `JetBrains Mono` (monospace). Siempre debe incluir ligaduras tipográficas habilitadas (`font-variant-ligatures: normal;`).

## 3. Despliegue de Assets (Tauri & Web)
El activo base `vibe-symbol.png` se utiliza para autogenerar las siguientes derivaciones en el repositorio:
- `src-tauri/icons/icon.ico`: Ícono nativo para ejecutables de Windows (.exe).
- `src-tauri/icons/icon.icns`: Ícono nativo para aplicaciones de macOS (.app).
- `src-tauri/icons/icon.png`: Ícono nativo para binarios de Linux.
- `public/favicon.ico`: Ícono para las pestañas del navegador en la versión Web.
- `public/apple-touch-icon.png`: Ícono para PWA y accesos directos en dispositivos móviles.

Cualquier alteración futura al logo debe usar la utilidad nativa de Tauri (`npx tauri icon`) tomando como base un PNG de alta resolución (mínimo 512x512) para propagar los cambios simultáneamente a todas las plataformas.
