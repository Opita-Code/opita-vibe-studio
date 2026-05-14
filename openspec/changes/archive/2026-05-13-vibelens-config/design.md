# Design: VibeLens Configurable

## 1. Data Store (Zustand)
Archivo: `src/stores/ui.ts`
- Agregar a `UIState`: `vibeLensEnabled: boolean;`
- Agregar a `UIActions`: `setVibeLensEnabled: (enabled: boolean) => void;`
- Default: `true`
- Añadir `vibeLensEnabled` al bloque `partialize` del middleware `persist`.
- Modificar `setVibeLensEnabled` para que, si recibe `false`, ejecute también `set({ previewTarget: null })` garantizando el regreso al index (Cumplimiento de UX2).

## 2. Settings UI
Archivo: `src/components/settings/SettingsPanel.tsx`
- En el renderizado condicional de `activeTab === "layout"`, agregar una nueva sección "Características del Editor".
- Insertar un componente Toggle para `vibeLensEnabled` con el texto:
  *Título*: VibeLens (Modo Aislado)
  *Descripción*: Permite a la IA previsualizar componentes individualmente usando Sandpack.

## 3. Prompts Condicionales
Archivo: `src/pipeline/prompts.ts`
- Modificar la constante `CONSTRUIR_BASE` para remover la línea sobre `<vibe-action>`.
- Modificar `buildConstruirMessages(plan, userMessage, vibeLensEnabled)`.
- Si `vibeLensEnabled` es true, concatenar la regla especial al contenido del system prompt.

## 4. Pipeline Engine
Archivo: `src/pipeline/engine.ts`
- Importar `useUIStore`.
- Obtener `const vibeLensEnabled = useUIStore.getState().vibeLensEnabled;`
- Enviar `vibeLensEnabled` a las llamadas de `buildConstruirMessages` y en el contexto local (subagent y estandar).
- Validar `if (actionMatch && vibeLensEnabled)` antes de disparar `setPreviewTarget(actionMatch[1])`.

## 5. Testing (Strict TDD)
Archivos: `tests/pipeline/pipeline.test.ts` y `tests/stores/ui.test.ts`
- Actualizar llamadas mock de `buildConstruirMessages` para incluir el tercer argumento.
- Crear una aserción que valide que si se desactiva el toggle, el previewTarget vuelve a null.
