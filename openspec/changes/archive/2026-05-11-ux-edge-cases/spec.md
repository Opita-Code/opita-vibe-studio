# Especificación Funcional: Edge Cases & UX Avanzada

## 1. Visión del Producto
Vibe Studio debe evolucionar de un "editor con chat efímero" a una herramienta resiliente y persistente donde el usuario nunca pierda trabajo por fallos de red o recargas, y donde pueda navegar entre sesiones antiguas con facilidad.

## 2. Requisitos Funcionales (Historias de Usuario)

### Epic 1: Persistencia e Historial
- **F1.1**: Como usuario, si cierro la app y la vuelvo a abrir, quiero ver mi última conversación intacta.
- **F1.2**: Como usuario, quiero poder acceder a un "Dashboard" para ver una lista de mis conversaciones pasadas (Sesiones).
- **F1.3**: Como usuario, quiero poder crear un "Nuevo Chat" vacío en cualquier momento.

### Epic 2: Resiliencia (Modo Offline y Rate Limits)
- **F2.1**: Como usuario, si se me cae el internet mientras el modelo está escribiendo, quiero recibir una notificación amigable, no un fallo crudo.
- **F2.2**: Como usuario, si un mensaje falla en enviarse, quiero ver un botón de "Reintentar" al lado de mi mensaje.
- **F2.3**: Como usuario, si excedo el límite de tokens, quiero ver una advertencia clara para poder reducir el contexto.

### Epic 3: UX y Mutabilidad
- **F3.1**: Como usuario, si presiono la flecha Arriba (`UpArrow`) en el input vacío, quiero que se cargue mi último mensaje enviado para editarlo.
- **F3.2**: Como usuario, si presiono `Ctrl + N` o `Cmd + N`, quiero iniciar un chat nuevo inmediatamente.
- **F3.3**: Como usuario, quiero poder editar un mensaje anterior en el hilo, lo que debería truncar la conversación desde ese punto y generar una nueva respuesta.

## 3. Requisitos No Funcionales
- **Rendimiento**: El guardado de las conversaciones no debe congelar la UI (uso estricto de IndexedDB asíncrono, nunca localStorage).
- **Peso**: El router (`wouter`) y el storage (`idb-keyval`) no deben aumentar más de 10KB al bundle.
