# Spec: Chat UX para Usuarios No-Code + Sistema de Personas

## S1: Message Sections Rendering

### S1.1: Secciones se renderizan independientemente
- **GIVEN** un mensaje con `sections: [{ type: "thinking", ... }, { type: "text", ... }]`
- **WHEN** `MessageBubble` lo renderiza
- **THEN** cada sección MUST renderizarse como un bloque visual separado
- **AND** el thinking MUST aparecer colapsado ARRIBA del texto

### S1.2: Backward compatibility
- **GIVEN** un mensaje SIN `sections` (legacy)
- **WHEN** `MessageBubble` lo renderiza
- **THEN** MUST renderizar `message.content` como markdown (comportamiento actual)
- **AND** NO MUST mostrar errores ni layouts rotos

### S1.3: Thinking section collapsed by default
- **GIVEN** una sección tipo `thinking`
- **WHEN** se renderiza inicialmente
- **THEN** MUST estar colapsada con un label ejecutivo (ej: "Analizó 3 archivos")
- **AND** al hacer click SHOULD expandirse para mostrar el contenido completo

### S1.4: Tool calls never visible
- **GIVEN** un agente que ejecuta tool calls durante streaming
- **WHEN** el usuario observa el chat
- **THEN** MUST NOT ver texto tipo `<tool_use>`, `[tool_call:]`, ni metadata de herramientas
- **AND** SHOULD ver solo los steps del roadmap como indicadores de progreso

### S1.5: Notice section auto-dismiss
- **GIVEN** una sección tipo `notice` (ej: "Gemini no disponible, respondiendo con Opita Flash")
- **WHEN** se renderiza
- **THEN** MUST mostrarse como banner informativo inline
- **AND** SHOULD auto-colapsarse después de 10 segundos

### S1.6: Streaming sections accumulate
- **GIVEN** un stream en progreso
- **WHEN** llegan chunks del tipo `text`
- **THEN** MUST acumularse en la sección activa de tipo `text`
- **AND** cuando llega un chunk de tipo diferente, MUST crear una nueva sección

---

## S2: Sistema de Personas

### S2.1: Persona default
- **GIVEN** un usuario nuevo (sin configuración de persona)
- **WHEN** envía su primer mensaje
- **THEN** MUST usar la persona "Creador" (✨) como default
- **AND** el system prompt MUST incluir el addon de Creador

### S2.2: Persona inyectada en prompt
- **GIVEN** un usuario con persona "Estudiante" seleccionada
- **WHEN** se compone el system prompt
- **THEN** el PERSONA_ADDON MUST inyectarse DESPUÉS de AURA_BASE y ANTES de MODE_ADDON
- **AND** el orden MUST ser: AURA_BASE → PERSONA → MODE → TDD → PROJECT → CUSTOM

### S2.3: Persona persistida
- **GIVEN** un usuario que cambia su persona a "Ingeniero Senior"
- **WHEN** cierra y reabre Vibe Studio
- **THEN** la persona MUST persistir (localStorage via settingsStore)
- **AND** el selector MUST mostrar "Ingeniero Senior" como activo

### S2.4: Persona Pro gate
- **GIVEN** un usuario Free que intenta seleccionar "Ingeniero Senior"
- **WHEN** hace click en esa opción
- **THEN** MUST mostrar un indicador de "Pro" con un tooltip o badge
- **AND** MUST NOT activar la persona
- **AND** SHOULD mostrar un CTA breve para upgrade

### S2.5: Custom persona (Pro)
- **GIVEN** un usuario Pro con persona "Custom"
- **WHEN** escribe instrucciones personalizadas
- **THEN** esas instrucciones MUST inyectarse como PERSONA_ADDON
- **AND** MUST respetar el límite de 500 caracteres
- **AND** MUST NOT override las reglas de seguridad de AURA_BASE

### S2.6: Persona afecta formato de respuesta
- **GIVEN** persona "Estudiante" activa
- **WHEN** Aura responde
- **THEN** el thinking section SHOULD incluir un label educativo (ej: "💡 Por qué hago esto: ...")
- **AND** los code blocks SHOULD incluir comentarios explicativos

### S2.7: Quick-switch accesible
- **GIVEN** el panel de chat visible
- **WHEN** el usuario mira el footer del chat
- **THEN** MUST ver un indicador de persona activa junto al selector de modelo
- **AND** al hacer click SHOULD abrir un dropdown con las personas disponibles
