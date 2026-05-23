# Design: Acoplamiento Dinámico en Opita Sync (Ops Hub)

## 1. Estructura del Manifiesto `opita-ops.json`

Cada proyecto que desee integrarse con Opita Sync deberá exponer este manifiesto estándar en su raíz para autodescribir sus capacidades de administración y recursos en la nube.

```json
{
  "projectId": "vibe-studio",
  "name": "Vibe Studio",
  "description": "IDE con IA para estudiantes y principiantes en español",
  "resources": {
    "usersTableParam": "/opita-account/${stage}/users-table-name",
    "tokenUsageTable": "TokenUsage",
    "transactionsTable": "Transactions"
  },
  "capabilities": [
    {
      "name": "list_users",
      "description": "Lista los usuarios de Vibe Studio filtrados por plan",
      "parameters": {
        "type": "object",
        "properties": {
          "plan": { "type": "string", "enum": ["free", "estudiante", "pro"] }
        }
      }
    },
    {
      "name": "update_user_plan",
      "description": "Modifica el plan de suscripción de un usuario en Vibe Studio",
      "parameters": {
        "type": "object",
        "properties": {
          "email": { "type": "string" },
          "new_plan": { "type": "string", "enum": ["free", "estudiante", "pro"] }
        },
        "required": ["email", "new_plan"]
      }
    }
  ]
}
```

---

## 2. Registro de Sincronización (`coupled-projects.json`)

Opita Sync mantendrá un archivo de base de datos local / de configuración en AWS S3 que mapea los proyectos actualmente acoplados y sus rutas relativas en el disco o identificadores en la nube.

```json
{
  "activeProjects": [
    {
      "projectId": "vibe-studio",
      "path": "C:/Users/nicou/Documents/dev/Opita-Code/vibe-studio",
      "coupledAt": 1779624500000
    }
  ]
}
```

---

## 3. Inyección Dinámica de Herramientas (AI Ops Pipeline)

Al iniciar el flujo conversacional en `/sync/chat`, el pipeline realizará lo siguiente:
1.  **Carga del Registro**: Lee `coupled-projects.json`.
2.  **Resolución de Manifiestos**: Por cada proyecto activo, lee el archivo `opita-ops.json` de su ruta local o almacén en la nube.
3.  **Generación de Tools en Vercel AI SDK**:
    *   Itera sobre la lista de `capabilities` del manifiesto.
    *   Inyecta en el objeto `tools` del método `streamText` una función `tool` construida dinámicamente:
    ```typescript
    import { tool } from "ai";
    import { z } from "zod";

    function buildDynamicTool(capability: any, projectId: string) {
      return tool({
        description: `[${projectId}] ${capability.description}`,
        // Traduce el JSON Schema del manifiesto a Zod
        inputSchema: jsonSchemaToZod(capability.parameters),
        execute: async (args) => {
          // Despacha la consulta al recurso en la nube resuelto dinámicamente
          return executeGovernedCapability(projectId, capability.name, args);
        }
      });
    }
    ```
4.  **Mapeo de Recursos en Tiempo de Ejecución**:
    *   Cuando el bot invoca la herramienta dinámica, `executeGovernedCapability` recupera el manifiesto del proyecto.
    *   Resuelve el nombre físico del recurso (por ejemplo, leyendo el nombre de la tabla de DynamoDB desde AWS SSM Parameter Store).
    *   Ejecuta el SDK de AWS en el backend y devuelve el resultado formateado al bot.
