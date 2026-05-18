import * as jose from "jose";
import { streamText, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getEffectiveQuota } from "./gamification.js";
import * as crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

// ─── Constants & Setup ───────────────────────────────────────── (deployed 2026-05-14T17:42)

// System prompts are composed by the frontend (src/agent/prompts.ts) and sent
// as the first system message. The backend is a streaming proxy — it does NOT
// maintain its own prompts. This eliminates the dual source of truth problem.
//
// The frontend calls getSystemPrompt({ intent, testRunner, ... }) and sends
// the composed prompt as part of the conversation context.

// Legacy fallback — used ONLY if the frontend doesn't send a system message.
const FALLBACK_SYSTEM_PROMPT = `Eres Aura, la asistente de desarrollo de Vibe Studio. Responde de forma concisa y profesional en español.`;

const awsConfig = process.env.LOCALSTACK_ENDPOINT ? {
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
} : {};

const dynamoClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ─── Encryption Helpers ────────────────────────────────────────

// BYOK Encryption: prefer dedicated key, fallback to JWT_SECRET for backward compat.
// WARNING: If BYOK_ENCRYPTION_KEY is not set, BYOK keys share the same secret as JWTs.
const ENCRYPTION_KEY = process.env.BYOK_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
if (!process.env.BYOK_ENCRYPTION_KEY) {
  console.warn("[SECURITY] BYOK_ENCRYPTION_KEY not set — falling back to JWT_SECRET for BYOK encryption. Set a dedicated key in production.");
}
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

// ─── Token Quota System ───────────────────────────────────────

const TOKEN_QUOTAS: Record<string, { daily: number; hourly: number }> = {
  free:       { daily: 150_000,   hourly: 30_000 },
  estudiante: { daily: 250_000,   hourly: 60_000 },
  pro:        { daily: 1_000_000, hourly: 200_000 },
};

// ─── Per-Model RPM Limits (requests per minute per user) ─────
// Prevents any single user from burning through provider RPM quotas.
// These are per-user limits — Google Cloud's global RPM is ~2000.
const MODEL_RPM_LIMITS: Record<string, Record<string, number>> = {
  free: {
    "gemini-2.5-flash": 6,
    "deepseek-chat": 6,
    "deepseek-v4-flash": 6,
    "deepseek-reasoner": 3,
    "*": 5, // default for unknown models
  },
  estudiante: {
    "gemini-2.5-flash": 12,
    "deepseek-chat": 12,
    "deepseek-v4-flash": 12,
    "deepseek-v4-pro": 8,
    "deepseek-reasoner": 5,
    "*": 10,
  },
  pro: {
    "gemini-2.5-flash": 25,
    "deepseek-chat": 25,
    "deepseek-v4-flash": 25,
    "deepseek-v4-pro": 15,
    "deepseek-reasoner": 10,
    "*": 20,
  },
};

interface QuotaResult {
  allowed: boolean;
  degraded?: boolean;       // true = Pro forced to V4-Flash
  dailyUsed: number;
  hourlyUsed: number;
  dailyLimit: number;
  hourlyLimit: number;
  cooldownSeconds?: number; // seconds until next window reset
  exceededWindow?: "hourly" | "daily";
}

async function checkQuota(userId: string, plan: string): Promise<QuotaResult> {
  const baseQuota = TOKEN_QUOTAS[plan] || TOKEN_QUOTAS.pro;
  
  // Read earned quota from gamification system (missions, streaks, milestones)
  const effectiveDailyQuota = await getEffectiveQuota(userId, plan);
  const dailyLimit = Math.max(baseQuota.daily, effectiveDailyQuota);
  
  const now = new Date();
  const dailyKey = `daily#${now.toISOString().split("T")[0]}`;
  const hourlyKey = `hourly#${now.toISOString().slice(0, 13)}`; // "2026-05-14T22"
  const pk = `user#${userId}`;

  // Batch read daily + hourly counters
  const [dailyResult, hourlyResult] = await Promise.all([
    docClient.send(new GetCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: dailyKey },
    })),
    docClient.send(new GetCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: hourlyKey },
    })),
  ]);

  const dailyUsed = (dailyResult.Item?.tokensUsed as number) || 0;
  const hourlyUsed = (hourlyResult.Item?.tokensUsed as number) || 0;

  const base: Omit<QuotaResult, "allowed"> = {
    dailyUsed,
    hourlyUsed,
    dailyLimit,
    hourlyLimit: baseQuota.hourly,
  };

  // Check hourly limit first (tighter window)
  if (hourlyUsed >= baseQuota.hourly) {
    if (plan === "pro") {
      return { ...base, allowed: true, degraded: true };
    }
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return {
      ...base,
      allowed: false,
      exceededWindow: "hourly",
      cooldownSeconds: Math.ceil((nextHour.getTime() - now.getTime()) / 1000),
    };
  }

  // Check daily limit (uses effective quota with gamification bonuses)
  if (dailyUsed >= dailyLimit) {
    if (plan === "pro") {
      return { ...base, allowed: true, degraded: true };
    }
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return {
      ...base,
      allowed: false,
      exceededWindow: "daily",
      cooldownSeconds: Math.ceil((tomorrow.getTime() - now.getTime()) / 1000),
    };
  }

  return { ...base, allowed: true };
}

/** Per-model RPM guard — returns seconds to wait if over limit, 0 if OK */
async function checkModelRPM(userId: string, plan: string, modelId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const planLimits = MODEL_RPM_LIMITS[plan] || MODEL_RPM_LIMITS.free;
  const rpm = planLimits[modelId] ?? planLimits["*"] ?? 5;

  const now = new Date();
  const minuteKey = `rpm#${now.toISOString().slice(0, 16)}`; // "2026-05-17T21:18"
  const pk = `user#${userId}`;

  try {
    const result = await docClient.send(new GetCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: minuteKey },
    }));

    const currentCount = (result.Item?.requestCount as number) || 0;

    if (currentCount >= rpm) {
      // Calculate seconds until next minute
      const nextMinute = new Date(now);
      nextMinute.setSeconds(0, 0);
      nextMinute.setMinutes(nextMinute.getMinutes() + 1);
      return { allowed: false, retryAfterSeconds: Math.ceil((nextMinute.getTime() - now.getTime()) / 1000) };
    }

    // Increment counter atomically
    await docClient.send(new UpdateCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: minuteKey },
      UpdateExpression: "ADD requestCount :one SET expiresAt = if_not_exists(expiresAt, :ttl)",
      ExpressionAttributeValues: {
        ":one": 1,
        ":ttl": Math.floor(now.getTime() / 1000) + 120, // TTL: 2 minutes
      },
    }));

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    console.error("[RPM] Error checking rate limit:", err);
    // Fail open — don't block users on DynamoDB errors
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

async function recordUsage(userId: string, tokensUsed: number): Promise<void> {
  const now = new Date();
  const dailyKey = `daily#${now.toISOString().split("T")[0]}`;
  const hourlyKey = `hourly#${now.toISOString().slice(0, 13)}`;
  const pk = `user#${userId}`;

  // TTL: daily = 7 days from now, hourly = 25 hours from now
  const dailyTTL = Math.floor(now.getTime() / 1000) + 7 * 24 * 60 * 60;
  const hourlyTTL = Math.floor(now.getTime() / 1000) + 25 * 60 * 60;

  await Promise.all([
    docClient.send(new UpdateCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: dailyKey },
      UpdateExpression: "ADD tokensUsed :tokens SET expiresAt = if_not_exists(expiresAt, :ttl)",
      ExpressionAttributeValues: {
        ":tokens": tokensUsed,
        ":ttl": dailyTTL,
      },
    })),
    docClient.send(new UpdateCommand({
      TableName: Resource.TokenUsage.name,
      Key: { pk, sk: hourlyKey },
      UpdateExpression: "ADD tokensUsed :tokens SET expiresAt = if_not_exists(expiresAt, :ttl)",
      ExpressionAttributeValues: {
        ":tokens": tokensUsed,
        ":ttl": hourlyTTL,
      },
    })),
  ]);
}

// ─── Provider Setup ────────────────────────────────────────────

// API_GOOGLE_CLOUD (paid Google Cloud, ~2000 RPM) is the primary key.
// AI_STUDIO_GOOGLE and GEMINI_API_KEY are legacy free-tier aliases (15 RPM).
const GOOGLE_AI_KEY = process.env.API_GOOGLE_CLOUD || process.env.AI_STUDIO_GOOGLE || process.env.GEMINI_API_KEY || "";
const HAS_GOOGLE_AI = GOOGLE_AI_KEY.length > 0;
const HAS_DEEPSEEK = (process.env.DEEP_SEEK_KEY || "").length > 0;

export function getModel(providerId: string, customApiKey?: string, explicitModelId?: string) {
  switch (providerId) {
    case "openai":
    case "chatgpt-web": {
      // Use .chat() to force Chat Completions API (not Responses API)
      const openai = createOpenAI({ apiKey: customApiKey || process.env.OPENAI_API_KEY });
      return openai.chat(explicitModelId || "gpt-4o");
    }
    case "deepseek": {
      // DeepSeek: MUST use .chat() — does NOT support /responses endpoint
      const deepseek = createOpenAI({
        apiKey: customApiKey || process.env.DEEP_SEEK_KEY,
        baseURL: "https://api.deepseek.com",
      });
      return deepseek.chat(explicitModelId || "deepseek-chat");
    }
    case "openrouter": {
      // OpenRouter: MUST use .chat() — only supports /chat/completions
      const openrouter = createOpenAI({
        apiKey: customApiKey || process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
      });
      return openrouter.chat(explicitModelId || "google/gemini-2.5-flash");
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: customApiKey || GOOGLE_AI_KEY });
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
  reasoning?: string;
  toolName?: string;
  input?: unknown;
  totalUsage?: unknown;
  usage?: unknown;
}

// ─── Lambda Handler ────────────────────────────────────────────

export const handler = awslambda.streamifyResponse(
  async (event: { headers?: Record<string, string>; body?: string }, responseStream: NodeJS.WritableStream & { setContentType: (type: string) => void; write: (data: string | Uint8Array) => void; end: () => void }, _context: unknown) => {
    // 1. JWT Validation — Multi-source token extraction
    // Bearer token has priority, but if it fails verification, fall back to cookie.
    const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
    const bearerToken = authHeader.split(" ")[1] || "";
    
    // Extract cookie token (always, as fallback)
    const cookies = event.headers?.cookie || event.headers?.Cookie || "";
    const cookieMatch = cookies.match(/opita_session=([^;]+)/);
    const cookieToken = cookieMatch?.[1] || "";
    
    // Token candidates: try bearer first, then cookie
    const tokenCandidates = [bearerToken, cookieToken].filter(Boolean);

    if (tokenCandidates.length === 0) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Falta token Bearer o cookie" }));
      responseStream.end();
      return;
    }

    // ─── JWT Verification (Cognito JWKS + Legacy HMAC fallback) ───
    const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_LItAcj2Aa";
    const JWKS = jose.createRemoteJWKSet(new URL(`${COGNITO_ISSUER}/.well-known/jwks.json`));

    let userId = "guest";
    let plan = "free";
    let tokenVerified = false;

    for (const token of tokenCandidates) {
      try {
        // Try Cognito JWKS first (RSA signed tokens)
        const decoded = await jose.jwtVerify(token, JWKS, {
          issuer: COGNITO_ISSUER,
        });
        userId = (decoded.payload.email || decoded.payload.sub || "guest") as string;
        plan = (decoded.payload["custom:plan"] as string) || "free";
        tokenVerified = true;
        break;
      } catch {
        // Fallback: try legacy HMAC verification (Magic Link session tokens)
        try {
          const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
          const decoded = await jose.jwtVerify(token, secret);
          userId = (decoded.payload.sub || decoded.payload.email || "guest") as string;
          plan = (decoded.payload.plan || "free") as string;
          tokenVerified = true;
          break;
        } catch {
          // This candidate failed — try next one
        }
      }
    }

    if (!tokenVerified) {
      console.error("JWT verification failed for all token sources (Bearer + cookie)");
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

    // ─── TOKEN QUOTA GUARD ───
    const quotaCheck = await checkQuota(userId, plan);

    if (!quotaCheck.allowed) {
      const windowLabel = quotaCheck.exceededWindow === "hourly" ? "por hora" : "diario";
      const minutes = Math.ceil((quotaCheck.cooldownSeconds || 0) / 60);
      const timeLabel = minutes >= 60 
        ? `${Math.ceil(minutes / 60)} hora${Math.ceil(minutes / 60) > 1 ? "s" : ""}`
        : `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({
        error: "quota_exceeded",
        message: `Has alcanzado tu límite ${windowLabel} de tokens. Se renueva en ${timeLabel}.`,
        cooldownSeconds: quotaCheck.cooldownSeconds,
        tokensUsed: quotaCheck.exceededWindow === "hourly" ? quotaCheck.hourlyUsed : quotaCheck.dailyUsed,
        tokensLimit: quotaCheck.exceededWindow === "hourly" ? quotaCheck.hourlyLimit : quotaCheck.dailyLimit,
      }));
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

      // Token quota pre-check ya se realizó arriba (quotaCheck)
      // Si Pro fue degradado, forzar V4-Flash
      let quotaDegraded = quotaCheck.degraded || false;

      // ─── INTELLIGENT BACKEND ROUTING ───
      // Routes requests to the best available backend-managed provider.
      // Priority: Google AI Studio (free tier, generous limits) > DeepSeek
      if (activeKey === "aws-managed") {
         providerId = "deepseek";
      }

      if (plan === "free") {
         // Free users: Gemini Flash (free tier) as primary, DeepSeek as fallback
         if (HAS_GOOGLE_AI) {
            providerId = "gemini";
            modelId = "gemini-2.5-flash";
         } else if (HAS_DEEPSEEK) {
            providerId = "deepseek";
            modelId = "deepseek-v4-flash";
         }
      } else if (quotaDegraded) {
         // Pro degradado por quota: Gemini Flash (más económico) > DeepSeek Flash
         if (HAS_GOOGLE_AI) {
            providerId = "gemini";
            modelId = "gemini-2.5-flash";
         } else {
            providerId = "deepseek";
            modelId = "deepseek-v4-flash";
         }
      } else if (action === "subagent") {
         // SDD Inteligente: cognitive-heavy phases get premium models
         const highCognitivePhases = ["sdd-explore", "sdd-propose", "sdd-design", "sdd-verify"];
         
         if (plan === "pro" && highCognitivePhases.includes(subagentId)) {
            providerId = "deepseek";
            modelId = "deepseek-v4-pro";
         } else if (plan === "estudiante" && HAS_GOOGLE_AI) {
            // Estudiantes: Gemini Flash para fases mecánicas (ahorra tokens DeepSeek)
            providerId = "gemini";
            modelId = "gemini-2.5-flash";
         } else {
            providerId = "deepseek";
            modelId = "deepseek-v4-flash";
         }
      } else if (!modelId && activeKey !== "aws-managed") {
         // Chat general: Pro gets smart routing, others get Gemini/DeepSeek
         const contextStr = JSON.stringify(messages).toLowerCase();
         if (plan === "pro" && (contextStr.includes(".go") || contextStr.includes(".py") || contextStr.includes(".ts") || contextStr.includes(".sql") || contextStr.includes("backend") || contextStr.includes("database"))) {
            providerId = "deepseek";
            modelId = "deepseek-v4-pro";
         } else if (HAS_GOOGLE_AI) {
            providerId = "gemini";
            modelId = "gemini-2.5-flash";
         } else {
            providerId = "deepseek";
            modelId = "deepseek-v4-flash";
         }
      }

      // ─── PER-MODEL RPM GUARD ───
      // Check AFTER routing so we know the final modelId
      const effectiveModel = modelId || "unknown";
      const rpmCheck = await checkModelRPM(userId, plan, effectiveModel);
      if (!rpmCheck.allowed) {
        responseStream.write(`data: ${JSON.stringify({
          content: `\n\n⏳ **Límite de velocidad alcanzado.** Estás enviando mensajes muy rápido. Espera ${rpmCheck.retryAfterSeconds} segundo${rpmCheck.retryAfterSeconds !== 1 ? "s" : ""} e intenta de nuevo.`
        })}\n\n`);
        responseStream.write(`data: [DONE]\n\n`);
        responseStream.end();
        return;
      }

      try {
        // System prompt: the frontend composes and sends it as the first system message.
        // We only use a fallback if no system message is present in the conversation.
        let selectedSystemPrompt = FALLBACK_SYSTEM_PROMPT;
        
        // AI SDK v6: system messages MUST go in the `system` param, not messages[].
        // Extract the frontend-composed system message and promote it to the system param.
        const systemMsg = messages.find(
          (m: { role: string }) => m.role === "system"
        );
        
        if (systemMsg && systemMsg.content) {
          // Frontend-composed prompt — extract it for the system param
          selectedSystemPrompt = typeof systemMsg.content === "string" ? systemMsg.content : FALLBACK_SYSTEM_PROMPT;
        }

        // Enviar warning de degradación si aplica
        if (quotaDegraded) {
          selectedSystemPrompt += "\n\n[SISTEMA: Estás operando en modo optimizado por límite de quota del usuario. Usa respuestas concisas.]";
        }

        // ─── TOOL DEFINITIONS ───
        // All tools the LLM can invoke. Uses jsonSchema() because Zod v4
        // generates schemas with type:null which DeepSeek rejects.
        //
        // Tools are "client-executed": the backend registers them so the LLM
        // knows they exist, but execution happens on the frontend. The backend
        // forwards tool_call events via SSE with toolCallId so the frontend
        // can return results in a follow-up request.

        // ── Base tools (all plans) ──────────────────────────────────────
        const tools: Record<string, unknown> = {
          read_file: {
            description: 'Lee un archivo del proyecto para analizarlo. Retorna el contenido completo del archivo.',
            inputSchema: jsonSchema({
              type: "object",
              properties: { path: { type: "string", description: "Ruta relativa al archivo dentro del proyecto" } },
              required: ["path"]
            })
          },
          list_files: {
            description: 'Explora la estructura de directorios del proyecto. Retorna un árbol de archivos.',
            inputSchema: jsonSchema({
              type: "object",
              properties: { path: { type: "string", description: "Directorio a explorar (vacío = raíz del proyecto)" } },
              required: []
            })
          },
          search_code: {
            description: 'Busca texto o patrones en todos los archivos del proyecto. Úsalo ANTES de leer archivos completos para encontrar exactamente lo que necesitas.',
            inputSchema: jsonSchema({
              type: "object",
              properties: {
                query: { type: "string", description: "Texto a buscar" },
                path: { type: "string", description: "Subdirectorio para filtrar la búsqueda" }
              },
              required: ["query"]
            })
          },
          memory_search: {
            description: 'Busca en la memoria del proyecto: decisiones previas, patrones, bugs resueltos, convenciones. Úsalo ANTES de responder para recordar contexto.',
            inputSchema: jsonSchema({
              type: "object",
              properties: { query: { type: "string", description: "Término de búsqueda" } },
              required: ["query"]
            })
          },
          memory_save: {
            description: 'Guarda un aprendizaje, decisión, o convención importante para recordar en el futuro.',
            inputSchema: jsonSchema({
              type: "object",
              properties: {
                title: { type: "string", description: "Título corto y buscable" },
                content: { type: "string", description: "Detalle del aprendizaje o decisión" },
                type: { type: "string", description: "Tipo: decision | pattern | bugfix | discovery | convention" }
              },
              required: ["title", "content"]
            })
          },
        };

        // ── Write/execute tools (Estudiante + Pro only) ─────────────────
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

          tools.write_file = {
            description: 'Crea o sobreescribe un archivo completo en el proyecto. SIEMPRE lee el archivo primero con read_file.',
            inputSchema: jsonSchema({
              type: "object",
              properties: {
                path: { type: "string", description: "Ruta relativa del archivo" },
                content: { type: "string", description: "Contenido completo del archivo" }
              },
              required: ["path", "content"]
            })
          };
          tools.apply_diff = {
            description: 'Aplica un cambio parcial a un archivo existente. SIEMPRE lee el archivo antes con read_file. El texto de búsqueda debe ser EXACTO.',
            inputSchema: jsonSchema({
              type: "object",
              properties: {
                path: { type: "string", description: "Ruta del archivo" },
                search: { type: "string", description: "Texto EXACTO a reemplazar (debe coincidir exactamente con el contenido actual)" },
                replace: { type: "string", description: "Texto de reemplazo" }
              },
              required: ["path", "search", "replace"]
            })
          };
          tools.delete_file = {
            description: 'Elimina un archivo del proyecto. Se crea un snapshot automático antes de eliminar.',
            inputSchema: jsonSchema({
              type: "object",
              properties: { path: { type: "string", description: "Ruta del archivo a eliminar" } },
              required: ["path"]
            })
          };
          tools.execute_command = {
            description: 'Ejecuta un comando en la terminal del proyecto: tests, instalar paquetes, builds, linters, type-check.',
            inputSchema: jsonSchema({
              type: "object",
              properties: {
                command: { type: "string", description: "Comando a ejecutar (e.g., npm test, npx tsc --noEmit, npm install X)" },
                cwd: { type: "string", description: "Directorio de trabajo relativo (opcional)" }
              },
              required: ["command"]
            })
          };
        }

        // AI SDK v6: system messages MUST go in the `system` param, not in messages[].
        // Filter them out to prevent InvalidPromptError and double-system conflicts.
        // Also filter empty assistant messages from stale conversation history.
        const cleanMessages = messages.filter(
          (m: { role: string; content: unknown }) =>
            m.role !== "system" &&
            !(m.role === "assistant" && (!m.content || m.content === ""))
        );

        // Diagnostic: log message stats for debugging production issues
        console.info(JSON.stringify({
          type: "VIBE_DEBUG",
          rawCount: messages.length,
          cleanCount: cleanMessages.length,
          roles: cleanMessages.map((m: { role: string }) => m.role),
          providerId,
          modelId,
          systemPromptLen: selectedSystemPrompt.length,
        }));

        if (cleanMessages.length === 0) {
          responseStream.write(`data: ${JSON.stringify({ content: "⚠️ No hay mensajes válidos para procesar. Intenta enviar un mensaje nuevo." })}\n\n`);
          responseStream.write(`data: [DONE]\n\n`);
          responseStream.end();
          return;
        }

        const result = streamText({
          model: getModel(providerId, activeKey, modelId),
          system: selectedSystemPrompt,
          messages: cleanMessages,
          allowSystemInMessages: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: tools as any,
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
          } else if (chunk.type === 'reasoning') {
            const payload = JSON.stringify({ type: "reasoning", content: chunk.textDelta || chunk.text || chunk.reasoning || "" });
            chunkStr = `data: ${payload}\n\n`;
            responseStream.write(chunkStr);
          } else if (chunk.type === 'tool-call') {
            // Include toolCallId for proper ReAct loop — the frontend needs
            // this to send back tool results that the AI SDK can match.
            const tcChunk = chunk as unknown as { toolCallId?: string; toolName?: string; input?: unknown };
            const mcpPayload = JSON.stringify({ 
              type: "mcp_tool_request", 
              tool: tcChunk.toolName, 
              toolCallId: tcChunk.toolCallId || `call-${Date.now()}`,
              args: tcChunk.input 
            });
            chunkStr = `data: ${mcpPayload}\n\n`;
            responseStream.write(chunkStr);
          } else if (chunk.type === 'finish') {
            // Calcular tokens totales y registrar en TokenUsage
            const usage = (chunk.totalUsage || chunk.usage) as { totalTokens?: number; promptTokens?: number; completionTokens?: number } | undefined;
            const totalTokens = usage?.totalTokens || ((usage?.promptTokens || 0) + (usage?.completionTokens || 0));
            
            if (totalTokens > 0) {
              try {
                await recordUsage(userId, totalTokens);
              } catch (err) {
                console.error("Error registrando uso de tokens:", err);
              }
            }

            // Monitoreo: Registrar métricas de token y ancho de banda en CloudWatch Logs
            console.info(JSON.stringify({
              type: "VIBE_METRICS",
              action,
              providerId,
              modelId,
              userId,
              plan,
              requestBytes,
              responseBytes,
              totalTokens,
              quotaDegraded,
              usage,
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
