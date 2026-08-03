import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Resource as SSTResource } from "sst";
import * as jose from "jose";
import { randomUUID } from "crypto";
import { getProfile, getMissions, completeMission, awardXP } from "./gamification.js";

// ─── OCAIS Plan Extraction (source of truth) ───────────────────
// OCAIS es el IdP del ecosistema opitacode (opita-account-ui). Emite JWTs
// RS256 verificables contra https://api.opitacode.com/.well-known/jwks.json
// (kid=k2) con issuer "opita-account-ui". La sesión viaja en la cookie
// HttpOnly __opita_session (7d) + opita_refresh_token (30d).
const OCAIS_ISSUER = "opita-account-ui";
const OCAIS_JWKS_URL = process.env.OCAIS_JWKS_URL || "https://api.opitacode.com/.well-known/jwks.json";
const OCAIS_JWKS = jose.createRemoteJWKSet(new URL(OCAIS_JWKS_URL));

async function verifyOcaisToken(token: string): Promise<any | null> {
  try {
    // Issuer estricto OCAIS; si el JWT es válido pero con otro issuer
    // (rotación), fallback a verificación de firma sin exigir issuer.
    const decoded = await jose.jwtVerify(token, OCAIS_JWKS, { issuer: OCAIS_ISSUER });
    return decoded.payload;
  } catch {
    try {
      const decoded = await jose.jwtVerify(token, OCAIS_JWKS);
      return decoded.payload;
    } catch {
      return null;
    }
  }
}

/** Extrae el plan del usuario: OCAIS JWT (cookie __opita_session o Bearer) → DDB */
async function resolvePlan(event: any, email: string): Promise<string> {
  // 1. OCAIS session token (source of truth) — claim role/plan del JWT RS256
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const ocaisMatch = cookieHeader.match(/__opita_session=([^;]+)/);
  const ocaisToken = bearerToken || ocaisMatch?.[1] || null;
  if (ocaisToken) {
    const claims = await verifyOcaisToken(ocaisToken);
    if (claims) {
      const plan = claims.plan || claims.role || null;
      if (plan) return plan;
    }
  }

  // 2. Fallback: DynamoDB Users table (tabla compartida con opita-account)
  const userDb = await docClient.send(new GetCommand({
    TableName: process.env.USERS_TABLE_NAME || "",
    Key: { email }
  }));
  return userDb.Item?.plan || "free";
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
 * OCAIS es la única fuente de verdad (RS256 JWT — JWKS verified).
 * 1. Authorization: Bearer <token> header
 * 2. __opita_session cookie (HttpOnly — la lee el backend)
 */
async function extractAuthEmail(event: any): Promise<string | null> {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";

  // 1. Bearer token (OCAIS JWT)
  if (bearerToken) {
    const claims = await verifyOcaisToken(bearerToken);
    if (claims?.email || claims?.sub) return (claims.email || claims.sub) as string;
  }

  // 2. OCAIS session cookie (HttpOnly — la lee el backend)
  const ocaisMatch = cookieHeader.match(/__opita_session=([^;]+)/);
  if (ocaisMatch) {
    const claims = await verifyOcaisToken(ocaisMatch[1]);
    if (claims?.email || claims?.sub) return (claims.email || claims.sub) as string;
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
      const email = await extractAuthEmail(event);
      if (!email) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Unauthorized" }) };
      }

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
        userId = await extractAuthEmail(event);
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
      // Unified auth: OCAIS (Bearer o cookie __opita_session)
      const email = await extractAuthEmail(event);
      if (!email) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      }

      // Resolve plan from OCAIS JWT claims, fallback to DynamoDB
      const plan = await resolvePlan(event, email);

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
          return await earned.getEffectiveQuota(email, plan);
        } catch {
          return quota.daily;
        }
      })();

      // Read current counters
      const now = new Date();
      const dailyKey = `daily#${now.toISOString().split("T")[0]}`;
      const hourlyKey = `hourly#${now.toISOString().slice(0, 13)}`;
      const pk = `user#${email}`;

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
      const email = await extractAuthEmail(event);
      if (!email) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolvePlan(event, email);
      const profile = await getProfile(email, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(profile),
      };
    }

    if (path === "/gamification/missions" && method === "POST") {
      const email = await extractAuthEmail(event);
      if (!email) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolvePlan(event, email);
      const missions = await getMissions(email, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ missions }),
      };
    }

    if (path?.startsWith("/gamification/missions/") && path.endsWith("/complete") && method === "POST") {
      const email = await extractAuthEmail(event);
      if (!email) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolvePlan(event, email);
      const missionId = path.replace("/gamification/missions/", "").replace("/complete", "");
      const result = await completeMission(email, missionId, plan);
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(result),
      };
    }

    if (path === "/gamification/xp/award" && method === "POST") {
      const email = await extractAuthEmail(event);
      if (!email) return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      const plan = await resolvePlan(event, email);
      const body = JSON.parse(rawBody);
      // SECURITY: Only allow passive XP actions that are safe for client-triggered awards.
      // Mission completions and streak bonuses are awarded server-side by completeMission().
      const ALLOWED_PASSIVE_ACTIONS = new Set(["chat_message", "template_use", "project_create", "feature_explore", "daily_login"]);
      const action = body.action || "chat_message";
      if (!ALLOWED_PASSIVE_ACTIONS.has(action)) {
        return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Acción no permitida" }) };
      }
      const result = await awardXP(email, action, plan);
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
