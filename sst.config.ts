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
    // Strip UTF-8 BOM (U+FEFF) from ALL env vars — GitHub Secrets can carry invisible
    // BOM chars from copy-paste that silently break API keys and credentials.
    for (const key of Object.keys(process.env)) {
      const val = process.env[key];
      if (val && val.charCodeAt(0) === 0xFEFF) {
        process.env[key] = val.slice(1).trim();
      }
    }
    const aws = await import("@pulumi/aws");

    // Read external table names and API URL from SSM with stage-based fallbacks for robust local/dev deployments
    let usersTableName: string;
    try {
      const usersTableNameParam = await aws.ssm.getParameter({
        name: `/opita-account/${$app.stage}/users-table-name`,
      });
      usersTableName = usersTableNameParam.value;
    } catch (e) {
      if ($app.stage === "prod") throw e;
      usersTableName = "opita-vibe-studio-dev-UsersTable-bofxhecu";
      console.warn(`⚠️ SSM parameter users-table-name not found for stage ${$app.stage}. Falling back to ${usersTableName}`);
    }

    let userKeysTableName: string;
    try {
      const userKeysTableNameParam = await aws.ssm.getParameter({
        name: `/opita-account/${$app.stage}/user-keys-table-name`,
      });
      userKeysTableName = userKeysTableNameParam.value;
    } catch (e) {
      if ($app.stage === "prod") throw e;
      userKeysTableName = "opita-vibe-studio-dev-UserKeysTable-bctnrwvd";
      console.warn(`⚠️ SSM parameter user-keys-table-name not found for stage ${$app.stage}. Falling back to ${userKeysTableName}`);
    }

    let authApiUrl: string;
    try {
      const authApiUrlParam = await aws.ssm.getParameter({
        name: `/opita-account/${$app.stage}/auth-api-url`,
      });
      authApiUrl = authApiUrlParam.value;
    } catch (e) {
      if ($app.stage === "prod") throw e;
      authApiUrl = "https://dh7vsijy4ftdy7pek7vhhxc47i0nuapu.lambda-url.us-east-1.on.aws/";
      console.warn(`⚠️ SSM parameter auth-api-url not found for stage ${$app.stage}. Falling back to ${authApiUrl}`);
    }

    // 1.2 Crear tabla DynamoDB (Conversations)
    const table = new sst.aws.Dynamo("Conversations", {
      fields: {
        id: "string",
      },
      primaryIndex: { hashKey: "id" },
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

    // 1.2g Analytics Events — product telemetry for Opita Sync
    // pk: "events#{userId|anon-sessionId}", sk: "{ISO-timestamp}#{event-id}"
    // TTL: 90 days auto-cleanup
    const analyticsTable = new sst.aws.Dynamo("AnalyticsEvents", {
      fields: {
        pk: "string",
        sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expiresAt",
      stream: "new-image",
    });

    // 1.2h Data Lake — cold storage for historical analytics
    const dataLakeBucket = new sst.aws.Bucket("OpitaDataLake");

    // 1.2i Stream Processor — archives DynamoDB events to S3
    const streamProcessor = new sst.aws.Function("TelemetryStreamProcessor", {
      handler: "packages/vibe-ai-backend/src/api/telemetry-stream.handler",
      link: [dataLakeBucket],
      timeout: "60 seconds",
    });
    analyticsTable.subscribe(streamProcessor);

    const externalDynamoPermissions = {
      actions: ["dynamodb:*"],
      resources: [
        `arn:aws:dynamodb:us-east-1:*:table/${usersTableName}`,
        `arn:aws:dynamodb:us-east-1:*:table/${userKeysTableName}`,
      ],
    };

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
      link: [table, tokenUsageTable], // Grants IAM permissions automatically
      permissions: [externalDynamoPermissions],
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "",
        DEEP_SEEK_KEY: process.env.DEEP_SEEK_KEY || "",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
        API_GOOGLE_CLOUD: process.env.API_GOOGLE_CLOUD || "",
        AI_STUDIO_GOOGLE: process.env.AI_STUDIO_GOOGLE || "",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
        USERS_TABLE_NAME: usersTableName,
        USER_KEYS_TABLE_NAME: userKeysTableName,
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
      link: [transactionsTable],
      permissions: [externalDynamoPermissions],
      environment: {
        WOMPI_WEBHOOK_SECRET: process.env.WOMPI_WEBHOOK_SECRET || "",
        WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY || "",
        WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET || "",
        JWT_SECRET: process.env.JWT_SECRET || "",
        USERS_TABLE_NAME: usersTableName,
        USER_KEYS_TABLE_NAME: userKeysTableName,
      },
    });

    // 1.7 Endpoint de Autenticación y Proyectos (CoreAPI)
    const coreApi = new sst.aws.Function("CoreAPI", {
      url: { cors: false },
      handler: "packages/vibe-ai-backend/src/api/core.handler",
      link: [projectsTable, tokenUsageTable, analyticsTable],
      permissions: [
        {
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
        },
        {
          actions: [
            "cognito-idp:AdminUpdateUserAttributes",
            "cognito-idp:AdminInitiateAuth",
            "cognito-idp:AdminRespondToAuthChallenge",
            "cognito-idp:AdminCreateUser",
          ],
          resources: ["arn:aws:cognito-idp:us-east-1:*:userpool/us-east-1_LItAcj2Aa"],
        },
        externalDynamoPermissions,
      ],
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "",
        FRONTEND_URL: process.env.FRONTEND_URL || ($app.stage === "prod" ? "https://vibe.opitacode.com" : "http://localhost:3000"),
        SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "noreply@opitacode.com",
        OPITA_LINKS_API_KEY: process.env.OPITA_LINKS_API_KEY || "",
        STABLE_API_DOMAIN: "api.opitacode.com",
        STAGING_WHITELIST: process.env.STAGING_WHITELIST || "",
        USERS_TABLE_NAME: usersTableName,
        USER_KEYS_TABLE_NAME: userKeysTableName,
      },
    });

    // 1.8 Sync API — Opita Sync Operations Hub with server-side tools
    const syncApi = new sst.aws.Function("SyncAPI", {
      url: {
        cors: {
          allowOrigins: [
            "https://sync.opitacode.com",
            "https://admin.opitacode.com", // Legacy alias
            "http://localhost:5174",
            "http://localhost:5175",
          ],
          allowMethods: ["POST"],
          allowHeaders: ["Content-Type", "Authorization", "Cookie"],
          allowCredentials: true,
        },
      },
      handler: "packages/vibe-ai-backend/src/api/admin.handler",
      link: [transactionsTable, tokenUsageTable, projectsTable, table, analyticsTable, storageBucket],
      permissions: [externalDynamoPermissions],
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "",
        API_GOOGLE_CLOUD: process.env.API_GOOGLE_CLOUD || "",
        AI_STUDIO_GOOGLE: process.env.AI_STUDIO_GOOGLE || "",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        ADMIN_EMAILS: process.env.ADMIN_EMAILS || "",
        USERS_TABLE_NAME: usersTableName,
        USER_KEYS_TABLE_NAME: userKeysTableName,
      },
      streaming: true,
    });

    const router = new sst.aws.Router("VibeRouter", {
      domain: $app.stage === "prod" ? "api.opitacode.com" : "api-dev.opitacode.com",
      routes: {
        "/sync/*": syncApi.url,
        "/billing/*": billingApi.url,
        "/chat/*": api.url,
        "/core/auth/*": authApiUrl,
        "/core/*": coreApi.url,
        "/storage/*": storageApi.url,
      },
      // ═══════════════════════════════════════════════════════════════
      // ⚠️  CLOUDFRONT CACHE POLICY — READ BEFORE CHANGING  ⚠️
      // ═══════════════════════════════════════════════════════════════
      //
      // headerBehavior: "whitelist" + ["Authorization", "Origin"]
      //   ✅ Auth tokens reach Lambda → chat, billing, storage work
      //   ✅ Origin reaches Lambda → CORS headers returned correctly
      //   ⚠️  Disables CloudFront response caching (correct for API)
      //
      // headerBehavior: "none"
      //   ❌ BREAKS AUTH — Authorization header stripped → "Falta token"
      //   ✅ CORS works (Origin forwarded implicitly)
      //
      // headerBehavior: "whitelist" + ["Authorization"] (without Origin)
      //   ✅ Auth works
      //   ❌ BREAKS CORS — Origin stripped → no Access-Control-Allow-Origin
      //
      // BOTH Authorization AND Origin MUST be whitelisted.
      // Removing either one breaks production. See git blame for history.
      // ═══════════════════════════════════════════════════════════════
      transform: {
        cachePolicy: {
          parametersInCacheKeyAndForwardedToOrigin: {
            cookiesConfig: {
              cookieBehavior: "all",
            },
            headersConfig: {
              // ⚠️ BOTH headers are required:
              // - Authorization → auth tokens reach Lambda
              // - Origin → Lambda returns CORS headers
              // Removing either breaks production.
              headerBehavior: "whitelist",
              headers: {
                items: ["Authorization", "Origin"],
              },
            },
            queryStringsConfig: {
              queryStringBehavior: "all",
            },
          },
        },
      },
    });

    return {
      SyncApiUrl: syncApi.url,
      ChatApiUrl: api.url,
      StorageApiUrl: storageApi.url,
      BillingApiUrl: billingApi.url,
      CoreApiUrl: coreApi.url,
      RouterUrl: router.url,
      TableName: table.name,
      BucketName: storageBucket.name,
      DataLakeBucketName: dataLakeBucket.name,
    };
  },
});
