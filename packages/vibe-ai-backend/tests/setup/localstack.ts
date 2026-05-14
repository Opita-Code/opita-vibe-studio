import { LocalstackContainer } from "@testcontainers/localstack";
import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { SESClient, VerifyEmailIdentityCommand } from "@aws-sdk/client-ses";

let container: any;

export default async function setup() {
  console.log("Starting LocalStack container...");
  container = await new LocalstackContainer("localstack/localstack:3.4").start();
  const endpoint = container.getConnectionUri();
  
  // Set endpoint globally so tests and code can use it
  process.env.LOCALSTACK_ENDPOINT = endpoint;
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";
  process.env.AWS_REGION = "us-east-1";
  process.env.SST_STAGE = "test";
  process.env.SES_FROM_EMAIL = "test@opitacode.com";
  process.env.JWT_SECRET = "test_secret_for_e2e_tests";

  console.log(`LocalStack running at ${endpoint}`);

  // Create DynamoDB Tables
  const ddb = new DynamoDBClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" }
  });

  console.log("Creating DynamoDB tables...");
  await ddb.send(new CreateTableCommand({
    TableName: "test-vibe-studio-Users", // We will override table names in core.ts during tests
    KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  }));

  await ddb.send(new CreateTableCommand({
    TableName: "test-vibe-studio-UserKeys",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "id", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "id", AttributeType: "S" }
    ],
    BillingMode: "PAY_PER_REQUEST",
  }));

  await ddb.send(new CreateTableCommand({
    TableName: "test-vibe-studio-Transactions",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  }));

  // Verify SES Identity
  const ses = new SESClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" }
  });

  console.log("Verifying SES Identity...");
  await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: "test@opitacode.com" }));

  console.log("LocalStack setup complete.");
}

export async function teardown() {
  console.log("Stopping LocalStack container...");
  if (container) {
    await container.stop();
  }
}
