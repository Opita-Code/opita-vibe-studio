# Specification: VibeLens Configurable

## 1. Functional Requirements
- **FR1 (Persistencia)**: El usuario debe poder alternar el estado de `vibeLensEnabled` y este debe persistir entre recargas del editor.
- **FR2 (UI)**: Debe existir un interruptor/botón en la pestaña "Layout" de la ventana de configuración (`SettingsPanel`) con el nombre "Habilitar VibeLens (Modo Aislado)".
- **FR3 (Prompting Dinámico)**: Cuando `vibeLensEnabled` es `false`, los prompts de sistema no deben contener ninguna alusión a VibeLens ni a la etiqueta `<vibe-action type="preview-component">`.
- **FR4 (Intercepción)**: Si por alucinación el LLM emite la etiqueta estando la característica apagada, el motor en `engine.ts` debe silenciarla y no mutar el `previewTarget`.

## 2. UX Requirements
- **UX1**: El toggle debe respetar la estética "Glass & Glow" del resto del panel de Settings.
- **UX2**: Desactivar VibeLens mientras se está en Modo Aislado debe limpiar el `previewTarget` y regresar a la vista completa inmediatamente.

## 3. Technical Constraints
- **TC1**: La modificación de las firmas de los tests en `pipeline.test.ts` es mandatoria para asegurar el modo `strict_tdd` al cambiar la función `buildConstruirMessages`.
