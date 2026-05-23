# Proposal: Panel de Administración Opita Code (Opita Sync)

## 1. Introducción
Este documento propone el diseño técnico para implementar el panel de administración (/admin) dentro del Portal de Cuentas (`cuenta.opitacode.com` / `opita-account-ui`). Aprovechando el backend de IA conversacional (**Opita Sync**) ya desplegado en la Lambda de AWS `/sync`, crearemos una consola de operaciones basada en chat estilo terminal, permitiendo a los operadores gestionar la plataforma utilizando lenguaje natural y visualizaciones estructuradas.

---

## 2. Cambios Propuestos

### Frontend (`opita-account-ui/frontend`)

#### [MODIFY] [App.tsx](file:///C:/Users/nicou/Documents/dev/Opita-Code/opita-account-ui/frontend/src/App.tsx)
- Registrar la ruta `/admin` y `/admin.html`.
- Importar y montar el componente `AdminConsole` de forma perezosa (lazy load) para no incrementar el bundle inicial.

#### [NEW] [AdminConsole.tsx](file:///C:/Users/nicou/Documents/dev/Opita-Code/opita-account-ui/frontend/src/screens/AdminConsole.tsx)
- Crear una pantalla con diseño de terminal oscuro ("Glassmorphic Obsidian") alineado con la identidad premium de Opita Code.
- Cargar y cachear los datos de sesión de operador consumiendo el endpoint `/sync` con `action: "whoami"` al montar.
- Bloquear a los usuarios sin privilegios redirigiéndolos a `/profile`.
- Implementar la interfaz de chat con **Opita Sync**:
  - Panel de mensajes con autoscroll.
  - Soporte para renderizar tablas Markdown limpias y formateo de código JSON.
  - Entrada de texto para prompts con estados de carga (streaming) y abortar llamadas.

#### [MODIFY] [AdminBento.tsx](file:///C:/Users/nicou/Documents/dev/Opita-Code/opita-account-ui/frontend/src/screens/widgets/AdminBento.tsx)
- Modificar el enlace del botón "AWS Infrastructure" para que redirija a `/admin` de forma interna utilizando el enrutamiento de `wouter`.

---

## 3. Arquitectura y Flujo de Datos

### Autenticación y Autorización
La comunicación con la API de stage/producción `/sync` se realiza utilizando el ID token de Cognito:
1. Al cargar `/admin`, la UI lee `opita_id_token` de las cookies.
2. Envía un POST a `/sync` con `{ "action": "whoami" }` en el body y la cabecera `Authorization: Bearer <id_token>`.
3. El backend valida el token contra las JWKS de Cognito y devuelve el rol. Si la respuesta da error (ej: "Acceso denegado"), la UI bloquea la consola y redirige.

### Flujo de Streaming SSE (EventStream)
Para el chat conversacional:
1. El operador envía un prompt.
2. La UI hace un request POST a `/sync` con `{ "action": "chat", "messages": [...] }`.
3. El backend devuelve un Server-Sent Events stream.
4. La UI decodifica el stream línea por línea (usando la API estándar `fetch` + un lector de stream readable) buscando eventos `data: {"content": "..."}` y los concatena en el mensaje activo.

---

## 4. Plan de Verificación

### Pruebas Manuales
1.  **Seguridad**: Iniciar sesión con una cuenta de usuario normal (plan Free) y navegar a `/admin`. Comprobar la redirección automática a `/profile`.
2.  **Acceso de Operador**: Configurar un correo de prueba en la variable `ADMIN_EMAILS` del backend. Iniciar sesión y navegar a `/admin`. Verificar que carga la consola sin problemas.
3.  **Chat en vivo**: Enviar comandos como *"Salud del sistema"* o *"Lístame las transacciones"* y corroborar que el stream llega de forma limpia y renderiza las tablas markdown sin romper el layout.

---

## 5. Riesgos y Mitigaciones
*   **Complejidad del parser de Markdown en el portal**: La UI de cuenta debe poder renderizar tablas de forma elegante. Mitigamos esto instalando `react-markdown` y `remark-gfm` si es necesario, o usando un parser simplificado y seguro si queremos mantener el bundle ligero.
