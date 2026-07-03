import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Resource as SSTResource } from "sst";
import * as jose from "jose";
import { randomUUID } from "crypto";
import { getProfile, getMissions, completeMission, awardXP } from "./gamification.js";
import { cuentasClient, CircuitOpenError as CuentasCircuitOpenError, parseOpitaClaims, type OpitaClaims } from "@opita/cuentas-client";

// Re-export shared types for backward compat with callers
export type { OpitaClaims };

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is not set");
}

// ─── Cognito Plan Extraction (source of truth) ─────────────────
const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_LItAcj2Aa";
const JWKS = jose.createRemoteJWKSet(new URL(`${COGNITO_ISSUER}/.well-known/jwks.json`));

async function verifyCognitoToken(token: string): Promise<any | null> {
  try {
    const decoded = await jose.jwtVerify(token, JWKS, { issuer: COGNITO_ISSUER });
    return decoded.payload;
  } catch (e) {
    return null;
  }
}

/**
 * Plan cache: avoid hammering Cuentas /v1/capabilities on every request.
 * Key: sub. Value: { plan, expiresAt }.
 */
const planCache = new Map<string, { plan: string; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Extract plan from Cognito opita_id_token cookie, fallback to DynamoDB */
/**
 * Resolve plan: tries Cognito custom:plan claim first, then calls Cuentas
 * /v1/capabilities when opita:active_org_id is present (capability-based),
 * finally falls back to DynamoDB Users table.
 *
 * Sprint 2026-07-03-cuentas-v3-consumer-vibe (T-3)
 */
async function resolveCuentasContext(event: any, sub: string, opitaClaims: OpitaClaims | null): Promise<string> {
  // 0. Cache hit
  const cached = planCache.get(sub);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }

  // 1. Try Cognito custom:plan claim (still source of truth for billing)
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const idMatch = cookieHeader.match(/opita_id_token=([^;]+)/);
  if (idMatch) {
    const claims = await verifyCognitoToken(idMatch[1]);
    if (claims?.['custom:plan']) {
      planCache.set(sub, { plan: claims['custom:plan'], expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
      return claims['custom:plan'];
    }
  }

  // 2. If user has opita:active_org_id, ask Cuentas for capabilities
  if (opitaClaims?.activeOrgId && idMatch) {
    try {
      const caps = await cuentasClient.getMyCapabilities(idMatch[1]);
      // Map capabilities to plan tier
      if (caps.capabilities?.includes('product.admin')) return 'admin';
      if (caps.capabilities?.includes('org.billing.manage')) return 'pro';
      if (caps.capabilities?.includes('org.billing.view')) return 'starter';
    } catch (err) {
      if (!(err instanceof CuentasCircuitOpenError)) {
        console.warn('[resolveCuentasContext] failed:', err);
      }
    }
  }

  // 3. Fallback: DynamoDB Users table
  const userDb = await docClient.send(new GetCommand({
    TableName: process.env.USERS_TABLE_NAME || "",
    Key: { email: sub }
  }));
  const plan = userDb.Item?.plan || "free";
  planCache.set(sub, { plan, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
  return plan;
}

const Resource = SSTResource as any;

const awsConfig = (process.env.LOCALSTACK_ENDPOINT && process.env.NODE_ENV !== "production") ? {
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
} : {};

const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

// ─── Auth Helper ────────────────────────────────────────────────

/**
 * Extract authenticated email from the request.
 * Checks in order:
 * 1. Authorization: Bearer <token> header (Cognito JWT — JWKS verified)
 * 2. opita_id_token cookie (Cognito — JWKS verified)
 */
/**
 * Extract authenticated email AND opita:* claims from the request.
 * Returns both so handlers can use them.
 * Sprint 2026-07-03-cuentas-v3-consumer-vibe (T-2)
 */
export interface AuthContext {
  email: string;
  sub: string;
  opitaClaims: OpitaClaims | null;
}

async function extractAuthClaims(event: any): Promise<AuthContext | null> {
  // 1. Bearer token from Authorization header (Cognito JWT)
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearerToken) {
    const claims = await verifyCognitoToken(bearerToken);
    if (claims?.email || claims?.sub) {
      return {
        email: (claims.email || claims.sub) as string,
        sub: claims.sub as string,
        opitaClaims: parseOpitaClaims(claims),
      };
    }
  }

  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";

  // 2. Cognito ID token cookie
  const cognitoMatch = cookieHeader.match(/opita_id_token=([^;]+)/);
  if (cognitoMatch) {
    const claims = await verifyCognitoToken(cognitoMatch[1]);
    if (claims?.email || claims?.sub) {
      return {
        email: (claims.email || claims.sub) as string,
        sub: claims.sub as string,
        opitaClaims: parseOpitaClaims(claims),
      };
    }
  }

  return null;
}

function getCorsHeaders(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  let allowedOrigin = "https://opitacode.com";
  
  if (origin === "https://opitacode.com" || 
      (origin.startsWith("https://") && origin.endsWith(".opitacode.com")) ||
      origin.startsWith("http://localhost:") || 
      origin.startsWith("tauri://")) {
    allowedOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
  };
}

export const handler = async (event: any) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: getCorsHeaders(event), body: "" };
  }

  const rawPath = event.requestContext?.http?.path || "";
  const path = rawPath.replace(/^\/(core|chat|billing|storage)/, "");
  const method = event.requestContext?.http?.method;
  // SST Router (CloudFront → Lambda Function URL) may base64-encode the body.
  // Decode it once here so all route handlers can safely JSON.parse.
  const rawBody = event.isBase64Encoded && event.body
    ? Buffer.from(event.body, "base64").toString("utf8")
    : (event.body || "{}");

  try {
    // Projects endpoints
    if (path === "/projects" && (method === "GET" || method === "POST")) {
      const auth = await extractAuthClaims(event);
      if (!auth) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Unauthorized" }) };
      }
      const email = auth.email;

      if (method === "GET") {
        const response = await docClient.send(new QueryCommand({
          TableName: Resource.Projects.name,
          KeyConditionExpression: "client_id = :client_id",
          ExpressionAttributeValues: {
            ":client_id": email
          }
        }));

        const projects = (response.Items || []).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return {
          statusCode: 200,
          headers: getCorsHeaders(event),
          body: JSON.stringify(projects),
        };
      }

      if (method === "POST") {
        const body = JSON.parse(rawBody);
        
        if (!body.title || !body.description) {
          return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Missing fields" }) };
        }

        const newProject = {
          id: randomUUID(),
          client_id: email,
          title: body.title,
          description: body.description,
          status: "PENDING",
          budget: 0,
          created_at: new Date().toISOString(),
        };

        await docClient.send(new PutCommand({
          TableName: Resource.Projects.name,
          Item: newProject
        }));

        return {
          statusCode: 201,
          headers: getCorsHeaders(event),
          body: JSON.stringify([newProject]),
        };
      }
    }
    // ─── Analytics Events Ingestion ───────────────────────────────
    // Receives batched events from landing page and web app.
    // Stores in AnalyticsEvents DynamoDB table for Opita Sync consumption.
    if (path === "/events/ingest" && method === "POST") {
      const VALID_EVENT_TYPES = new Set([
        "page_view", "cta_click", "download_click", "checkout_intent",
        "session_start", "chat_message_sent", "project_created", "project_saved",
        "upgrade_prompt_shown", "checkout_completed", "login_method",
        "feature_used", "error_encountered", "onboarding_step",
        "contact_submitted", "session_identify",
      ]);
      const VALID_SOURCES = new Set(["landing", "app"]);
      const VALID_PRODUCTS = new Set(["vibe-studio", "opitacode-web", "opita-barber", "opita-account", "opita-developer", "opita-live-deck", "opita-trabajos"]);
      const MAX_EVENTS_PER_BATCH = 25; // DynamoDB BatchWrite limit
      const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

      // Rate limit: 10 batch ingestions per minute per IP
      const sourceIp = event.requestContext?.http?.sourceIp || "unknown";
      const rlKey = `events-rl#${sourceIp}`;
      const rlWindow = `minute#${Math.floor(Date.now() / 60000)}`;
      try {
        const rlResult = await docClient.send(new GetCommand({
          TableName: Resource.TokenUsage.name,
          Key: { pk: rlKey, sk: rlWindow },
        }));
        if ((rlResult.Item?.requestCount as number || 0) >= 10) {
          return { statusCode: 429, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Too many requests" }) };
        }
        await docClient.send(new UpdateCommand({
          TableName: Resource.TokenUsage.name,
          Key: { pk: rlKey, sk: rlWindow },
          UpdateExpression: "ADD requestCount :one SET expiresAt = if_not_exists(expiresAt, :ttl)",
          ExpressionAttributeValues: { ":one": 1, ":ttl": Math.floor(Date.now() / 1000) + 120 },
        }));
      } catch (err) {
        console.error("[events-rl] Error:", err);
      }

      let body: any;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      const events = body.events;
      if (!Array.isArray(events) || events.length === 0) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "events array required" }) };
      }
      if (events.length > MAX_EVENTS_PER_BATCH) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: `Max ${MAX_EVENTS_PER_BATCH} events per batch` }) };
      }

      // Try to identify the user (optional — landing is anonymous)
      let userId: string | null = null;
      try {
        const auth = await extractAuthClaims(event);
        if (auth) userId = auth.email;
      } catch { /* anonymous is fine */ }

      const sessionId = body.sessionId || `anon-${sourceIp.replace(/\./g, "-")}`;
      const productId = (body.productId && VALID_PRODUCTS.has(body.productId)) ? body.productId : "vibe-studio";
      const pk = userId ? `events#${userId}` : `events#${sessionId}`;
      const now = new Date();
      const expiresAt = Math.floor(now.getTime() / 1000) + TTL_SECONDS;

      // Validate and build batch items
      const writeRequests: any[] = [];
      let skippedCount = 0;

      for (const evt of events) {
        if (!evt.type || !VALID_EVENT_TYPES.has(evt.type)) { skippedCount++; continue; }
        if (evt.source && !VALID_SOURCES.has(evt.source)) { skippedCount++; continue; }

        const eventId = `${evt.timestamp || now.toISOString()}#${randomUUID().slice(0, 8)}`;

        writeRequests.push({
          PutRequest: {
            Item: {
              pk,
              sk: eventId,
              type: evt.type,
              source: evt.source || "app",
              productId,
              data: evt.data || {},
              consent: evt.consent || "basic",
              userId: userId || null,
              sessionId,
              ip: sourceIp,
              userAgent: (event.headers?.["user-agent"] || "").slice(0, 256),
              expiresAt,
            },
          },
        });
      }

      if (writeRequests.length === 0) {
        return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ accepted: 0, skipped: skippedCount }) };
      }

      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [Resource.AnalyticsEvents.name]: writeRequests,
          },
        }));
      } catch (err) {
        console.error("[events-ingest] BatchWrite error:", err);
        return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Failed to store events" }) };
      }

      return {
        statusCode: 202,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ accepted: writeRequests.length, skipped: skippedCount }),
      };
    }

    // ─── Token Usage Endpoint ────────────────────────────────────────
    if (path === "/usage" && method === "GET") {
      // Unified auth: Bearer token, Cognito cookie, or legacy session cookie
      const auth = await extractAuthClaims(event);
      if (!auth) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      }

      // Resolve plan from Cognito (source of truth), fallback to DynamoDB
      const plan = await resolveCuentasContext(event, auth.sub, auth.opitaClaims);

      // Token quota constants (must match chat.ts)
      const TOKEN_QUOTAS: Record<string, { daily: number; hourly: number }> = {
        free:       { daily: 150_000,   hourly: 30_000 },
        estudiante: { daily: 250_000,   hourly: 60_000 },
        pro:        { daily: 1_000_000, hourly: 200_000 },
      };
      const quota = TOKEN_QUOTAS[plan] || TOKEN_QUOTAS.pro;

      // Get effective quota including gamification bonuses
      const effectiveDailyLimit = await (async () => {
        try {
          const earned = await import("./gamification.js");
          return await earned.getEffectiveQuota(auth.email, plan);
        } catch {
          return quota.daily;
        }
      })();

      // Read current counters
      const now = new Date();
      const dailyKey = `daily#${now.toISOString().split("T")[0]}`;
      const hourlyKey = `hourly#${now.toISOString().slice(0, 13)}`;
      const pk = `user#${auth.email}`;

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

      const tokensUsedToday = (dailyResult.Item?.tokensUsed as number) || 0;
      const tokensUsedThisHour = (hourlyResult.Item?.tokensUsed as number) || 0;

      // Calculate reset times
      const resetHourly = new Date(now);
      resetHourly.setMinutes(0, 0, 0);
      resetHourly.setHours(resetHourly.getHours() + 1);

      const resetDaily = new Date(now);
      resetDaily.setUTCHours(0, 0, 0, 0);
      resetDaily.setUTCDate(resetDaily.getUTCDate() + 1);

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          tokensUsedToday,
          tokensLimitDaily: Math.max(quota.daily, effectiveDailyLimit),
          tokensLimitDailyBase: quota.daily,
          tokensUsedThisHour,
          tokensLimitHourly: quota.hourly,
          plan,
          resetDailyAt: resetDaily.toISOString(),
          resetHourlyAt: resetHourly.toISOString(),
        }),
      };
    }

    // ─── Gamification Endpoints ──────────────────────────────────

    if (path === "/gamification" && method === "GET") {
      const auth = await extractAuthClaims(event);
      if (!auth) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolveCuentasContext(event, auth.sub, auth.opitaClaims);
      const profile = await getProfile(auth.email, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(profile),
      };
    }

    if (path === "/gamification/missions" && method === "POST") {
      const auth = await extractAuthClaims(event);
      if (!auth) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolveCuentasContext(event, auth.sub, auth.opitaClaims);
      const missions = await getMissions(auth.email, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ missions }),
      };
    }

    if (path?.startsWith("/gamification/missions/") && path.endsWith("/complete") && method === "POST") {
      const auth = await extractAuthClaims(event);
      if (!auth) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolveCuentasContext(event, auth.sub, auth.opitaClaims);
      const missionId = path.replace("/gamification/missions/", "").replace("/complete", "");
      const result = await completeMission(auth.email, missionId, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(result),
      };
    }

    if (path === "/gamification/xp/award" && method === "POST") {
      const auth = await extractAuthClaims(event);
      if (!auth) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolveCuentasContext(event, auth.sub, auth.opitaClaims);
      const body = JSON.parse(rawBody);
      // SECURITY: Only allow passive XP actions that are safe for client-triggered awards.
      // Mission completions and streak bonuses are awarded server-side by completeMission().
      const ALLOWED_PASSIVE_ACTIONS = new Set(["chat_message", "template_use", "project_create", "feature_explore", "daily_login"]);
      const action = body.action || "chat_message";
      if (!ALLOWED_PASSIVE_ACTIONS.has(action)) {
        return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Acción no permitida" }) };
      }
      const result = await awardXP(auth.email, action, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(result),
      };
    }

    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Not found" }) };

  } catch (err: any) {
    console.error("Auth Error:", err.message || err);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
