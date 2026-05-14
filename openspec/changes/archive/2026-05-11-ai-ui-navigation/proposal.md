# Change Proposal: AI UI Navigation

## Objective
Permitir a la IA controlar de manera inteligente y autónoma la interfaz de usuario del IDE, pudiendo cambiar vistas y abrir archivos a demanda sin intervención manual del usuario.

## Background
Actualmente, el chat de Vibe Studio sólo produce texto o dispara el pipeline de generación de código. El usuario tiene que navegar manualmente por el proyecto. Hacer la experiencia más fluida y premium implica que el asistente haga el trabajo pesado de navegación.

## Proposed Solution
- Añadir un bloque en el system prompt de la IA definiendo tags `<vibe-action>` especiales.
- Modificar el consumidor del stream de chat en `ChatPanel.tsx` para interceptar estos tags.
- Ejecutar las funciones del `useUIStore` y `useProjectStore` cuando la IA emite los tags.
- Ocultar los tags del texto renderizado al usuario.

## Risks
- Posible inyección accidental de tags si la IA alucina (solución: Regex estricto).
- Rendimiento del stream: se validará el regex sobre el string acumulado, lo cual es muy rápido.
