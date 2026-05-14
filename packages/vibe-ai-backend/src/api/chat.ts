import * as jose from "jose";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Resource as SSTResource } from "sst";

const Resource = SSTResource as unknown as Record<string, { name: string }>;

// Stream and Lambda Typings
interface AWSTypes {
  streamifyResponse: (
    handler: (
      event: { headers?: Record<string, string>; body?: string },
      responseStream: NodeJS.WritableStream & { setContentType: (type: string) => void },
      context: unknown
    ) => Promise<void>
  ) => unknown;
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      options: { headers: Record<string, string> }
    ) => NodeJS.WritableStream & { setContentType: (type: string) => void };
  };
}
declare const awslambda: AWSTypes;

// ─── Constants & Setup ─────────────────────────────────────────

const SYSTEM_PROMPT = `Eres Vibe Studio, un agente ingeniero de IA senior enfocado en TDD (Test-Driven Development).
REGLA ESTRICTA 1: NUNCA asumas el contenido de un archivo. Si necesitas modificar algo, usa la herramienta 'read_local_file' primero.
REGLA ESTRICTA 2: Cuando se te pida crear código, DEBES escribir un test primero y usar 'execute_test_command' para correrlo en la máquina del usuario.
REGLA ESTRICTA 3: Solo puedes entregar la respuesta final de código una vez que la herramienta te confirme que el test pasó exitosamente.`;

const SUBAGENT_PROMPTS: Record<string, string> = {
  "sdd-apply": `Eres Vibe Studio Pro, un ingeniero de software senior y subagente autónomo especializado en Test-Driven Development (TDD).
Tu tarea es implementar la funcionalidad requerida usando un ciclo SDD estricto (Red-Green-Refactor).

FLUJO DE TRABAJO ESTRICTO (EJECUTA AUTÓNOMAMENTE):
1. [RED] ANTES de escribir código, usa 'write_local_file' para crear un archivo de prueba (ej. usando vitest o el framework del proyecto).
2. [RED] Ejecuta 'execute_test_command' para confirmar que el test FALLA (porque la función no existe o no hace lo correcto). Esto es OBLIGATORIO.
3. [GREEN] Usa 'write_local_file' o 'multi_replace_file_content' para implementar el código que haga pasar el test.
4. [GREEN] Ejecuta 'execute_test_command' hasta que los tests pasen con éxito. Si fallan, corrige la implementación y vuelve a probar.
5. [REFACTOR] Refactoriza si es necesario, asegurando que los tests sigan en verde.
6. [DONE] Solo después de que 'execute_test_command' retorne éxito, emite tu respuesta final explicando lo logrado.

REGLA DE ORO: TIENES TOTAL PROHIBICIÓN de dar una respuesta final sin haber escrito un test y haberlo ejecutado con éxito. No pidas permiso para usar herramientas, hazlo de forma continua hasta completar el requerimiento.`,
};

const awsConfig = process.env.LOCALSTACK_ENDPOINT ? {
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
} : {};

const dynamoClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ─── Encryption Helpers ────────────────────────────────────────

const ENCRYPTION_KEY = process.env.JWT_SECRET || "opita_secret_for_dev_only_123";
const getEncryptionKey = () => crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string) {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

// ─── Provider Setup ────────────────────────────────────────────

function getModel(providerId: string, customApiKey?: string, explicitModelId?: string) {
  switch (providerId) {
    case "openai":
    case "chatgpt-web": {
      const openai = createOpenAI({ apiKey: customApiKey || process.env.OPENAI_API_KEY });
      return openai(explicitModelId || "gpt-4o");
    }
    case "deepseek": {
      const openai = createOpenAI({
        apiKey: customApiKey || process.env.DEEP_SEEK_KEY,
        baseURL: "https://api.deepseek.com",
      });
      return openai(explicitModelId || "deepseek-chat");
    }
    case "openrouter": {
      const openai = createOpenAI({
        apiKey: customApiKey || process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
      });
      return openai(explicitModelId || "google/gemini-2.5-flash"); // Modelo por defecto
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: customApiKey || process.env.GEMINI_API_KEY });
      return google(explicitModelId || "gemini-2.5-flash");
    }
    default:
      throw new Error(`Proveedor desconocido: ${providerId}`);
  }
}

// ─── Types ──────────────────────────────────────────────

interface Attachment {
  contentType: string;
  name: string;
  data: string;
}

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content?: string;
  attachments?: Attachment[];
}

interface ChatPayload {
  action?: string;
  providerId?: string;
  subagentId?: string;
  customApiKey?: string;
  messages?: IncomingMessage[];
  customInstructions?: string;
  modelId?: string;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "file"; data: string; mediaType: string };

interface StreamChunk {
  type: string;
  text?: string;
  textDelta?: string;
  toolName?: string;
  input?: unknown;
  totalUsage?: unknown;
  usage?: unknown;
}

// ─── Lambda Handler ────────────────────────────────────────────

export const handler = awslambda.streamifyResponse(
  async (event: { headers?: Record<string, string>; body?: string }, responseStream: NodeJS.WritableStream & { setContentType: (type: string) => void; write: (data: string | Uint8Array) => void; end: () => void }, _context: unknown) => {
    // 1. JWT Validation (Strictly Required for AWS now)
    const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
    let token = authHeader.split(" ")[1];

    if (!token) {
      // Intentar leer token desde cookie opita_session si no hay Bearer token
      const cookies = event.headers?.cookie || event.headers?.Cookie || "";
      const match = cookies.match(/opita_session=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Falta token Bearer o cookie" }));
      responseStream.end();
      return;
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "opita_secret_for_dev_only_123");
    let userId = "guest";
    let plan = "free";
    try {
      const decoded = await jose.jwtVerify(token, secret);
      userId = (decoded.payload.sub || decoded.payload.email || "guest") as string;
      plan = (decoded.payload.plan || "free") as string;
    } catch {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Token inválido" }));
      responseStream.end();
      return;
    }

    // 2. Parse Payload
    const requestBytes = event.body ? Buffer.byteLength(event.body, 'utf8') : 0;
    
    let body: ChatPayload;
    try {
      body = JSON.parse(event.body || "{}") as ChatPayload;
    } catch {
      body = {};
    }

    const action = body.action || "chat";
    let providerId = body.providerId || "deepseek";
    const subagentId = body.subagentId || "sdd-apply";
    let modelId = body.modelId;

    // ─── CHAR LIMIT GUARD (PER-PLAN) ───
    const charLimits: Record<string, number> = { free: 8000, estudiante: 32000 };
    const maxChars = charLimits[plan] || Infinity;
    if (requestBytes > maxChars) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: `Límite de caracteres excedido (Max ${maxChars.toLocaleString()}). Reduce tu prompt o mejora tu plan.` }));
      responseStream.end();
      return;
    }

    // ─── MONETIZATION GUARD ───
    if (action === "subagent" && plan === "free") {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ 
        error: "upgrade_required", 
        message: "Para usar la orquestación SDD, necesitas Vibe Estudiante o Vibe Pro. [Mejora tu plan para continuar]" 
      }));
      responseStream.end();
      return;
    }

    // ─── ACTION: SAVE KEY ───
    if (action === "save_key") {
      const apiKeyToSave = body.customApiKey;
      if (!apiKeyToSave) {
        responseStream.setContentType("application/json");
        responseStream.write(JSON.stringify({ error: "Falta customApiKey en el payload" }));
        responseStream.end();
        return;
      }

      try {
        const encryptedKey = encrypt(apiKeyToSave);
        await docClient.send(new PutCommand({
          TableName: Resource.UserKeys.name,
          Item: {
            id: `${userId}#${providerId}`,
            encryptedKey: encryptedKey,
            updatedAt: new Date().toISOString()
          }
        }));
        
        responseStream.setContentType("application/json");
        responseStream.write(JSON.stringify({ success: true, message: "Llave cifrada y guardada en DynamoDB exitosamente" }));
        responseStream.end();
        return;
      } catch (err) {
        console.error("Error guardando la llave:", err);
        responseStream.setContentType("application/json");
        responseStream.write(JSON.stringify({ error: "No se pudo guardar la llave en DynamoDB" }));
        responseStream.end();
        return;
      }
    }

    // ─── ACTION: CHAT OR SUBAGENT ───
    if (action === "chat" || action === "subagent") {
      // Enforce correct Content-Type for streaming via Lambda Function URL
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        headers: { "Content-Type": "text/event-stream" }
      });

      let activeKey = body.customApiKey;

      // Si el cliente pide usar su llave manejada por AWS, buscarla en DynamoDB
      if (activeKey === "aws-managed") {
        try {
          const result = await docClient.send(new GetCommand({
            TableName: Resource.UserKeys.name,
            Key: {
              id: `${userId}#${providerId}`
            }
          }));

          if (result.Item && result.Item.encryptedKey) {
            activeKey = decrypt(result.Item.encryptedKey as string);
          } else {
            responseStream.write(`data: ${JSON.stringify({ content: "\n\n⛔ **Error del servidor AI:** No tienes una llave guardada en AWS para este proveedor. Ve a Configuración > Proveedores." })}\n\n`);
            responseStream.write(`data: [DONE]\n\n`);
            responseStream.end();
            return;
          }
        } catch (err) {
          console.error("Error buscando la llave:", err);
          responseStream.write(`data: ${JSON.stringify({ content: "\n\n⛔ **Error del servidor AI:** Error recuperando la llave cifrada." })}\n\n`);
          responseStream.write(`data: [DONE]\n\n`);
          responseStream.end();
          return;
        }
      }

      const messages = (body.messages || []).map((msg: IncomingMessage) => {
        if (msg.role === "user" && msg.attachments && msg.attachments.length > 0) {
          const contentParts: ContentPart[] = [];
          let textContent = msg.content || "";
          const imageAttachments: Attachment[] = [];
          
          for (const att of msg.attachments) {
            if (att.contentType.startsWith("image/")) {
              imageAttachments.push(att);
            } else if (att.data.startsWith("http")) {
              // Es una URL de S3 (archivo grande subido)
              contentParts.push({ type: "file", data: att.data, mediaType: att.contentType });
            } else {
              textContent = `\n--- Archivo adjunto: ${att.name} ---\n\`\`\`\n${att.data}\n\`\`\`\n` + textContent;
            }
          }
          
          if (textContent) {
            contentParts.push({ type: "text", text: textContent });
          }
          
          for (const img of imageAttachments) {
            contentParts.push({ type: "image", image: img.data });
          }
          
          if (contentParts.length > 0) {
            return { role: "user" as const, content: contentParts };
          }
        }
        return { role: msg.role, content: msg.content || "" };
      });

      // ─── RATE LIMIT GUARD (PER-PLAN) ───
      const promptLimits: Record<string, number> = { free: 20, estudiante: 100 };
      const dailyPromptLimit = promptLimits[plan] || Infinity;

      if (dailyPromptLimit !== Infinity) {
        const today = new Date().toISOString().split("T")[0];
        try {
          const userResult = await docClient.send(new GetCommand({
            TableName: Resource.Users.name,
            Key: { email: userId }
          }));
          const userData = userResult.Item || { daily_count: 0, last_reset_date: today };
          if (userData.last_reset_date !== today) {
            userData.daily_count = 0;
            userData.last_reset_date = today;
          }
          if (userData.daily_count >= dailyPromptLimit) {
             const upgradeMsg = plan === "free" 
               ? "Mejora a Vibe Estudiante o Vibe Pro para más mensajes."
               : "Mejora a Vibe Pro para uso ilimitado.";
             responseStream.write(`data: ${JSON.stringify({ content: `\n\n⛔ **Has alcanzado tu límite de ${dailyPromptLimit} mensajes diarios.** ${upgradeMsg}` })}\n\n`);
             responseStream.write(`data: [DONE]\n\n`);
             responseStream.end();
             return;
          }
          
          await docClient.send(new UpdateCommand({
            TableName: Resource.Users.name,
            Key: { email: userId },
            UpdateExpression: "SET daily_count = :count, last_reset_date = :date",
            ExpressionAttributeValues: {
              ":count": userData.daily_count + 1,
              ":date": today
            }
          }));
        } catch (err) {
           console.error("Error validando Rate Limit:", err);
        }
      }

      // ─── INTELLIGENT BACKEND ROUTING (PROPUESTA 1) ───
      // Forzamos DeepSeek siempre si el usuario está en el entorno gestionado de AWS
      if (activeKey === "aws-managed") {
         providerId = "deepseek";
      }

      if (plan === "free") {
         providerId = "deepseek";
         modelId = "deepseek-chat-v4";
      } else if (action === "subagent") {
         providerId = "deepseek";
         // Lógica SDD Inteligente Híbrida Cognitiva
         const highCognitivePhases = ["sdd-explore", "sdd-propose", "sdd-design", "sdd-verify"];
         
         if (highCognitivePhases.includes(subagentId)) {
            // Estudiantes y Pro usan R1 (v4) para pensar arquitectura profunda
            modelId = "deepseek-reasoner-v4";
         } else {
            // Fases mecánicas: sdd-spec, sdd-tasks, sdd-apply, sdd-archive
            // V3/V4 es rapidísimo y evita problemas de tags <think> en los diffs
            modelId = "deepseek-chat-v4";
         }
      } else if (!modelId && activeKey !== "aws-managed") {
         // Chat general: inferencia basada en el contenido si no hay modelo explícito
         const contextStr = JSON.stringify(messages).toLowerCase();
         if (contextStr.includes(".go") || contextStr.includes(".py") || contextStr.includes(".ts") || contextStr.includes(".sql") || contextStr.includes("backend") || contextStr.includes("database")) {
            providerId = "deepseek";
            modelId = "deepseek-reasoner-v4";
         } else {
            providerId = "deepseek";
            modelId = "deepseek-chat-v4";
         }
      }

      try {
        let selectedSystemPrompt = action === "subagent" ? (SUBAGENT_PROMPTS[subagentId] || SUBAGENT_PROMPTS["sdd-apply"]) : SYSTEM_PROMPT;
        
        if (action === "subagent" && body.customInstructions) {
          selectedSystemPrompt += `\n\nINSTRUCCIONES PERSONALIZADAS DEL USUARIO:\n${body.customInstructions}`;
        }

        const tools: Record<string, unknown> = {
          read_local_file: {
            description: 'Lee un archivo local de la máquina del usuario para obtener contexto.',
            parameters: z.object({ path: z.string() })
          },
          "mcp_context7_resolve-library-id": {
            description: "Resolves a package/product name to a Context7-compatible library ID and returns matching libraries.",
            parameters: z.object({
              libraryName: z.string().describe("Library name to search for (e.g., 'Next.js', 'React')"),
              query: z.string().describe("The specific question or task you need help with")
            })
          },
          "mcp_context7_query-docs": {
            description: "Retrieves and queries up-to-date documentation and code examples from Context7 for any programming library.",
            parameters: z.object({
              libraryId: z.string().describe("Exact Context7-compatible library ID (e.g., '/vercel/next.js')"),
              query: z.string().describe("The specific question or task you need help with")
            })
          }
        };

        // Herramientas autónomas (Modificación de archivos y ejecución de comandos)
        // disponibles para Vibe Estudiante (con cuota diaria) y Vibe Pro (ilimitado).
        if (action === "subagent" && (plan === "pro" || plan === "estudiante")) {
          // ─── SUBAGENT QUOTA GUARD (ESTUDIANTE: 30/día) ───
          if (plan === "estudiante") {
            const today = new Date().toISOString().split("T")[0];
            try {
              const userResult = await docClient.send(new GetCommand({
                TableName: Resource.Users.name,
                Key: { email: userId }
              }));
              const userData = userResult.Item || { daily_subagent_count: 0, subagent_reset_date: today };
              if (userData.subagent_reset_date !== today) {
                userData.daily_subagent_count = 0;
                userData.subagent_reset_date = today;
              }
              if (userData.daily_subagent_count >= 30) {
                responseStream.write(`data: ${JSON.stringify({ content: "\n\n⛔ **Has alcanzado tu límite de 30 ejecuciones de código diarias.** Vuelve mañana o mejora a Vibe Pro para uso ilimitado." })}\n\n`);
                responseStream.write(`data: [DONE]\n\n`);
                responseStream.end();
                return;
              }
              await docClient.send(new UpdateCommand({
                TableName: Resource.Users.name,
                Key: { email: userId },
                UpdateExpression: "SET daily_subagent_count = :count, subagent_reset_date = :date",
                ExpressionAttributeValues: {
                  ":count": userData.daily_subagent_count + 1,
                  ":date": today
                }
              }));
            } catch (err) {
              console.error("Error validando Subagent Quota:", err);
            }
          }

          tools.write_local_file = {
            description: 'Escribe contenido de código en un archivo local. Úsalo para crear o modificar archivos.',
            parameters: z.object({ 
              path: z.string().describe("La ruta del archivo relativa a la raíz del proyecto"), 
              content: z.string().describe("El código completo a escribir")
            })
          };
          tools.execute_test_command = {
            description: 'Ejecuta vitest o npm test localmente.',
            parameters: z.object({ command: z.string() }),
          };
        }

        const result = streamText({
          model: getModel(providerId, activeKey, modelId),
          system: selectedSystemPrompt,
          messages: messages,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: tools as any // Final cast needed by the AI SDK internal mapping since our tool object structure might lack deep interface matching without specific generics
        });

        let responseBytes = 0;
        responseStream.setContentType("text/event-stream");
        
        for await (const rawChunk of result.fullStream) {
          const chunk = rawChunk as unknown as StreamChunk;
          let chunkStr = "";
          if (chunk.type === 'text-delta') {
            const payload = JSON.stringify({ content: chunk.textDelta || chunk.text || "" });
            chunkStr = `data: ${payload}\n\n`;
            responseStream.write(chunkStr);
          } else if (chunk.type === 'tool-call') {
            const mcpPayload = JSON.stringify({ 
              type: "mcp_tool_request", 
              tool: chunk.toolName, 
              args: chunk.input 
            });
            chunkStr = `data: ${mcpPayload}\n\n`;
            responseStream.write(chunkStr);
          } else if (chunk.type === 'finish') {
            // Monitoreo: Registrar métricas de token y ancho de banda en CloudWatch Logs
            console.info(JSON.stringify({
              type: "VIBE_METRICS",
              action,
              providerId,
              userId,
              requestBytes,
              responseBytes,
              usage: chunk.totalUsage || chunk.usage
            }));
          }
          responseBytes += Buffer.byteLength(chunkStr, 'utf8');
        }
        
        responseStream.write(`data: [DONE]\n\n`);
        responseStream.end();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error desconocido";
        const payload = JSON.stringify({ content: `\n\n⛔ **Error del servidor AI:** ${errorMsg}` });
        responseStream.write(`data: ${payload}\n\n`);
        responseStream.write(`data: [DONE]\n\n`);
        responseStream.end();
      }
    }
  }
);
