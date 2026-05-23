# SDD Proposal: Editor-Chat Integration Architecture Polish

## Resumen

Esta propuesta tiene como objetivo resolver los fallos críticos de enrutamiento con los modelos DeepSeek y completar la integración interactiva entre el editor de código (VibePad) y el asistente de chat (Vibe AI), según lo especificado en las metas originales del producto:

1. **Restaurar el Enrutamiento DeepSeek V4**: Corregir el enrutador del frontend para que use los modelos correctos de la API de DeepSeek V4 (`deepseek-v4-pro` y `deepseek-v4-flash`), y proteger el backend contra crashes de tool calling cuando se use el modelo heredado de razonamiento (`deepseek-reasoner` / R1).
2. **Implementar las Acciones Rápidas de IA**: Añadir los botones contextuales de **Explicar**, **Optimizar**, **Fix** y **Tests** en la barra de herramientas del editor (`EditorToolbar.tsx`).
3. **Compartir Contexto de Archivo Activo en el Chat**: Mostrar un indicador visual en el chat de qué archivo está abierto y permitir inyectar su código completo en preguntas directas sin depender de herramientas.

---

## Cambio 1: Corrección de Modelos DeepSeek V4 e Inmunidad a Crashes

## Cambio 1: Alineación de Modelos con Planes, Registro V4 e Inmunidad a Crashes

### El Problema
- El frontend tiene un mapeo incorrecto que asume que los modelos V4 de DeepSeek no existen, forzando el uso de `deepseek-reasoner` (R1) para fases complejas de subagente.
- Como R1 no soporta llamadas a herramientas, la API de DeepSeek devuelve un error `HTTP 400` y bloquea la ejecución.
- **Modelos ocultos y bloqueados**: En `registry.ts`, los modelos disponibles nativos son obsoletos (ej. `deepseek-chat` y `deepseek-reasoner`). Los usuarios Pro y Estudiantes no pueden seleccionar los modelos prometidos en la landing (`deepseek-v4-pro`, `gemini-2.5-pro` y `deepseek-v4-flash`) porque no están registrados en el catálogo.
- El backend carece de un fallback recíproco: si DeepSeek falla, no se intenta usar Gemini, dejando al usuario con una burbuja de error.

### La Solución

1. **Catálogo de Modelos (`src/providers/registry.ts`)**:
   - Registrar oficialmente los modelos de DeepSeek V4: `deepseek-v4-flash` ("Opita Flash"), `deepseek-v4-pro` ("Opita Pro"), y `deepseek-reasoner` ("Opita Architect").
   - Registrar los modelos de Gemini: `gemini-2.5-flash` ("Gemini Flash") y `gemini-2.5-pro` ("Gemini Pro").

2. **Frontend Model Routing (`src/agent/model-router.ts`)**:
   - Revertir los cambios que forzaban el desuso de los modelos V4.
   - Enlazar las fases cognitivas pesadas del subagente (`sdd-explore`, `sdd-propose`, etc.) a `deepseek-v4-pro` (que sí soporta tools).
   - Enlazar fases ligeras y chat por defecto a `deepseek-v4-flash`.
   - Limitar `deepseek-reasoner` (R1) estrictamente a flujos de chat conversacionales puros.

3. **Restricción de Selección en Dropdown (`src/components/chat/ChatInput.tsx`)**:
   - Enlazar cada modelo del dropdown a su tier requerido:
     - **Free (tier 0)**: Solo puede seleccionar `gemini-2.5-flash` (y modelos BYOK).
     - **Estudiante (tier 1)**: Puede seleccionar además `deepseek-v4-flash`.
     - **Pro (tier 2)**: Puede seleccionar todos, incluyendo `deepseek-v4-pro`, `gemini-2.5-pro` y `deepseek-reasoner`.
   - Si el usuario intenta seleccionar un modelo por encima de su plan, mostrar un candado y disparar la intención de compra correspondiente (`pro_model` o `estudiante_model`).

4. **Backend (`packages/vibe-ai-backend/src/api/chat.ts`)**:
   - Asegurar que `getModel()` envíe `deepseek-v4-pro` y `deepseek-v4-flash` a la API oficial de DeepSeek.
   - **Inmunidad a Crashes**: Si llega una petición para `deepseek-reasoner` pero el cliente incluye herramientas (`Object.keys(tools).length > 0`), degradar el modelo automáticamente a `deepseek-v4-pro` o `deepseek-chat` para evitar el error de la API.
   - **Fallback Recíproco**: Si `providerId === "deepseek"` y la llamada falla, reintentar usando `gemini-2.5-flash` de manera transparente.

---

## Cambio 2: Barra de Acciones Rápidas de IA en el Editor

### El Problema
- `EditorToolbar.tsx` no implementa las acciones de la especificación (**Explicar**, **Optimizar**, **Fix**, **Tests**), limitándose a controles de layout.

### La Solución
Añadir una sección de botones con iconos en `EditorToolbar.tsx`. Cada botón ejecutará una función que:
1. Asegurará que haya un archivo activo en el store del editor (`projectStore.activeTab`).
2. Abrirá el panel de chat si está cerrado.
3. Inyectará una petición predefinida en español en el chat junto con el código del archivo activo.

```typescript
const QUICK_ACTIONS = {
  explicar: "Explica detalladamente la estructura y lógica de este código.",
  optimizar: "Optimiza este código analizando complejidad y rendimiento.",
  fix: "Encuentra y corrige bugs o malas prácticas en este código.",
  tests: "Escribe pruebas unitarias completas para este código usando vitest."
};
```

---

## Cambio 3: Contexto Dinámico de Archivo Activo en el Chat

### El Problema
- `getProjectSummary` descarta archivos de más de 300 líneas. Si el usuario hace preguntas en modo chat básico sobre archivos grandes, la IA no puede usar `read_file` (las herramientas están desactivadas en chat) y responde a ciegas.

### La Solución
1. **UI Indicator en `ChatInput.tsx`**:
   - Renderizar un badge encima de la caja de texto: `📎 Contexto activo: [nombre_archivo]`.
   - Añadir un toggle (botón de encendido/apagado) para permitir al usuario desactivar el envío del archivo si prefiere privacidad.
2. **Inyección en el Flujo de Envío (`useAgentHandler.ts` / `ChatPanel.tsx`)**:
   - Al enviar un mensaje, si el archivo activo está configurado como "compartir contexto", adjuntar el contenido del archivo de forma estructurada al final del mensaje del usuario en un bloque de código markdown o como attachment. Esto evita la necesidad de llamadas a herramientas y salta el límite de 300 líneas.

---

## Archivos afectados

| Archivo | Rol en el Cambio |
|---|---|
| `src/providers/registry.ts` | Registrar oficialmente `deepseek-v4-pro`, `deepseek-v4-flash`, y `gemini-2.5-pro` en el catálogo de modelos nativos. |
| `src/agent/model-router.ts` | Corregir enrutamiento para usar `deepseek-v4-pro` y `deepseek-v4-flash`. |
| `packages/vibe-ai-backend/src/api/chat.ts` | Agregar mapeo V4, degradación segura de R1 con tools, y fallback recíproco a Gemini. |
| `src/components/editor/EditorToolbar.tsx` | Implementar los botones de acciones de IA contextuales. |
| `src/components/chat/ChatInput.tsx` | Actualizar el catálogo visible y aplicar las restricciones de plan (locks) e intenciones de checkout correspondientes. Renderizar el badge de contexto activo. |
| `src/agent/useAgentHandler.ts` | Adjuntar dinámicamente el contenido del archivo abierto al enviar un mensaje de chat si el contexto está habilitado. |


---

## Verificación

1. **Pruebas Unitarias**:
   - Actualizar y ejecutar `npx vitest run src/agent/__tests__/model-router.test.ts` para verificar la selección correcta de modelos V4.
2. **Pruebas Manuales**:
   - Abrir un archivo grande (>300 líneas) en el editor.
   - Preguntar algo general en el chat y verificar que la IA responde con conocimiento exacto del archivo sin lanzar errores de tool execution.
   - Pulsar el botón **Explicar** del editor y verificar que el chat se abre y responde correctamente.
   - Forzar errores en DeepSeek (con una clave inválida local) y validar el fallback silencioso a Gemini.

---

## Riesgos

1. **Consumo de Tokens (Contexto Activo)**: Inyectar archivos grandes en cada mensaje puede consumir la cuota diaria del usuario. 
   - *Mitigación*: El badge en el chat input permite desactivar el contexto con un clic. Se desactivará por defecto si el archivo supera las 1500 líneas, advirtiendo al usuario.
