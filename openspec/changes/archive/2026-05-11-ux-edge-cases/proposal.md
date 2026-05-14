# Propuesta Arquitectónica: Edge Cases & UX Avanzada

## 1. Decisiones Arquitectónicas (ADRs)

### ADR 1: Motor de Almacenamiento Local (Historial)
**Problema**: El historial de chat se pierde al recargar.
**Decisión**: Utilizar `idb-keyval` (IndexedDB ligero) integrado con Zustand `persist` middleware para `stores/chat.ts`.
**Justificación**: Es nativo del navegador embebido (WebView2), extremadamente rápido, asíncrono y soporta grandes cantidades de texto sin bloquear el hilo principal (a diferencia de `localStorage`). No requiere dependencias pesadas de Tauri en el backend Rust.
**Impacto**: `chat.ts` pasará a gestionar "Sesiones" (diccionario de arrays de mensajes) en lugar de un solo array global.

### ADR 2: Enrutamiento y Navegación
**Problema**: No existe jerarquía de páginas (Home vs Workspace).
**Decisión**: Introducir `wouter` como enrutador global.
**Justificación**: `wouter` es minimalista (<2KB), perfecto para aplicaciones Desktop de una sola ventana.
**Impacto**: 
- `App.tsx` manejará las rutas: `/` (Dashboard de historial) y `/chat/:sessionId` (Workspace activo).

### ADR 3: Resiliencia y Mutabilidad de Chat
**Problema**: Errores crudos de red y prompts inmutables.
**Decisión**: 
1. Añadir estados de red (`offline`, `rate-limited`, `error`) al `aiService.ts` y reflejarlos en `ui.ts`.
2. Añadir funciones `editMessage(id, content)` y `retryMessage(id)` en `chat.ts`.
**Justificación**: Permite al usuario corregir errores sin tener que reescribir prompts largos ni perder contexto si la red falla intermitentemente.

### ADR 4: Atajos de Teclado
**Problema**: Falta de productividad orientada al teclado.
**Decisión**: Crear un hook global `useKeybindings` usando manejadores nativos (`keydown`) acoplado a los stores de Zustand.
**Justificación**: Evita dependencias extra de terceros.
- `Ctrl + N`: Nuevo chat
- `Ctrl + J` / `Cmd + J`: Mostrar/ocultar panel lateral
- `Arrow Up` (en input vacío): Editar último mensaje enviado

## 2. Cambios Requeridos (Archivos afectados)
- `src/stores/chat.ts`: Refactorización masiva para soportar sesiones, `persist` y funciones de mutación.
- `src/stores/ui.ts`: Añadir estados de error global (Toasts de conexión).
- `src/services/aiService.ts`: Captura de `AbortError` y `TypeError` (offline) para devolver respuestas estructuradas.
- `src/App.tsx`: Implementar `<Router>` y `<Route>`.
- `package.json`: Instalar `wouter` e `idb-keyval`.

## 3. Riesgos
- Al implementar `wouter`, el estado de la UI actual en pantalla dividida podría romperse. Habrá que asegurar que componentes como `ResizeHandle` y `Terminal` se ubiquen fuera del enrutador si son globales, o dentro de la ruta `/chat`.
