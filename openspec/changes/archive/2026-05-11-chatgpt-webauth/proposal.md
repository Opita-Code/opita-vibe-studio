# Proposal: Integración de Suscripción ChatGPT Plus (WebAuth)

## Objetivo
Permitir a los usuarios de Vibe Studio conectar su cuenta personal de ChatGPT Plus (o gratuita) para realizar inferencias utilizando sus límites de la versión web, sin consumir tokens de la API oficial (OpenAI REST API).

## Arquitectura (Tauri v2)

1. **El Lanzador (WebviewWindow)**
   Añadiremos un botón en el `ByokPanel` llamado "Conectar Cuenta Web". Este botón abrirá una ventana hija nativa de Tauri (`WebviewWindow`) apuntando a `https://chatgpt.com`.

2. **Inyección de Scripts (Session Hijacking)**
   Utilizaremos la capacidad de Tauri para inyectar scripts en la ventana hija. El script sondeará el estado de la autenticación del usuario. Una vez que el usuario inicie sesión exitosamente y se genere la cookie de sesión (`__Secure-next-auth.session-token`) o el JWT, el script emitirá un evento nativo hacia la ventana principal de Vibe Studio.

3. **Almacenamiento (BYOK Store)**
   El token capturado se guardará en `byok-store.ts` bajo un nuevo proveedor llamado `chatgpt-web`. Se aplicarán las mismas reglas de seguridad y enmascaramiento.

4. **Proveedor de Inferencia (Backend API)**
   Crearemos un nuevo archivo `src/providers/chatgpt-web.ts`. Este proveedor no usará el endpoint oficial (`api.openai.com/v1/chat/completions`), sino el endpoint web (`https://chatgpt.com/backend-api/conversation`).
   Dado que los navegadores bloquean estas peticiones por CORS, utilizaremos el plugin `@tauri-apps/plugin-http` (Fetch desde el backend en Rust) para enviar las peticiones camufladas como si vinieran del navegador original.

## Riesgos y Consideraciones
- **Volatilidad:** OpenAI cambia frecuentemente los endpoints de `/backend-api` y los mecanismos de Cloudflare. Esta característica puede romperse y requerir mantenimiento frecuente.
- **TOS:** Automatizar peticiones web bordea los Términos de Servicio de OpenAI para la versión web.

## Fases de Implementación (SDD Tasks)
1. Habilitar y configurar `@tauri-apps/plugin-http`.
2. Modificar `ByokPanel` para incluir el flujo de "Conexión Web".
3. Implementar el lanzador `WebviewWindow` con el extractor de tokens.
4. Crear el proveedor `chatgpt-web.ts`.
