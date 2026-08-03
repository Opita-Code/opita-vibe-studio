import { Resource as SSTResource } from "sst";
import * as crypto from "crypto";
import { timingSafeEqual } from "crypto";
import * as jose from "jose";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const Resource = SSTResource as any;

// ─── Auth Helper (mirrors core.ts pattern) ──────────────────────

// OCAIS es el IdP del ecosistema (opita-account-ui). JWT RS256 verificables
// contra https://api.opitacode.com/.well-known/jwks.json (kid=k2), issuer
// "opita-account-ui". Sesión en cookie HttpOnly __opita_session (7d).
const OCAIS_ISSUER = "opita-account-ui";
const OCAIS_JWKS_URL = process.env.OCAIS_JWKS_URL || "https://api.opitacode.com/.well-known/jwks.json";
const OCAIS_JWKS = jose.createRemoteJWKSet(new URL(OCAIS_JWKS_URL));

/**
 * Extract authenticated email from the request.
 * OCAIS es la única fuente de verdad: Bearer (OCAIS) → __opita_session cookie (OCAIS).
 */
async function extractAuthEmail(event: any): Promise<string | null> {
  async function verifyOcaisToken(token: string): Promise<string | null> {
    try {
      const decoded = await jose.jwtVerify(token, OCAIS_JWKS, { issuer: OCAIS_ISSUER });
      return (decoded.payload.email || decoded.payload.sub) as string | null;
    } catch {
      // Fallback: firma válida con otro issuer (rotación)
      try {
        const decoded = await jose.jwtVerify(token, OCAIS_JWKS);
        return (decoded.payload.email || decoded.payload.sub) as string | null;
      } catch { return null; }
    }
  }

  // 1. Bearer token (OCAIS JWT)
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearerToken) {
    const email = await verifyOcaisToken(bearerToken);
    if (email) return email;
  }

  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";

  // 2. OCAIS session cookie (HttpOnly)
  const ocaisMatch = cookieHeader.match(/__opita_session=([^;]+)/);
  if (ocaisMatch) {
    const email = await verifyOcaisToken(ocaisMatch[1]);
    if (email) return email;
  }

  return null;
}

const awsConfig = (process.env.LOCALSTACK_ENDPOINT && process.env.NODE_ENV !== "production") ? {
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
} : {};

const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

interface WompiEvent {
  event: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
      amount_in_cents: number;
      currency: string;
    };
  };
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
}

const PRODUCTS: Record<string, { name: string; amountInCents: number; currency: string }> = {
  VIBE_STUDENT: { name: "Vibe Estudiante", amountInCents: 1190000, currency: "COP" },
  VIBE_PRO: { name: "Vibe Studio Pro", amountInCents: 4990000, currency: "COP" },
};

export async function handler(event: any) {
  const method = event.requestContext.http.method;

  // ── CORS helper (same pattern as core.ts) ──────────────────────
  const origin = event.headers?.origin || event.headers?.Origin || "";
  let allowedOrigin = "https://cuenta.opitacode.com";
  if (origin === "https://opitacode.com" || origin.endsWith(".opitacode.com") || origin.startsWith("http://localhost:")) {
    allowedOrigin = origin;
  }
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
  };

  const rawPath = event.requestContext?.http?.path || "";
  const path = rawPath.replace(/^\/billing/, "");

  // ── GET /checkout-sign or GET /payments ──────────────────────────
  if (method === "GET") {
    const headers = corsHeaders;

    if (path === "/payments" || path === "/transactions") {
      const email = await extractAuthEmail(event);
      if (!email) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Sesión inválida o expirada" }),
        };
      }

      try {
        const response = await docClient.send(new ScanCommand({
          TableName: Resource.Transactions.name,
          FilterExpression: "user_id = :user_id",
          ExpressionAttributeValues: {
            ":user_id": email,
          },
        }));

        const items = (response.Items || []).map((item: any) => ({
          id: item.id,
          date: item.created_at || new Date().toISOString(),
          amount: (item.amount_in_cents || 0) / 100,
          currency: item.currency || "COP",
          status: item.status || "APPROVED",
          product: item.product_id === "VIBE_PRO" ? "Vibe Studio Pro" : item.product_id === "VIBE_STUDENT" ? "Vibe Estudiante" : item.product_id,
          reference: item.id,
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ items }),
        };
      } catch (err: any) {
        console.error("[payments] Error:", err);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Error interno al consultar transacciones" }),
        };
      }
    }

    const authenticatedEmail = await extractAuthEmail(event);

    const params = event.queryStringParameters || {};
    const productKey = params.product;
    const userId = authenticatedEmail || params.userId;

    if (!userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Se requiere autenticación o userId" }) };
    }

    const product = PRODUCTS[productKey];
    if (!product) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Producto inválido" }) };
    }

    const publicKey = (process.env.WOMPI_PUBLIC_KEY || "").replace(/^\uFEFF/, "").trim();
    const integritySecret = (process.env.WOMPI_INTEGRITY_SECRET || "").replace(/^\uFEFF/, "").trim();

    if (!publicKey || !integritySecret) {
      console.error("Faltan WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET");
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Configuración incompleta" }) };
    }

    const reference = `${productKey}::${userId}::${Date.now()}`;

    const concatenation = `${reference}${product.amountInCents}${product.currency}${integritySecret}`;
    const signature = crypto.createHash("sha256").update(concatenation).digest("hex");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        publicKey,
        reference,
        amountInCents: product.amountInCents,
        currency: product.currency,
        productName: product.name,
        signature,
      }),
    };
  }

  // ── OPTIONS (CORS preflight) ────────────────────────────────────
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  // ── POST /webhook (existing Wompi webhook handler) ──────────────
  try {
    if (method !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}") as WompiEvent;
    
    // 1. Validar firma de Wompi
    const secret = process.env.WOMPI_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Falta WOMPI_WEBHOOK_SECRET en el ambiente");
      return { statusCode: 500, body: "Internal Server Error" };
    }

    const { signature, data } = body;
    const tx = data.transaction;

    let signatureString = "";
    for (const prop of signature.properties) {
      const parts = prop.split('.');
      let val: any = data;
      for (const p of parts) val = val[p];
      signatureString += val;
    }
    signatureString += body.timestamp;
    signatureString += secret;

    const expectedChecksum = crypto.createHash('sha256').update(signatureString).digest('hex');

    const checksumBuf = Buffer.from(signature.checksum);
    const expectedBuf = Buffer.from(expectedChecksum);
    if (checksumBuf.length !== expectedBuf.length || !timingSafeEqual(checksumBuf, expectedBuf)) {
      console.error("Firma de Wompi inválida", { expectedChecksum, received: signature.checksum });
      return { statusCode: 401, body: "Unauthorized - Invalid Signature" };
    }

    // 2. Procesar el evento
    if (body.event === "transaction.updated" && tx.status === "APPROVED") {
      let productId = "";
      let userId = "";

      if (tx.reference.includes("::")) {
        const refParts = tx.reference.split("::");
        if (refParts.length >= 2) {
          productId = refParts[0];
          userId = refParts[1];
        }
      } else {
        const refParts = tx.reference.split("_");
        if (tx.reference.startsWith("TRABAJOS_") && refParts.length >= 4) {
          productId = `${refParts[0]}_${refParts[1]}`;
          userId = refParts.slice(2, -1).join('_');
        } else if (tx.reference.startsWith("VIBE_") && refParts.length >= 3) {
          userId = refParts[refParts.length - 2];
          productId = refParts.slice(0, refParts.length - 2).join('_');
        } else if (refParts.length === 3) {
          productId = refParts[0];
          userId = refParts[1];
        } else {
          console.error("Referencia no reconocible, ignorando:", tx.reference);
          return { statusCode: 200, headers: corsHeaders, body: "OK (unrecognized reference)" };
        }
      }

      const isTrabajosProduct = productId.startsWith("TRABAJOS_");
      const isVibeProduct = productId.startsWith("VIBE_");

      if (!isTrabajosProduct && !isVibeProduct) {
        console.error("Unknown product class in reference:", productId);
        return { statusCode: 200, headers: corsHeaders, body: "OK (unknown product class)" };
      }

      try {
        // DynamoDB updates (OCAIS DDB UsersTable es la única fuente de verdad del plan)
        if (isVibeProduct) {
          try {
            await docClient.send(new PutCommand({
              TableName: Resource.Transactions.name,
              Item: {
                id: tx.id,
                user_id: userId,
                product_id: productId,
                amount_in_cents: tx.amount_in_cents,
                currency: tx.currency,
                status: tx.status,
                created_at: new Date().toISOString()
              },
              ConditionExpression: "attribute_not_exists(id)",
            }));
          } catch (dupErr: any) {
            if (dupErr.name === "ConditionalCheckFailedException") {
              console.info(`Webhook duplicado ignorado para tx ${tx.id}`);
              return { statusCode: 200, headers: corsHeaders, body: "OK (duplicate)" };
            }
            throw dupErr;
          }

          const newPlan = productId === "VIBE_STUDENT" ? "estudiante" : "pro";
          await docClient.send(new UpdateCommand({
            TableName: process.env.USERS_TABLE_NAME,
            Key: { email: userId },
            UpdateExpression: "SET #plan = :plan, updated_at = :updated_at",
            ExpressionAttributeNames: { "#plan": "plan" },
            ExpressionAttributeValues: {
              ":plan": newPlan,
              ":updated_at": new Date().toISOString()
            }
          }));
          console.info(`Plan actualizado en DB Vibe: ${userId} → ${newPlan} (tx: ${tx.id})`);
        } else {
          // Productos Trabajos: plan en DDB (trabajos_plan) — ya no se escribe a Cognito
          const trabajosPlanMap: Record<string, string> = {
            TRABAJOS_STARTER: "starter",
            TRABAJOS_PRO: "pro",
            TRABAJOS_SPRINT: "sprint"
          };
          const newTrabajosPlan = trabajosPlanMap[productId];
          if (newTrabajosPlan) {
            try {
              await docClient.send(new UpdateCommand({
                TableName: process.env.USERS_TABLE_NAME,
                Key: { email: userId },
                UpdateExpression: "SET trabajos_plan = :tplan, updated_at = :updated_at",
                ExpressionAttributeValues: {
                  ":tplan": newTrabajosPlan,
                  ":updated_at": new Date().toISOString()
                }
              }));
              console.info(`Plan actualizado en DB Trabajos: ${userId} → ${newTrabajosPlan} (tx: ${tx.id})`);
            } catch (tErr: any) {
              console.error(`Error actualizando trabajos_plan de ${userId}:`, tErr.message || tErr);
            }
          } else {
            console.info(`Cross-Stack Trabajos webhook procesado exitosamente para ${userId}`);
          }
        }

      } catch (dbError) {
        console.error("Error actualizando base de datos:", dbError);
        return { statusCode: 500, body: "Error interno de base de datos" };
      }
    } else if (body.event === "transaction.updated" && tx.status !== "APPROVED") {
      console.info(`Transacción no aprobada: ${tx.id} → status=${tx.status}, ref=${tx.reference}`);
    }

    return { statusCode: 200, headers: corsHeaders, body: "OK" };
  } catch (err: any) {
    console.error("Error en el webhook de Wompi", err);
    return { statusCode: 500, headers: corsHeaders, body: "Error procesando el webhook" };
  }
}
