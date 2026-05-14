# Exploración: Edge Cases y UX Avanzada en Vibe Studio

## 1. Contexto y Objetivos
El objetivo de esta exploración es analizar las carencias actuales de Vibe Studio frente a los estándares de un IDE o herramienta de IA moderna, con un enfoque en la resiliencia (offline), gestión del historial, navegación, atajos y experiencia del desarrollador.

## 2. Estado Actual (Análisis del Código)

### A. Gestión de Chat e Historial (`stores/chat.ts`)
- **Estado**: Las conversaciones viven únicamente en memoria RAM. El array `messages` pierde su contenido si la app se recarga o cierra.
- **Historial**: No existe el concepto de "Sesiones de Chat" o base de datos local (SQLite o IndexedDB) para listar conversaciones antiguas.
- **Mutabilidad**: No hay métodos para editar o reenviar mensajes (`replaceLastMessageContent` se usa solo para el streaming de la IA, no para que el usuario edite su prompt).

### B. Resiliencia de Red y API (`services/aiService.ts`)
- **Offline/Desconexión**: Si la llamada a `fetch` falla por pérdida de internet, el error se escupe en bruto en el chat ("Connection error"). El mensaje del usuario no se puede reintentar fácilmente.
- **Rate Limits (429/500)**: No hay manejo de códigos HTTP específicos ni una UI clara para "Límite de tokens excedido".
- **Reintentos**: Cero lógicas de retries automáticos.

### C. Navegación, Preferencias y UI (`stores/ui.ts`)
- **Navegación**: Existe `activeView` (preview/editor), pero no un enrutador (Router) global que permita volver de un "Workspace" a un "Dashboard" o página principal donde ver historial.
- **Atajos y Accesibilidad**: No hay gestores de eventos de teclado (Keybindings) definidos a nivel global.
- **Ajustes**: No existe una persistencia de preferencias de usuario avanzadas (solo medidas de UI).
- **Contexto (Archivos)**: No hay UI ni estado en el chat que indique qué archivos tiene la IA en memoria.

## 3. Direcciones de Solución (Propuestas)

### Dirección 1: Motor de Almacenamiento Local (Historial)
- **Implementación**: Integrar una capa de almacenamiento persistente usando la API nativa de Tauri (`tauri-plugin-store` o SQLite) o IndexedDB para guardar un array de sesiones `{ id, title, messages, updatedAt }`.
- **Beneficio**: Permite "listar", "recargar" y "exportar" chats pasados.

### Dirección 2: Resiliencia del Input (Offline & Retries)
- **Implementación**: Separar visualmente el "mensaje enviado" de su estado de "procesamiento". Si hay error de red, mostrar un botón de "🔄 Reintentar".
- **Mutabilidad**: Añadir una acción `editMessage(id, newContent)` en el store de chat que trunque los mensajes posteriores y vuelva a generar la llamada.

### Dirección 3: Sistema de Navegación y Atajos (UX)
- **Implementación**: 
  - Usar un router (ej. `wouter` o `react-router`) para separar la vista "Home/Lobby" de la vista "Workspace".
  - Implementar un Hook global `useKeybindings` (`Ctrl+N` Nuevo Chat, `UpArrow` Editar último mensaje).
- **Beneficio**: Experiencia nativa real.

### Dirección 4: UI de Límites y Errores (Edge Cases)
- **Implementación**: Interceptar códigos HTTP (429, 500) en `aiService.ts` y lanzar modales no intrusivos o alertas en el chat (Toasts) que expliquen el límite y cuándo se reinicia.
- **Contexto Visible**: Mostrar "Píldoras" (badges) encima del input box mostrando los archivos referenciados.

## 4. Conclusión
La base de Vibe Studio es muy sólida en cuanto a diseño visual ("Glass & Glow"), pero carece de la infraestructura de datos y red para soportar interrupciones, persistencia a largo plazo y uso productivo de teclado. 

**Próximo Paso**: La fase `sdd-propose` definirá la arquitectura exacta para el motor de historial y las modificaciones en `chat.ts` y `aiService.ts`.
