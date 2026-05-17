/// <reference path="./.sst/platform/config.d.ts" />


export default $config({
  app(input) {
    return {
      name: "opita-vibe-studio",
      // Canonical stages: dev, prod. Do NOT use "production" — it creates a separate stack.
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const dotenv = await import("dotenv");
    dotenv.config();
    // 1.2 Crear tabla DynamoDB (Conversations)
    const table = new sst.aws.Dynamo("Conversations", {
      fields: {
        id: "string",
      },
      primaryIndex: { hashKey: "id" },
    });

    // 1.2b Crear tabla para llaves BYOK cifradas
    const keysTable = new sst.aws.Dynamo("UserKeys", {
      fields: {
        id: "string",
      },
      primaryIndex: { hashKey: "id" },
    });

    // 1.2c Crear tabla de Usuarios (Para Auth Custom)
    const usersTable = new sst.aws.Dynamo("Users", {
      fields: {
        email: "string", // Usaremos el email como clave principal para simplicidad
      },
      primaryIndex: { hashKey: "email" },
    });

    // 1.2d Crear tabla de Proyectos (Migración de Supabase)
    const projectsTable = new sst.aws.Dynamo("Projects", {
      fields: {
        client_id: "string",
        id: "string",
      },
      primaryIndex: { hashKey: "client_id", rangeKey: "id" },
    });

    // 1.2e Crear tabla de Transacciones (Wompi)
    const transactionsTable = new sst.aws.Dynamo("Transactions", {
      fields: {
        id: "string",
      },
      primaryIndex: { hashKey: "id" },
    });

    // 1.2f Crear tabla de Uso de Tokens (Quotas por ventana temporal)
    const tokenUsageTable = new sst.aws.Dynamo("TokenUsage", {
      fields: {
        pk: "string", // "user#{email}"
        sk: "string", // "daily#2026-05-14" o "hourly#2026-05-14T22"
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expiresAt",
    });

    // 1.3 Endpoint Dummy Streaming
    const api = new sst.aws.Function("ChatStreamAPI", {
      url: {
        cors: {
          allowOrigins: ["https://vibe.opitacode.com", "https://opitacode.com", "https://cuenta.opitacode.com", "http://localhost:1420"],
          allowMethods: ["POST"],
          allowHeaders: ["Content-Type", "Authorization", "Cookie"],
          allowCredentials: true,
        },
      },
      handler: "packages/vibe-ai-backend/src/api/chat.handler",
      link: [table, keysTable, usersTable, tokenUsageTable], // Grants IAM permissions automatically
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "",
        DEEP_SEEK_KEY: process.env.DEEP_SEEK_KEY || "",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
        AI_STUDIO_GOOGLE: process.env.AI_STUDIO_GOOGLE || "",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
      },
      streaming: true, // Crucial for 15-minute connection and real-time response
    });

    // 1.4 Crear Bucket para Vibe Storage
    const storageBucket = new sst.aws.Bucket("VibeStorage", {
      cors: {
        allowOrigins: [
          "https://vibe.opitacode.com",
          "https://opitacode.com",
          "https://cuenta.opitacode.com",
          "http://localhost:1420",
        ],
        allowMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        allowHeaders: ["*"],
      }
    });

    // 1.5 Endpoint genérico para Storage (Presigned URLs)
    const storageApi = new sst.aws.Function("StorageAPI", {
      url: true,
      handler: "packages/vibe-ai-backend/src/api/storage.handler",
      link: [storageBucket], // Grants S3 permissions automatically
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "",
      },
    });

    // 1.6 Endpoint de facturación (Webhook Wompi + Checkout Sign)
    const billingApi = new sst.aws.Function("BillingAPI", {
      url: { cors: false },
      handler: "packages/vibe-ai-backend/src/api/billing.handler",
      link: [transactionsTable, usersTable],
      environment: {
        WOMPI_WEBHOOK_SECRET: process.env.WOMPI_WEBHOOK_SECRET || "",
        WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY || "",
        WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET || "",
      },
    });

    // 1.7 Endpoint de Autenticación y Proyectos (CoreAPI)
    const coreApi = new sst.aws.Function("CoreAPI", {
      url: { cors: false },
      handler: "packages/vibe-ai-backend/src/api/core.handler",
      link: [usersTable, projectsTable, tokenUsageTable, keysTable],
      permissions: [
        {
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
        },
      ],
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "",
        FRONTEND_URL: process.env.FRONTEND_URL || ($app.stage === "prod" ? "https://vibe.opitacode.com" : "http://localhost:3000"),
        SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "owner@opitacode.com",
        OPITA_LINKS_API_KEY: process.env.OPITA_LINKS_API_KEY || "",
      },
    });

    const router = new sst.aws.Router("VibeRouter", {
      domain: $app.stage === "prod" ? "api.opitacode.com" : "api-dev.opitacode.com",
      routes: {
        "/billing/*": billingApi.url,
        "/chat/*": api.url,
        "/core/*": coreApi.url,
        "/storage/*": storageApi.url,
      }
    });

    return {
      ChatApiUrl: api.url,
      StorageApiUrl: storageApi.url,
      BillingApiUrl: billingApi.url,
      CoreApiUrl: coreApi.url,
      RouterUrl: router.url,
      TableName: table.name,
      BucketName: storageBucket.name,
    };
  },
});
