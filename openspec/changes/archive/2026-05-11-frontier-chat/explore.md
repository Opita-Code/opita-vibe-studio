## Exploration: Frontier LLM Chat (Multimodal & Contexto Extendido)

### Current State
Actualmente, `ChatInput.tsx` impone un límite estricto de 8,000 caracteres (`CHAR_LIMIT = 8000`). No soporta *Drag & Drop* de archivos, no acepta imágenes y no hay forma de adjuntar contexto sin pegarlo directamente en el textarea, lo cual arruina la usabilidad cuando se trata de código largo. El backend (`aiService.ts` y `vibe-ai-backend`) asume que cada `Message.content` es siempre un string plano.

### Affected Areas
- `src/components/chat/ChatInput.tsx` — Necesita UI para Drag & Drop, previsualización de chips/thumbnails, y eliminar el límite duro.
- `src/lib/types.ts` — Necesita extender `Message` para incluir `attachments?: Attachment[]`.
- `src/services/aiService.ts` — Necesita enviar los `attachments` al backend.
- `packages/vibe-ai-backend/src/api/chat.ts` — Necesita mapear `attachments` al formato nativo Multimodal de Vercel AI SDK (array de partes de contenido: text, image).

### Approaches

1. **Aplanamiento en Frontend (Solo Texto)**
   - El frontend lee los archivos arrastrados y añade su contenido directamente al string del mensaje antes de enviarlo.
   - Pros: No requiere cambios en el backend ni en los tipos de Vercel AI SDK.
   - Cons: No soporta imágenes (visión). Hace que el historial del chat sea inmenso e ilegible al incluir los archivos completos en el texto del UI.

2. **Soporte Multimodal Completo (Recomendado)**
   - El frontend mantiene una lista visual de `attachments` (Chips para texto, Thumbnails para imágenes).
   - El payload al backend incluye estos `attachments`.
   - El backend utiliza el soporte "Multi-part" de Vercel AI SDK: `content: [{ type: 'text', text: '...' }, { type: 'image', image: 'base64...' }]`.
   - Pros: Soporte nativo para Visión. El historial en la UI se mantiene limpio (solo muestra la píldora, no el contenido del archivo). Permite escalar a límites de contexto masivos (100k+ tokens).
   - Cons: Requiere actualización tanto en el frontend como en el handler de AWS Lambda.

### Recommendation
Implementar la aproximación de **Soporte Multimodal Completo**. Transforma la experiencia del usuario a la de un modelo "Frontier" moderno, limpiando el textarea y abriendo la puerta a casos de uso de diseño a código (visión).

### Risks
- Costos de API: Enviar imágenes y archivos masivos dispara el consumo de tokens.
- Memoria: Manejar strings base64 en Zustand podría ralentizar la interfaz si los archivos son excesivamente grandes (ej. imágenes de 10MB).
- Límite de Payload en AWS Lambda (6MB): Cargas de múltiples imágenes de alta resolución o archivos masivos podrían golpear el límite del payload de AWS API Gateway/Lambda.

### Ready for Proposal
Yes. El equipo puede proceder a diseñar la UI de los Chips (píldoras de archivos) y el Dropzone, para luego escribir la propuesta de implementación final.
