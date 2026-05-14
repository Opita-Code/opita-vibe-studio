# Specification: Vibe Premium UX

## Functional Requirements

### 1. Explorador (FileTree / ExplorerDock)
- Se debe mostrar botones de "Nuevo Archivo" y "Nueva Carpeta" al hacer hover sobre un directorio, o en la cabecera general si no hay directorio activo.
- Soporte para expandir/contraer todas las carpetas.

### 2. Editor Inicial (Welcome Screen)
- El fondo debe contener un estilo `Glass & Glow` con efectos de iluminación `bg-vibe-purple/10` y `bg-vibe-cyan/5`.
- 5 botones principales:
  - Crear archivo nuevo (Crea un archivo temporal `Untitled.txt` o similar).
  - Abrir terminal (Abre el panel inferior).
  - Ejecutar servidor de desarrollo (npm run dev).
  - Interacción con IA.

### 3. Barra Superior (ActionBar)
- Panel centralizado con botones de icono + texto:
  - Play (Ejecutar)
  - Bug (Debug)
  - Beaker (Test)
  - Eye (Preview)
  - Cloud (Deploy)
- Menús desplegables actualizados a estilo nativo del SO (vía menús custom HTML/CSS integrados al ActionBar).

### 4. Terminal Multifunción (TerminalPanel)
- Pestañas superiores: `Terminal` (shell bash/powershell), `Problemas` (vacío para MVP, listado de lints), `Salida` (logs), `Git` (estado del repo).
- Soporte para ejecutar múltiples shells (instancias de Tauri IPC) o al menos mantener la salida visualmente separada si no se tiene PTY real.

### 5. Chat Avanzado (ChatPanel)
- Botones de acción incrustados encima de la entrada de texto (Quick Actions): `Explicar`, `Optimizar`, `Fix`, `Generar`.
- Mejora visual del scroll y la jerarquía de mensajes.

## Non-Functional Requirements
- **Performance**: Las pestañas de la terminal y las acciones de IA deben responder en < 100ms.
- **Resiliencia**: El store persistido (`useUIStore`) debe migrar correctamente el estado `activeView` y la pestaña de la terminal si el usuario actualiza la app.
- **Look & Feel**: Mantener contraste entre el fondo principal (`#0A0B0E`) y paneles secundarios (`bg-glass` / `bg-slate-900/40`), todo con `backdrop-blur`.
