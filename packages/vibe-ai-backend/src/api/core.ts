import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Resource as SSTResource } from "sst";
import { z } from "zod";
import { randomUUID, createHmac, scryptSync, randomBytes, timingSafeEqual } from "crypto";

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function signJWT(payload: any, secret: string, expiresInMinutes: number) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const p = { jti: randomUUID(), ...payload, iat: now, exp: now + expiresInMinutes * 60 };
  const h = base64url(Buffer.from(JSON.stringify(header)));
  const b = base64url(Buffer.from(JSON.stringify(p)));
  const sig = base64url(createHmac("sha256", secret).update(`${h}.${b}`).digest());
  return `${h}.${b}.${sig}`;
}
function verifyJWT(token: string, secret: string) {
  const [h, b, sig] = token.split(".");
  const expectedSig = base64url(createHmac("sha256", secret).update(`${h}.${b}`).digest());
  if (sig !== expectedSig) throw new Error("Invalid signature");
  const payload = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expired");
  return payload;
}

// ─── Password Hashing (crypto.scrypt — native, zero deps) ────
function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}
function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

const Resource = SSTResource as any;

const awsConfig = process.env.LOCALSTACK_ENDPOINT ? {
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
} : {};

const sesClient = new SESClient(awsConfig);
const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);



// ─── Service Config ─────────────────────────────────────────────

type ServiceId = "vibe-studio" | "opita-code" | "default";

const SERVICE_CONFIG: Record<ServiceId, {
  name: string;
  subject: string;
  brandColor: string;
  accentColor: string;
  logoUrl: string;
  defaultRedirect: string;
}> = {
  "vibe-studio": {
    name: "Vibe Studio",
    subject: "Tu acceso a Vibe Studio",
    brandColor: "#0ea5e9",
    accentColor: "rgba(14, 165, 233, 0.4)",
    logoUrl: "https://opitacode.com/opita-code-horizontal-white-v4.png",
    defaultRedirect: "https://vibe.opitacode.com/app",
  },
  "opita-code": {
    name: "Opita Code",
    subject: "Tu enlace mágico - Opita Code",
    brandColor: "#6366f1",
    accentColor: "rgba(99, 102, 241, 0.4)",
    logoUrl: "https://opitacode.com/opita-code-horizontal-white-v4.png",
    defaultRedirect: "https://opitacode.com/projects",
  },
  "default": {
    name: "Opita Code",
    subject: "Tu enlace mágico de acceso",
    brandColor: "#0ea5e9",
    accentColor: "rgba(14, 165, 233, 0.4)",
    logoUrl: "https://opitacode.com/opita-code-horizontal-white-v4.png",
    defaultRedirect: "https://opitacode.com",
  },
};

function resolveService(raw: unknown): ServiceId {
  if (raw === "vibe-studio" || raw === "opita-code") return raw;
  return "default";
}

function buildMagicLinkEmail(service: ServiceId, verifyUrl: string): string {
  const cfg = SERVICE_CONFIG[service];
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #020617;
      color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 560px;
      margin: 48px auto;
      background-color: #0f172a;
      border-radius: 16px;
      border: 1px solid #1e293b;
      padding: 48px 40px;
      box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.6);
    }
    .logo { text-align: center; margin-bottom: 36px; }
    .logo img { height: 40px; }
    .badge {
      display: inline-block;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 12px;
      color: #94a3b8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 12px 0;
    }
    p {
      font-size: 15px;
      line-height: 1.65;
      color: #94a3b8;
      margin: 0 0 24px 0;
    }
    .button-wrap { text-align: center; margin: 36px 0; }
    .button {
      background-color: ${cfg.brandColor};
      color: #ffffff !important;
      text-decoration: none;
      padding: 15px 32px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 16px;
      display: inline-block;
      box-shadow: 0 0 20px ${cfg.accentColor};
      letter-spacing: 0.01em;
    }
    .divider {
      border: none;
      border-top: 1px solid #1e293b;
      margin: 32px 0;
    }
    .link-fallback {
      font-size: 13px;
      color: #64748b;
      word-break: break-all;
    }
    .link-fallback a { color: #94a3b8; }
    .footer {
      font-size: 12px;
      color: #475569;
      text-align: center;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="${cfg.logoUrl}" alt="${cfg.name}">
    </div>
    <div style="text-align:center">
      <span class="badge">${cfg.name}</span>
    </div>
    <h1>Accede a tu cuenta</h1>
    <p>Hemos recibido una solicitud para iniciar sesi&oacute;n. Haz clic en el bot&oacute;n para acceder&mdash;el enlace expira en <strong>15 minutos</strong>.</p>
    <div class="button-wrap">
      <a href="${verifyUrl}" class="button">Iniciar Sesi&oacute;n &rarr;</a>
    </div>
    <hr class="divider">
    <p class="link-fallback">Si el bot&oacute;n no funciona, copia y pega este enlace en tu navegador:<br><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p style="font-size:13px;color:#475569;margin:16px 0 0">Si no solicitaste este acceso, ignora este correo. Tu cuenta est&aacute; segura.</p>
    <div class="footer">&copy; ${new Date().getFullYear()} Opita Code &mdash; El c&oacute;digo fluye.</div>
  </div>
</body>
</html>`;
}

function getCorsHeaders(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  let allowedOrigin = "https://opitacode.com";
  
  if (origin === "https://opitacode.com" || origin.endsWith(".opitacode.com") || origin.startsWith("http://localhost:")) {
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

  const path = event.requestContext?.http?.path;
  const method = event.requestContext?.http?.method;

  try {
    if (path === "/auth/request" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const email = body.email;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || !emailRegex.test(email)) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Invalid email" }) };
      }

      // Resolve which service is requesting auth — drives email template and redirect fallback
      const service = resolveService(body.service);
      const serviceCfg = SERVICE_CONFIG[service];

      // The caller provides the exact post-auth destination (e.g. "/app" or "/projects").
      // We validate it stays within opitacode.com to prevent open-redirect attacks.
      let redirectTo: string = body.redirectTo || serviceCfg.defaultRedirect;
      const isAllowedRedirect = (
        redirectTo.startsWith("http://localhost:") ||
        redirectTo.startsWith("https://opitacode.com") ||
        redirectTo.includes(".opitacode.com")
      );
      if (!isAllowedRedirect) {
        redirectTo = serviceCfg.defaultRedirect;
      }

      const token = signJWT(
        { email, type: "magic_link", service, redirectTo },
        process.env.JWT_SECRET || "",
        15
      );

      const apiHost = event.requestContext?.domainName || "localhost";
      const protocol = apiHost.includes("localhost") ? "http" : "https";
      const verifyUrl = `${protocol}://${apiHost}/auth/verify?token=${token}`;
      const fromEmail = process.env.SES_FROM_EMAIL || "auth@opitacode.com";

      try {
        await sesClient.send(new SendEmailCommand({
          Source: fromEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: serviceCfg.subject },
            Body: {
              Html: { Data: buildMagicLinkEmail(service, verifyUrl) },
            },
          },
        }));
      } catch (e: any) {
        console.error("SES Error:", e.message || e);
        // Dev fallback: print link to logs; still return 200 to prevent email enumeration
        console.log("MAGIC_LINK_URL_DEV_FALLBACK:", verifyUrl);
      }

      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ message: "Magic link sent" }),
      };
    }

    if (path === "/auth/verify" && method === "GET") {
      const token = event.queryStringParameters?.token;
      
      if (!token) {
        return { statusCode: 302, headers: { Location: `${process.env.FRONTEND_URL || "https://opitacode.com/projects"}?error=missing_token` } };
      }

      let payload: any;
      try {
        payload = verifyJWT(token, process.env.JWT_SECRET || "");
        if (payload.type !== "magic_link") throw new Error("Invalid token type");

        // Prevenir Replay Attacks: Quemar el token JTI
        const jtiCheck = await docClient.send(new GetCommand({
          TableName: Resource.UserKeys.name,
          Key: { userId: "used-tokens", id: payload.jti }
        }));
        if (jtiCheck.Item) throw new Error("Token already used");

        await docClient.send(new PutCommand({
          TableName: Resource.UserKeys.name,
          Item: { userId: "used-tokens", id: payload.jti, usedAt: new Date().toISOString() }
        }));

      } catch (e) {
        return { statusCode: 302, headers: { Location: `${process.env.FRONTEND_URL || "https://opitacode.com/projects"}?error=invalid_token` } };
      }

      // Resolve the canonical redirect: prefer the one baked into the token,
      // then fall back to the service's default, then to FRONTEND_URL.
      const tokenService = resolveService(payload.service);
      const canonicalDefault = SERVICE_CONFIG[tokenService].defaultRedirect;
      let frontendUrl: string = payload.redirectTo || canonicalDefault || process.env.FRONTEND_URL || "https://opitacode.com/projects";
      const isAllowedVerifyRedirect = (
        frontendUrl.startsWith("http://localhost:") ||
        frontendUrl.startsWith("https://opitacode.com") ||
        frontendUrl.includes(".opitacode.com")
      );
      if (!isAllowedVerifyRedirect) {
        frontendUrl = canonicalDefault;
      }
      
      const email = payload.email as string;

      // Upsert user in DynamoDB
      await docClient.send(new PutCommand({
        TableName: Resource.Users.name,
        Item: {
          email: email,
          last_login: new Date().toISOString(),
        }
      }));

      // Generate Session Token
      const sessionToken = signJWT(
        { email, role: "authenticated" },
        process.env.JWT_SECRET || "",
        7 * 24 * 60 // 7 days in minutes
      );

      // Set HttpOnly Cookie and Redirect
      const isLocalhost = (event.requestContext?.domainName || "").includes("localhost");
      const cookieAttrs = isLocalhost ? "Path=/; HttpOnly; SameSite=Lax" : "Path=/; HttpOnly; Secure; SameSite=None";
      const setCookie = `opita_session=${sessionToken}; ${cookieAttrs}; Max-Age=${7 * 24 * 60 * 60}`;

      return {
        statusCode: 302,
        headers: {
          "Location": frontendUrl,
          "Set-Cookie": setCookie
        }
      };
    }

    if (path === "/auth/me" && method === "GET") {
      // Leer cookie
      const cookies = event.cookies || [];
      const cookieHeader = event.headers.cookie || "";
      
      let sessionToken = null;
      
      // Extraer opita_session de cookie string
      const match = cookieHeader.match(/opita_session=([^;]+)/);
      if (match) {
        sessionToken = match[1];
      } else {
        // En HTTP API v2, los cookies pueden venir en el array event.cookies
        for (const c of cookies) {
          if (c.startsWith("opita_session=")) {
            sessionToken = c.split("=")[1];
            break;
          }
        }
      }

      if (!sessionToken) {
        return { statusCode: 401, body: JSON.stringify({ error: "No session" }) };
      }

      try {
        const payload = verifyJWT(sessionToken, process.env.JWT_SECRET || "") as any;
        
        const userDb = await docClient.send(new GetCommand({
          TableName: Resource.Users.name,
          Key: { email: payload.email }
        }));
        
        const plan = userDb.Item?.plan || "free";

        return {
          statusCode: 200,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ user: { email: payload.email, role: payload.role, plan } })
        };
      } catch (e) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Invalid session" }) };
      }
    }

    if (path === "/auth/logout" && method === "POST") {
      const isLocalhost = (event.requestContext?.domainName || "").includes("localhost");
      const cookieAttrs = isLocalhost ? "Path=/; HttpOnly; SameSite=Lax" : "Path=/; HttpOnly; Secure; SameSite=None";
      return {
        statusCode: 200,
        headers: {
          ...getCorsHeaders(event),
          "Set-Cookie": `opita_session=; ${cookieAttrs}; Max-Age=0`
        },
        body: JSON.stringify({ success: true })
      };
    }

    // Projects endpoints
    if (path === "/projects" && (method === "GET" || method === "POST")) {
      const cookies = event.cookies || [];
      const cookieHeader = event.headers.cookie || "";
      let sessionToken = null;

      const match = cookieHeader.match(/opita_session=([^;]+)/);
      if (match) {
        sessionToken = match[1];
      } else {
        for (const c of cookies) {
          if (c.startsWith("opita_session=")) {
            sessionToken = c.split("=")[1];
            break;
          }
        }
      }

      if (!sessionToken) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      let payload: any;
      try {
        payload = verifyJWT(sessionToken, process.env.JWT_SECRET || "");
      } catch (e) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      const email = payload.email as string;

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
          body: JSON.stringify(projects),
        };
      }

      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        
        if (!body.title || !body.description) {
          return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
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
          body: JSON.stringify([newProject]),
        };
      }
    }

    // ─── Password Auth ────────────────────────────────────────
    if (path === "/auth/register" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const email = body.email?.trim()?.toLowerCase();
      const password = body.password;
      const name = body.name?.trim() || email?.split("@")[0] || "Usuario";

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || !emailRegex.test(email)) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Email inválido" }) };
      }
      if (!password || password.length < 8) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "La contraseña debe tener mínimo 8 caracteres" }) };
      }

      // Check if user already has a password
      const existingUser = await docClient.send(new GetCommand({
        TableName: Resource.Users.name,
        Key: { email }
      }));

      if (existingUser.Item?.password_hash) {
        return { statusCode: 409, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Este correo ya está registrado. Usa iniciar sesión." }) };
      }

      const { hash, salt } = hashPassword(password);

      // Upsert: merge with existing magic-link user or create new
      await docClient.send(new PutCommand({
        TableName: Resource.Users.name,
        Item: {
          ...(existingUser.Item || {}),
          email,
          name,
          password_hash: hash,
          password_salt: salt,
          plan: existingUser.Item?.plan || "free",
          created_at: existingUser.Item?.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
        }
      }));

      // Generate session (same as magic link flow)
      const sessionToken = signJWT(
        { email, role: "authenticated" },
        process.env.JWT_SECRET || "",
        7 * 24 * 60
      );

      const isLocalhost = (event.requestContext?.domainName || "").includes("localhost");
      const cookieAttrs = isLocalhost ? "Path=/; HttpOnly; SameSite=Lax" : "Path=/; HttpOnly; Secure; SameSite=None";
      const setCookie = `opita_session=${sessionToken}; ${cookieAttrs}; Max-Age=${7 * 24 * 60 * 60}`;

      return {
        statusCode: 201,
        headers: {
          ...getCorsHeaders(event),
          "Set-Cookie": setCookie,
        },
        body: JSON.stringify({ message: "Registro exitoso", user: { email, name, plan: existingUser.Item?.plan || "free" } }),
      };
    }

    if (path === "/auth/login" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const email = body.email?.trim()?.toLowerCase();
      const password = body.password;

      if (!email || !password) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Email y contraseña son requeridos" }) };
      }

      const userResult = await docClient.send(new GetCommand({
        TableName: Resource.Users.name,
        Key: { email }
      }));

      if (!userResult.Item) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Credenciales inválidas" }) };
      }

      if (!userResult.Item.password_hash || !userResult.Item.password_salt) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Esta cuenta usa enlace mágico. Solicita uno o regístrate con contraseña." }) };
      }

      const isValid = verifyPassword(password, userResult.Item.password_hash, userResult.Item.password_salt);
      if (!isValid) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Credenciales inválidas" }) };
      }

      // Update last_login
      await docClient.send(new PutCommand({
        TableName: Resource.Users.name,
        Item: {
          ...userResult.Item,
          last_login: new Date().toISOString(),
        }
      }));

      const sessionToken = signJWT(
        { email, role: "authenticated" },
        process.env.JWT_SECRET || "",
        7 * 24 * 60
      );

      const isLocalhost = (event.requestContext?.domainName || "").includes("localhost");
      const cookieAttrs = isLocalhost ? "Path=/; HttpOnly; SameSite=Lax" : "Path=/; HttpOnly; Secure; SameSite=None";
      const setCookie = `opita_session=${sessionToken}; ${cookieAttrs}; Max-Age=${7 * 24 * 60 * 60}`;

      return {
        statusCode: 200,
        headers: {
          ...getCorsHeaders(event),
          "Set-Cookie": setCookie,
        },
        body: JSON.stringify({ message: "Login exitoso", user: { email, name: userResult.Item.name || email.split("@")[0], plan: userResult.Item.plan || "free" } }),
      };
    }

    // ─── Token Usage Endpoint ────────────────────────────────────
    if (path === "/usage" && method === "GET") {
      const cookies = event.cookies || [];
      const cookieHeader = event.headers.cookie || "";
      let sessionToken = null;

      const match = cookieHeader.match(/opita_session=([^;]+)/);
      if (match) {
        sessionToken = match[1];
      } else {
        for (const c of cookies) {
          if (c.startsWith("opita_session=")) {
            sessionToken = c.split("=")[1];
            break;
          }
        }
      }

      if (!sessionToken) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "No session" }) };
      }

      let payload: any;
      try {
        payload = verifyJWT(sessionToken, process.env.JWT_SECRET || "");
      } catch (e) {
        return { statusCode: 401, headers: getCorsHeaders(event), body: JSON.stringify({ error: "Invalid session" }) };
      }

      const email = payload.email as string;

      // Get user plan
      const userDb = await docClient.send(new GetCommand({
        TableName: Resource.Users.name,
        Key: { email }
      }));
      const plan = userDb.Item?.plan || "free";

      // Token quota constants (must match chat.ts)
      const TOKEN_QUOTAS: Record<string, { daily: number; hourly: number }> = {
        free:       { daily: 150_000,   hourly: 30_000 },
        estudiante: { daily: 250_000,   hourly: 60_000 },
        pro:        { daily: 1_000_000, hourly: 200_000 },
      };
      const quota = TOKEN_QUOTAS[plan] || TOKEN_QUOTAS.pro;

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
          tokensLimitDaily: quota.daily,
          tokensUsedThisHour,
          tokensLimitHourly: quota.hourly,
          plan,
          resetDailyAt: resetDaily.toISOString(),
          resetHourlyAt: resetHourly.toISOString(),
        }),
      };
    }

    return { statusCode: 404, body: "Not found" };

  } catch (err: any) {
    console.error("Auth Error:", err.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
