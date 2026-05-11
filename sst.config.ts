/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "opita-vibe-studio",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // 1.2 Crear tabla DynamoDB
    const table = new sst.aws.Dynamo("Conversations", {
      fields: {
        id: "string",
      },
      primaryIndex: { hashKey: "id" },
    });

    // 1.3 Endpoint Dummy Streaming
    const api = new sst.aws.Function("ChatStreamAPI", {
      url: true, // Enables AWS Lambda Function URLs
      handler: "packages/vibe-ai-backend/src/api/chat.handler",
      link: [table], // Grants IAM permissions automatically
      environment: {
        JWT_SECRET: process.env.JWT_SECRET || "opita_secret_for_dev_only_123",
        DEEP_SEEK_KEY: process.env.DEEP_SEEK_KEY || "",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
      },
      streaming: true, // Crucial for 15-minute connection and real-time response
    });

    return {
      ChatApiUrl: api.url,
      TableName: table.name,
    };
  },
});
