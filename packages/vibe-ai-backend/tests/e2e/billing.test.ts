import { test, expect, vi, beforeAll } from "vitest";
import { handler } from "../../src/api/billing";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

// Mock SST Resource to point to LocalStack tables
vi.mock("sst", () => ({
  Resource: {
    Users: { name: "test-vibe-studio-Users" },
    Transactions: { name: "test-vibe-studio-Transactions" },
  }
}));

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
}));

const WEBHOOK_SECRET = "test_webhook_secret_123";

beforeAll(async () => {
  process.env.WOMPI_WEBHOOK_SECRET = WEBHOOK_SECRET;
  
  // Seed a test user
  await ddb.send(new PutCommand({
    TableName: "test-vibe-studio-Users",
    Item: { email: "student@test.com", plan: "free" }
  }));
});

test("Wompi Webhook successfully upgrades user to Pro", async () => {
  const transactionId = `tx_wompi_${Date.now()}`;
  const userId = "student@test.com";
  // The reference format is: PREFIX_OPCIONAL_{userId}_{timestamp}
  const reference = `VIBE_STUDENT_${userId}_123456789`;

  const data = {
    transaction: {
      id: transactionId,
      reference: reference,
      status: "APPROVED",
      amount_in_cents: 1190000,
      currency: "COP"
    }
  };

  const timestamp = Date.now();
  
  // Create Signature
  const signatureString = `${transactionId}${reference}APPROVED1190000COP${timestamp}${WEBHOOK_SECRET}`;
  const checksum = crypto.createHash('sha256').update(signatureString).digest('hex');

  const payload = {
    event: "transaction.updated",
    data,
    signature: {
      properties: [
        "transaction.id",
        "transaction.reference",
        "transaction.status",
        "transaction.amount_in_cents",
        "transaction.currency"
      ],
      checksum
    },
    timestamp
  };

  const event = {
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(payload)
  };

  const response = await handler(event as any);
  
  expect(response.statusCode).toBe(200);
  expect(response.body).toBe("OK");

  // Verify DB state
  const txCheck = await ddb.send(new GetCommand({
    TableName: "test-vibe-studio-Transactions",
    Key: { id: transactionId }
  }));
  expect(txCheck.Item).toBeDefined();
  expect(txCheck.Item?.user_id).toBe(userId);
  expect(txCheck.Item?.status).toBe("APPROVED");

  const userCheck = await ddb.send(new GetCommand({
    TableName: "test-vibe-studio-Users",
    Key: { email: userId }
  }));
  expect(userCheck.Item).toBeDefined();
  expect(userCheck.Item?.plan).toBe("estudiante");
});
