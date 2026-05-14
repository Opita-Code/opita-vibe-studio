# Lista de Tareas: Edge Cases & UX Avanzada

## Fase 1: Motor Base y Persistencia (Infraestructura)
- [ ] **T1.1**: `package.json` - Instalar `wouter` e `idb-keyval`.
- [ ] **T1.2**: `src/stores/chat.ts` - Refactorizar el tipo `ChatState`. Cambiar `messages: Message[]` a `sessions: Record<string, ChatSession>` y `activeSessionId`.
- [ ] **T1.3**: `src/stores/chat.ts` - Integrar el middleware `persist` usando un storage personalizado mapeado a `idb-keyval`.
- [ ] **T1.4**: `src/stores/chat.ts` - Actualizar acciones existentes (`addMessage`, `appendToLastMessage`) para que operen sobre `sessions[activeSessionId].messages`.

## Fase 2: Resiliencia y Red
- [ ] **T2.1**: `src/services/aiService.ts` - Mejorar `streamAwsSse`. Capturar explícitamente `AbortError` y `TypeError` (Fetch fallido) para devolver estructuras `{ type: 'error', errorType: 'network' }`.
- [ ] **T2.2**: `src/stores/chat.ts` - Añadir la acción `retryLastMessage()` que re-ejecuta el generador si el último mensaje quedó trunco.
- [ ] **T2.3**: Componente UI de Chat - Renderizar mensaje de error amigable y el botón "🔄 Reintentar" cuando corresponda.

## Fase 3: Enrutamiento y Dashboard
- [ ] **T3.1**: `src/App.tsx` - Envolver el layout base en el proveedor de `wouter`.
- [ ] **T3.2**: `src/pages/Dashboard.tsx` (Nuevo) - Crear la vista principal que lista las sesiones guardadas en `chat.ts` con opciones para abrirlas o eliminarlas.
- [ ] **T3.3**: `src/App.tsx` - Configurar `<Route path="/" component={Dashboard} />` y `<Route path="/chat/:id?" component={Workspace} />`.

## Fase 4: Productividad (UX & Atajos)
- [ ] **T4.1**: `src/stores/chat.ts` - Añadir acción `editMessage(id, content)` que encuentra un mensaje, elimina los posteriores de la sesión y emite la actualización.
- [ ] **T4.2**: `src/lib/useKeybindings.ts` (Nuevo) - Crear el hook nativo que escuche `Ctrl+N` para llamar a `createNewSession` y forzar navegación a `/chat`.
- [ ] **T4.3**: `ChatInput.tsx` (Componente) - Escuchar `ArrowUp` cuando el valor del input está vacío, y rellenarlo con el último mensaje del usuario para habilitar la edición rápida.

---
**Revisión de Carga de Trabajo (Review Workload Forecast):**
- Líneas cambiadas estimadas: ~350 líneas.
- ¿Se recomienda Chained PRs (PRs apilados)?: No, este cambio entra cómodamente en el presupuesto de <400 líneas.
- ¿Decisión requerida antes de Apply?: No.
