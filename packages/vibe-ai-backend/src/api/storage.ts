import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource as SSTResource } from "sst";
const Resource = SSTResource as any;
import * as jwt from "jose";

const s3Client = new S3Client({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event: any) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "No token provided" }) };
    }

    const token = authHeader.replace("Bearer ", "");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    let payload;
    try {
      const { payload: verifiedPayload } = await jwt.jwtVerify(token, secret);
      payload = verifiedPayload;
    } catch (e) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Invalid token" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const { action, projectId, filename, contentType } = body;
    const userId = payload.sub || "anonymous";

    // ─── Cloud Sync (Proyectos) ──────────────────────────────────────────
    if (action === "upload" || action === "download") {
      if (!projectId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Falta projectId" }) };
      }

      // Validar que el ID sea seguro (solo alfanumérico y guiones)
      const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
      const objectKey = `projects/${userId}/${safeProjectId}.zip`;

      if (action === "upload") {
        const command = new PutObjectCommand({
          Bucket: Resource.VibeStorage.name,
          Key: objectKey,
          ContentType: "application/zip",
        });
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ uploadUrl, objectKey }),
        };
      }

      if (action === "download") {
        const command = new GetObjectCommand({
          Bucket: Resource.VibeStorage.name,
          Key: objectKey,
        });
        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ downloadUrl, objectKey }),
        };
      }
    }

    // ─── Generic File Upload (Chat Attachments) ─────────────────────────
    if (!filename || !contentType) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Falta filename o contentType" }) };
    }

    const uniqueId = crypto.randomUUID();
    const objectKey = `uploads/${userId}/${uniqueId}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: Resource.VibeStorage.name,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const fileUrl = `https://${Resource.VibeStorage.name}.s3.amazonaws.com/${objectKey}`;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ uploadUrl, fileUrl, objectKey }),
    };
  } catch (err: any) {
    console.error("Storage Error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Error interno del servidor", details: err.message }),
    };
  }
};
