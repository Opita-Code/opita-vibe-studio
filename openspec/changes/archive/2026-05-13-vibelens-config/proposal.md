# Proposal: VibeLens Configurable

## 1. Problema
Actualmente, el motor VibeLens está acoplado permanentemente a la generación de respuestas de la IA. Si un usuario no desea utilizar el "Modo Aislado" (por ejemplo, porque prefiere el flujo tradicional de observar el `index.html` tras cada cambio), no hay una forma de desactivar esta característica.

## 2. Solución Propuesta
Exponer una configuración `vibeLensEnabled` en el `UIStore` de Zustand y ofrecer una interfaz visual en el `SettingsPanel` (sección "Layout"). 

Para optimizar el uso de tokens y prevenir alucinaciones de la IA, el valor de esta configuración se utilizará dinámicamente durante el pipeline:
- Si `vibeLensEnabled === true`: El system prompt de la IA incluye instrucciones sobre `<vibe-action type="preview-component" />`.
- Si `vibeLensEnabled === false`: La instrucción se omite por completo del prompt y el motor ignora cualquier tag coincidente por seguridad.

## 3. Impacto Arquitectónico
- **UIStore**: Expansión mínima para acomodar el booleano y su mutación, incluyendo persistencia en localStorage.
- **Pipeline de Prompts**: `buildConstruirMessages` deberá aceptar `vibeLensEnabled` y construir el string del prompt en tiempo de ejecución.
- **Pipeline Engine**: Extraerá el booleano del store y lo enviará a los constructores de mensajes y filtrará los side-effects locales.

## 4. Alternativas Descartadas
- *Filtro a nivel UI exclusivamente*: Descartado por el gasto de tokens inútiles instruyendo a la IA sobre algo que la UI va a ignorar.
