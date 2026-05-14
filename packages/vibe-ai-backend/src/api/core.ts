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



const sendMagicLinkEmail = async (email: string, token: string) => {
  const fromEmail = process.env.SES_FROM_EMAIL || "auth@opitacode.com";
  const apiDomain = process.env.API_URL || "http://localhost:3000"; // We should pass AuthApiUrl if we can, but it's cyclic.
  // Actually, we can use the request context to reconstruct the API URL, or just pass it in env.
  // We'll rely on the event requestContext or a FRONTEND_URL.
  return; // Implement later
};

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

      let redirectTo = body.redirectTo || "https://opitacode.com";
      if (!redirectTo.startsWith("http://localhost:") && !redirectTo.startsWith("https://opitacode.com") && !redirectTo.includes(".opitacode.com")) {
        redirectTo = "https://opitacode.com";
      }

      const token = signJWT(
        { email, type: "magic_link", redirectTo },
        process.env.JWT_SECRET || "opita_secret_for_dev_only_123",
        15
      );

      const frontendUrl = process.env.FRONTEND_URL || "https://opitacode.com";
      const apiHost = event.requestContext?.domainName || "localhost";
      const protocol = apiHost.includes("localhost") ? "http" : "https";
      const verifyUrl = `${protocol}://${apiHost}/auth/verify?token=${token}`;

      const fromEmail = process.env.SES_FROM_EMAIL || "auth@opitacode.com";

      try {
        await sesClient.send(new SendEmailCommand({
          Source: fromEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: "Tu enlace mágico de acceso - Opita Code" },
            Body: {
              Html: {
                Data: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
                  <h2>¡Hola!</h2>
                  <p>Haz clic en el botón de abajo para iniciar sesión de forma segura.</p>
                  <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0F172A; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Iniciar Sesión</a>
                  <p style="margin-top: 20px; font-size: 12px; color: #666;">Si no solicitaste este correo, puedes ignorarlo.</p>
                </div>
                `
              }
            }
          }
        }));
      } catch (e: any) {
        console.error("SES Error:", e.message || e);
        // Fallback para dev: si falla SES, imprimir en consola
        console.log("MAGIC_LINK_URL_DEV_FALLBACK:", verifyUrl);
        // Si estamos en AWS, igual devolvemos 200 para prevenir email enumeration
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
        payload = verifyJWT(token, process.env.JWT_SECRET || "opita_secret_for_dev_only_123");
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

      let frontendUrl = payload.redirectTo || process.env.FRONTEND_URL || "https://opitacode.com/projects";
      if (!frontendUrl.startsWith("http://localhost:") && !frontendUrl.startsWith("https://opitacode.com") && !frontendUrl.includes(".opitacode.com")) {
        frontendUrl = "https://opitacode.com/projects";
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
        process.env.JWT_SECRET || "opita_secret_for_dev_only_123",
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
        const payload = verifyJWT(sessionToken, process.env.JWT_SECRET || "opita_secret_for_dev_only_123") as any;
        
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
        payload = verifyJWT(sessionToken, process.env.JWT_SECRET || "opita_secret_for_dev_only_123");
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
        process.env.JWT_SECRET || "opita_secret_for_dev_only_123",
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
        process.env.JWT_SECRET || "opita_secret_for_dev_only_123",
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

    return { statusCode: 404, body: "Not found" };

  } catch (err: any) {
    console.error("Auth Error:", err.message || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
