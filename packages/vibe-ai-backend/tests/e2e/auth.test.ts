import { describe, it, expect, vi } from "vitest";

// Mock SST Resource
vi.mock("sst", () => ({
  Resource: {
    Users: { name: "test-vibe-studio-Users" },
    UserKeys: { name: "test-vibe-studio-UserKeys" },
  }
}));

import { handler } from "../../src/api/core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient } from "@aws-sdk/client-ses";

// Mock SESClient so we can capture the magic link token
const sendMock = vi.fn().mockResolvedValue({});
vi.spyOn(SESClient.prototype, "send").mockImplementation(sendMock);

// Create client for test assertions against LocalStack
const ddbClient = new DynamoDBClient({
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

describe("Auth Flow E2E (LocalStack)", () => {
  it("should generate a magic link and store the user in DynamoDB", async () => {
    // 1. Simulate API Gateway event for /auth/request
    const event = {
      rawPath: "/auth/request",
      requestContext: {
        http: { method: "POST", path: "/auth/request" },
      },
      headers: {
        origin: "http://localhost:1420",
      },
      body: JSON.stringify({
        email: "e2e@opitacode.com",
        redirectTo: "http://localhost:1420/app/"
      })
    };

    const response = await handler(event as any, {} as any);

    // 2. Validate response
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Magic link sent");

    // 3. Extract the token from the email that would have been sent
    expect(sendMock).toHaveBeenCalled();
    const sendCallArg = sendMock.mock.calls[0][0];
    const emailBody = sendCallArg.input.Message.Body.Html.Data;
    // Extract token from <a href="http.../auth/verify?token=XYZ">
    const tokenMatch = emailBody.match(/token=([a-zA-Z0-9._-]+)/);
    expect(tokenMatch).toBeDefined();
    const token = tokenMatch[1];

    // 4. Simulate API Gateway event for /auth/verify
    const verifyEvent = {
      rawPath: "/auth/verify",
      requestContext: {
        http: { method: "GET", path: "/auth/verify" },
      },
      queryStringParameters: {
        token: token
      }
    };

    const verifyResponse = await handler(verifyEvent as any, {} as any);
    expect(verifyResponse.statusCode).toBe(302);
    expect(verifyResponse.headers.Location).toContain("http://localhost:1420/app/");
    
    // 5. Verify user was created in DynamoDB
    const userResult = await docClient.send(new GetCommand({
      TableName: "test-vibe-studio-Users",
      Key: { email: "e2e@opitacode.com" } // the key is email in core.ts (Item: { email: email })
    }));

    expect(userResult.Item).toBeDefined();
    expect(userResult.Item?.email).toBe("e2e@opitacode.com");
  });
});
