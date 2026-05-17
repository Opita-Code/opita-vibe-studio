/**
 * Sync API — Opita Sync Operations Hub Backend
 * 
 * AI-powered operations interface that uses the same streaming engine as Vibe Studio
 * but with server-side admin/operations tools (DynamoDB, Cognito, SES operations).
 * 
 * Key difference from chat.ts:
 * - Tools execute on the BACKEND (not proxied to frontend)
 * - Uses streamText with maxSteps for multi-turn tool execution
 * - Role-based tool filtering
 */

import * as jose from "jose";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getModel } from "./chat.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource as SSTResource } from "sst";

const Resource = SSTResource as unknown as Record<string, { name: string }>;

// ─── Types ──────────────────────────────────────────────────────

type AdminRole = "superadmin" | "product_admin" | "support" | "viewer";

interface AdminContext {
  email: string;
  role: AdminRole;
  plan: string;
  tenantScope?: string; // For tenant-scoped admins
}

// ─── AWS Setup ──────────────────────────────────────────────────

const awsConfig = process.env.LOCALSTACK_ENDPOINT
  ? {
      endpoint: process.env.LOCALSTACK_ENDPOINT,
      region: process.env.AWS_REGION || "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    }
  : {};

const dynamoClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ─── Admin Role Resolution ──────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

function resolveAdminRole(email: string, userRecord?: Record<string, unknown>): AdminRole | null {
  // 1. Superadmin: hardcoded env var (founder access)
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return "superadmin";
  
  // 2. Check DynamoDB user record for role field
  if (userRecord?.admin_role) return userRecord.admin_role as AdminRole;
  
  // 3. Not an admin
  return null;
}

// ─── CORS ───────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://sync.opitacode.com",
  "https://admin.opitacode.com", // Legacy alias
  "http://localhost:5174", // Local dev
  "http://localhost:5175",
];

function getCorsHeaders(event: { headers?: Record<string, string> }) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ─── Admin System Prompt ────────────────────────────────────────

function getSyncSystemPrompt(ctx: AdminContext): string {
  return `Eres Opita Sync, el asistente de operaciones de Opita Code.

## Tu rol
Ayudas a los operadores de Opita Code a gestionar la plataforma: usuarios, planes, 
suscripciones, transacciones, y salud del sistema.

## Contexto del operador
- Email: ${ctx.email}
- Rol: ${ctx.role}
- ${ctx.tenantScope ? `Alcance: Tenant ${ctx.tenantScope}` : "Alcance: Plataforma completa"}

## Reglas
1. Siempre confirma acciones destructivas (cambiar planes, revocar sesiones) antes de ejecutarlas.
2. Muestra datos en tablas markdown cuando hay múltiples resultados.
3. Usa español neutro profesional (NO rioplatense).
4. Sé conciso pero preciso.
5. Si no puedes hacer algo por falta de permisos, explica qué necesita el operador.
6. NUNCA muestres datos sensibles como password hashes o tokens completos.
7. Cuando muestres fechas, usa formato legible (ej: "17 de mayo de 2026, 10:30 AM").

## Herramientas disponibles
Usa las herramientas para consultar y modificar datos. NO inventes datos — siempre consulta primero.
`;
}

// ─── Admin Tools Definition ─────────────────────────────────────

function getAdminTools(ctx: AdminContext) {
  const tools: Record<string, ReturnType<typeof tool>> = {};

  // ── Read-only tools (all admin roles) ──────────────────────

  tools.list_users = tool({
    description: "Lista usuarios de la plataforma con filtros opcionales. Devuelve email, nombre, plan, última conexión, y fechas de trial/suscripción.",
    parameters: z.object({
      plan_filter: z.enum(["all", "free", "estudiante", "pro"]).optional().default("all"),
      limit: z.number().optional().default(25),
      search: z.string().optional().describe("Buscar por email o nombre (parcial)"),
    }),
    execute: async ({ plan_filter, limit, search }) => {
      const params: Record<string, unknown> = {
        TableName: Resource.Users.name,
        Limit: Math.min(limit, 100),
      };

      if (plan_filter && plan_filter !== "all") {
        params.FilterExpression = "#plan = :plan";
        params.ExpressionAttributeNames = { "#plan": "plan" };
        params.ExpressionAttributeValues = { ":plan": plan_filter };
      }

      const result = await docClient.send(new ScanCommand(params as any));
      let users = (result.Items || []).map((u: any) => ({
        email: u.email,
        name: u.name || "—",
        plan: u.plan || "free",
        last_login: u.last_login || "Nunca",
        created_at: u.created_at || "—",
        trial_ends_at: u.trial_ends_at || null,
        subscription_ends_at: u.subscription_ends_at || null,
        cognito_sub: u.cognito_sub ? "✓" : "✗",
        admin_role: u.admin_role || null,
      }));

      // Client-side search filter (DynamoDB Scan doesn't support contains on hash key)
      if (search) {
        const q = search.toLowerCase();
        users = users.filter(
          (u: any) => u.email.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q))
        );
      }

      return {
        total_scanned: result.ScannedCount || 0,
        total_returned: users.length,
        users,
      };
    },
  });

  tools.get_user = tool({
    description: "Obtiene el detalle completo de un usuario por su email. Incluye plan, fechas, uso de tokens, y estado de sesión.",
    parameters: z.object({
      email: z.string().email().describe("Email del usuario a consultar"),
    }),
    execute: async ({ email }) => {
      const result = await docClient.send(
        new GetCommand({ TableName: Resource.Users.name, Key: { email } })
      );

      if (!result.Item) return { error: `Usuario ${email} no encontrado.` };

      const u = result.Item;
      return {
        email: u.email,
        name: u.name || "—",
        plan: u.plan || "free",
        has_password: !!u.password_hash,
        cognito_sub: u.cognito_sub || null,
        created_at: u.created_at || "—",
        last_login: u.last_login || "Nunca",
        trial_ends_at: u.trial_ends_at || null,
        subscription_ends_at: u.subscription_ends_at || null,
        daily_subagent_count: u.daily_subagent_count || 0,
        admin_role: u.admin_role || null,
      };
    },
  });

  tools.get_usage_overview = tool({
    description: "Muestra un resumen del uso de tokens de la plataforma o de un usuario específico.",
    parameters: z.object({
      email: z.string().optional().describe("Email del usuario (omitir para overview global)"),
    }),
    execute: async ({ email }) => {
      if (email) {
        // Per-user usage
        const today = new Date().toISOString().split("T")[0];
        const hour = new Date().toISOString().slice(0, 13);
        const pk = `user#${email}`;

        const [dailyResult, hourlyResult] = await Promise.all([
          docClient.send(new GetCommand({
            TableName: Resource.TokenUsage.name,
            Key: { pk, sk: `daily#${today}` },
          })),
          docClient.send(new GetCommand({
            TableName: Resource.TokenUsage.name,
            Key: { pk, sk: `hourly#${hour}` },
          })),
        ]);

        return {
          email,
          daily_tokens_used: dailyResult.Item?.tokensUsed || 0,
          hourly_tokens_used: hourlyResult.Item?.tokensUsed || 0,
          date: today,
          hour,
        };
      }

      // Global overview: count users by plan
      const scanResult = await docClient.send(new ScanCommand({
        TableName: Resource.Users.name,
        ProjectionExpression: "#p",
        ExpressionAttributeNames: { "#p": "plan" },
      }));

      const planCounts: Record<string, number> = { free: 0, estudiante: 0, pro: 0 };
      for (const item of scanResult.Items || []) {
        const plan = (item as any).plan || "free";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      }

      return {
        total_users: scanResult.ScannedCount || 0,
        by_plan: planCounts,
      };
    },
  });

  tools.list_transactions = tool({
    description: "Lista las transacciones de pago registradas.",
    parameters: z.object({
      limit: z.number().optional().default(20),
    }),
    execute: async ({ limit }) => {
      const result = await docClient.send(new ScanCommand({
        TableName: Resource.Transactions.name,
        Limit: Math.min(limit, 50),
      }));

      return {
        total: result.ScannedCount || 0,
        transactions: (result.Items || []).map((t: any) => ({
          id: t.id,
          email: t.email || t.userId || "—",
          amount: t.amount,
          currency: t.currency || "COP",
          status: t.status,
          product: t.product,
          created_at: t.created_at || t.timestamp || "—",
        })),
      };
    },
  });

  tools.system_health = tool({
    description: "Muestra métricas de salud del sistema: conteo de tablas, items, y estado general.",
    parameters: z.object({}),
    execute: async () => {
      const tables = ["Users", "Projects", "Conversations", "Transactions", "TokenUsage", "UserKeys"];
      const counts: Record<string, number> = {};

      for (const table of tables) {
        try {
          const result = await docClient.send(new ScanCommand({
            TableName: (Resource as any)[table]?.name,
            Select: "COUNT",
          }));
          counts[table] = result.Count || 0;
        } catch {
          counts[table] = -1; // Table not accessible
        }
      }

      return {
        timestamp: new Date().toISOString(),
        tables: counts,
        environment: process.env.SST_STAGE || "unknown",
      };
    },
  });

  // ── Write tools (superadmin and product_admin only) ────────

  if (ctx.role === "superadmin" || ctx.role === "product_admin") {
    tools.update_user_plan = tool({
      description: "Cambia el plan de un usuario. SIEMPRE confirma con el admin antes de ejecutar.",
      parameters: z.object({
        email: z.string().email(),
        new_plan: z.enum(["free", "estudiante", "pro"]),
        trial_days: z.number().optional().describe("Si se establece, configura un trial de N días"),
      }),
      execute: async ({ email, new_plan, trial_days }) => {
        const updateExpr = ["#plan = :plan", "last_modified_by = :admin"];
        const exprValues: Record<string, unknown> = {
          ":plan": new_plan,
          ":admin": ctx.email,
        };
        const exprNames: Record<string, string> = { "#plan": "plan" };

        if (trial_days) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + trial_days);
          updateExpr.push("trial_ends_at = :trial");
          exprValues[":trial"] = trialEnd.toISOString();
        }

        await docClient.send(new UpdateCommand({
          TableName: Resource.Users.name,
          Key: { email },
          UpdateExpression: `SET ${updateExpr.join(", ")}`,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
          ConditionExpression: "attribute_exists(email)",
        }));

        return {
          success: true,
          email,
          new_plan,
          trial_days: trial_days || null,
          modified_by: ctx.email,
        };
      },
    });

    tools.set_admin_role = tool({
      description: "Asigna o revoca un rol de administrador a un usuario. Solo superadmin puede usar esto.",
      parameters: z.object({
        email: z.string().email(),
        role: z.enum(["superadmin", "product_admin", "support", "viewer"]).nullable()
          .describe("El rol a asignar. null para revocar."),
      }),
      execute: async ({ email, role }) => {
        if (ctx.role !== "superadmin") {
          return { error: "Solo superadmin puede asignar roles." };
        }

        if (role) {
          await docClient.send(new UpdateCommand({
            TableName: Resource.Users.name,
            Key: { email },
            UpdateExpression: "SET admin_role = :role",
            ExpressionAttributeValues: { ":role": role },
            ConditionExpression: "attribute_exists(email)",
          }));
        } else {
          await docClient.send(new UpdateCommand({
            TableName: Resource.Users.name,
            Key: { email },
            UpdateExpression: "REMOVE admin_role",
            ConditionExpression: "attribute_exists(email)",
          }));
        }

        return { success: true, email, role: role || "revoked" };
      },
    });
  }

  return tools;
}

// ─── JWT Verification (shared with chat.ts) ─────────────────────

const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_LItAcj2Aa";
const JWKS = jose.createRemoteJWKSet(new URL(`${COGNITO_ISSUER}/.well-known/jwks.json`));

async function verifyToken(token: string): Promise<{ email: string; plan: string } | null> {
  try {
    const decoded = await jose.jwtVerify(token, JWKS, { issuer: COGNITO_ISSUER });
    return {
      email: (decoded.payload.email || decoded.payload.sub || "") as string,
      plan: (decoded.payload["custom:plan"] as string) || "free",
    };
  } catch {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
      const decoded = await jose.jwtVerify(token, secret);
      return {
        email: (decoded.payload.sub || decoded.payload.email || "") as string,
        plan: (decoded.payload.plan || "free") as string,
      };
    } catch {
      return null;
    }
  }
}

// ─── Lambda Handler ─────────────────────────────────────────────

interface AWSTypes {
  streamifyResponse: (
    handler: (
      event: { headers?: Record<string, string>; body?: string; requestContext?: any },
      responseStream: NodeJS.WritableStream & { setContentType: (type: string) => void },
      context: unknown
    ) => Promise<void>
  ) => unknown;
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      options: { headers: Record<string, string> }
    ) => NodeJS.WritableStream & { setContentType: (type: string) => void; write: (data: string | Uint8Array) => void; end: () => void };
  };
}
declare const awslambda: AWSTypes;

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    // ── CORS Preflight ──
    const method = event.requestContext?.http?.method || "POST";
    if (method === "OPTIONS") {
      responseStream.setContentType("application/json");
      const optStream = awslambda.HttpResponseStream.from(responseStream, {
        headers: { ...getCorsHeaders(event), "Content-Type": "application/json" },
      });
      optStream.write("{}");
      optStream.end();
      return;
    }

    // ── Auth ──
    const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
    let token = authHeader.split(" ")[1];
    if (!token) {
      const cookies = event.headers?.cookie || event.headers?.Cookie || "";
      const match = cookies.match(/opita_session=([^;]+)/);
      if (match) token = match[1];
    }
    if (!token) {
      const cookies = event.headers?.cookie || event.headers?.Cookie || "";
      const match = cookies.match(/opita_id_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "No autorizado" }));
      responseStream.end();
      return;
    }

    const identity = await verifyToken(token);
    if (!identity || !identity.email) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Token inválido" }));
      responseStream.end();
      return;
    }

    // ── Resolve admin role ──
    const userResult = await docClient.send(
      new GetCommand({ TableName: Resource.Users.name, Key: { email: identity.email } })
    );
    const role = resolveAdminRole(identity.email, userResult.Item as any);

    if (!role) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Acceso denegado. No tienes permisos de administrador." }));
      responseStream.end();
      return;
    }

    // ── Parse request ──
    let body: { action?: string; messages?: any[] };
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }

    const action = body.action || "chat";

    // ── Action: whoami ──
    if (action === "whoami") {
      responseStream.setContentType("application/json");
      const whoamiStream = awslambda.HttpResponseStream.from(responseStream, {
        headers: { ...getCorsHeaders(event), "Content-Type": "application/json" },
      });
      whoamiStream.write(JSON.stringify({
        email: identity.email,
        role,
        plan: identity.plan,
      }));
      whoamiStream.end();
      return;
    }

    // ── Action: chat (streaming admin agent) ──
    if (action === "chat") {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          ...getCorsHeaders(event),
        },
      });

      const adminCtx: AdminContext = {
        email: identity.email,
        role,
        plan: identity.plan,
      };

      const messages = (body.messages || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content || "",
      }));

      try {
        const adminTools = getAdminTools(adminCtx);

        const result = streamText({
          model: getModel("gemini", undefined, "gemini-2.5-flash"),
          system: getSyncSystemPrompt(adminCtx),
          messages,
          tools: adminTools,
          maxSteps: 5, // Allow multi-turn tool execution
        });

        for await (const chunk of result.fullStream) {
          const c = chunk as any;
          if (c.type === "text-delta") {
            responseStream.write(`data: ${JSON.stringify({ content: c.textDelta || "" })}\n\n`);
          } else if (c.type === "reasoning") {
            responseStream.write(`data: ${JSON.stringify({ type: "reasoning", content: c.textDelta || c.text || c.reasoning || "" })}\n\n`);
          } else if (c.type === "tool-call") {
            responseStream.write(`data: ${JSON.stringify({
              type: "tool_call",
              tool: c.toolName,
              args: c.args,
            })}\n\n`);
          } else if (c.type === "tool-result") {
            responseStream.write(`data: ${JSON.stringify({
              type: "tool_result",
              tool: c.toolName,
              result: c.result,
            })}\n\n`);
          }
        }

        responseStream.write(`data: [DONE]\n\n`);
        responseStream.end();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error desconocido";
        responseStream.write(`data: ${JSON.stringify({ content: `\n\n⛔ **Error:** ${errorMsg}` })}\n\n`);
        responseStream.write(`data: [DONE]\n\n`);
        responseStream.end();
      }
    }
  }
);
