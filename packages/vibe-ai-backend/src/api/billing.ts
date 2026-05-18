import { Resource as SSTResource } from "sst";
import * as crypto from "crypto";
import { createHmac } from "crypto";
import * as jose from "jose";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const Resource = SSTResource as any;

// ─── Auth Helper (mirrors core.ts pattern) ──────────────────────

const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_LItAcj2Aa";
const JWKS = jose.createRemoteJWKSet(new URL(`${COGNITO_ISSUER}/.well-known/jwks.json`));

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function verifyLegacyJWT(token: string, secret: string) {
  const [h, b, sig] = token.split(".");
  const expectedSig = base64url(createHmac("sha256", secret).update(`${h}.${b}`).digest());
  if (sig !== expectedSig) throw new Error("Invalid signature");
  const payload = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expired");
  return payload;
}

/**
 * Extract authenticated email from the request.
 * Checks: Bearer token → opita_id_token cookie → opita_session cookie.
 */
async function extractAuthEmail(event: any): Promise<string | null> {
  async function verifyCognitoToken(token: string): Promise<string | null> {
    try {
      const decoded = await jose.jwtVerify(token, JWKS, { issuer: COGNITO_ISSUER });
      return (decoded.payload.email || decoded.payload.sub) as string | null;
    } catch { return null; }
  }

  // 1. Bearer token
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearerToken) {
    const email = await verifyCognitoToken(bearerToken);
    if (email) return email;
    // Fallback: try legacy HMAC
    try {
      const payload = verifyLegacyJWT(bearerToken, process.env.JWT_SECRET || "");
      if (payload.email) return payload.email;
    } catch { /* not a valid legacy token */ }
  }

  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";

  // 2. Cognito cookie
  const cognitoMatch = cookieHeader.match(/opita_id_token=([^;]+)/);
  if (cognitoMatch) {
    const email = await verifyCognitoToken(cognitoMatch[1]);
    if (email) return email;
  }

  // 3. Legacy session cookie
  const sessionMatch = cookieHeader.match(/opita_session=([^;]+)/);
  if (sessionMatch) {
    try {
      const payload = verifyLegacyJWT(sessionMatch[1], process.env.JWT_SECRET || "");
      return payload.email as string;
    } catch { /* invalid */ }
  }

  return null;
}

const awsConfig = process.env.LOCALSTACK_ENDPOINT ? {
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

  // ── GET /checkout-sign ──────────────────────────────────────────
  if (method === "GET") {
    const headers = corsHeaders;

    // ── AUTH GUARD ── userId MUST come from verified JWT, never from query string
    const authenticatedEmail = await extractAuthEmail(event);
    if (!authenticatedEmail) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Autenticación requerida para generar checkout" }) };
    }

    const params = event.queryStringParameters || {};
    const productKey = params.product;
    const userId = authenticatedEmail; // ← Verified, not from query string

    const product = PRODUCTS[productKey];
    if (!product) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Producto inválido" }) };
    }

    // Strip BOM (U+FEFF) and whitespace — env vars from GitHub Secrets can carry invisible chars
    const publicKey = (process.env.WOMPI_PUBLIC_KEY || "").replace(/^\uFEFF/, "").trim();
    const integritySecret = (process.env.WOMPI_INTEGRITY_SECRET || "").replace(/^\uFEFF/, "").trim();

    if (!publicKey || !integritySecret) {
      console.error("Faltan WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET");
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Configuración incompleta" }) };
    }

    const reference = `${productKey}_${userId}_${Date.now()}`;

    // Wompi integrity: SHA256(reference + amountInCents + currency + integritySecret)
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

    // Generar string para el checksum
    // Según doc de Wompi, el string concatena los valores de las properties + timestamp + secret
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

    if (expectedChecksum !== signature.checksum) {
      console.error("Firma de Wompi inválida", { expectedChecksum, received: signature.checksum });
      return { statusCode: 401, body: "Unauthorized - Invalid Signature" };
    }

    // 2. Procesar el evento
    if (body.event === "transaction.updated" && tx.status === "APPROVED") {
      const refParts = tx.reference.split("_");
      
      let productId = "VIBE_STUDIO";
      let userId = "";
      
      if (refParts.length >= 3) {
        // Formato esperado: PREFIX_OPCIONAL_{userId}_{timestamp}
        userId = refParts[refParts.length - 2];
        const prefixParts = refParts.slice(0, refParts.length - 2);
        productId = prefixParts.join("_");

        if (productId === "VIBE_PRO" || productId === "VIBE_STUDIO") {
          productId = "VIBE_STUDIO";
        }
      } else if (refParts.length === 2) {
        // Fallback poco probable: {PRODUCT}_{userId} sin timestamp
        productId = refParts[0];
        userId = refParts[1];
      } else {
        console.error("Referencia no reconocible, ignorando userId:", tx.reference);
      }

      try {
        // A) Registrar transacción
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
          }
        }));

        // B) Actualizar perfil del usuario
        if (productId === "VIBE_STUDIO" || productId === "VIBE_STUDENT") {
          const newPlan = productId === "VIBE_STUDENT" ? "estudiante" : "pro";
          await docClient.send(new UpdateCommand({
            TableName: Resource.Users.name,
            Key: { email: userId }, // El userId que viene de Wompi debe ser el email
            UpdateExpression: "SET #plan = :plan, updated_at = :updated_at",
            ExpressionAttributeNames: {
              "#plan": "plan"
            },
            ExpressionAttributeValues: {
              ":plan": newPlan,
              ":updated_at": new Date().toISOString()
            }
          }));
        }
      } catch (dbError) {
        console.error("Error actualizando base de datos:", dbError);
        return { statusCode: 500, body: "Error interno de base de datos" };
      }
    }

    return { statusCode: 200, body: "OK" };
  } catch (err: any) {
    console.error("Error en el webhook de Wompi", err);
    return { statusCode: 500, body: "Error procesando el webhook" };
  }
}

