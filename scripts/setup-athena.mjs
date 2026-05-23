#!/usr/bin/env node
// ─── Athena DDL Setup ───────────────────────────────────────────
// Run this script ONCE after the first deploy to create the Athena
// database and external table that enables SQL queries over the
// OpitaDataLake S3 bucket.
//
// Usage:
//   node scripts/setup-athena.mjs
//
// Prerequisites:
//   - AWS CLI configured with appropriate credentials
//   - OpitaDataLake S3 bucket already deployed via SST

import { execSync } from "child_process";

// ── 1. Resolve the S3 bucket name from the SST stack outputs ────
console.log("🔍 Resolving OpitaDataLake bucket name from SST outputs...");

let bucketName;
try {
  const outputs = execSync(
    'aws cloudformation describe-stacks --stack-name prod-opita-vibe-studio --query "Stacks[0].Outputs[?OutputKey==\'DataLakeBucketName\'].OutputValue" --output text',
    { encoding: "utf-8" },
  ).trim();
  bucketName = outputs;
} catch {
  // Fallback: scan for the bucket by prefix
  const buckets = execSync("aws s3 ls", { encoding: "utf-8" });
  const match = buckets
    .split("\n")
    .find((l) => l.includes("opitadatalake") || l.includes("opita-data-lake"));
  if (match) {
    bucketName = match.trim().split(/\s+/).pop();
  }
}

if (!bucketName) {
  console.error(
    "❌ Could not resolve OpitaDataLake bucket name. Deploy the SST stack first.",
  );
  process.exit(1);
}

console.log(`✅ Bucket: ${bucketName}`);

// ── 2. Create the Athena database ───────────────────────────────
const createDbQuery = `CREATE DATABASE IF NOT EXISTS opita_analytics_db;`;

// ── 3. Create the external table with Hive partitioning ─────────
const createTableQuery = `
CREATE EXTERNAL TABLE IF NOT EXISTS opita_analytics_db.events (
  pk string,
  sk string,
  type string,
  source string,
  productId string,
  sessionId string,
  userId string,
  ip string,
  userAgent string,
  consent string,
  data struct<
    url:string,
    referrer:string,
    email:string,
    message:string,
    button_id:string,
    error_message:string,
    text:string,
    platform:string,
    utm_source:string,
    utm_medium:string,
    utm_campaign:string,
    hasMessage:boolean,
    userId:string,
    previousSessionId:string
  >,
  expiresAt bigint
)
PARTITIONED BY (
  product_id string,
  year string,
  month string,
  day string
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES ('ignore.malformed.json' = 'true')
LOCATION 's3://${bucketName}/'
TBLPROPERTIES ('has_encrypted_data'='false');
`;

// ── 4. Auto-discover partitions ─────────────────────────────────
const repairQuery = `MSCK REPAIR TABLE opita_analytics_db.events;`;

// ── 5. Execute via AWS CLI ──────────────────────────────────────
const outputLocation = `s3://${bucketName}/athena-results/`;

function runAthenaQuery(label, query) {
  console.log(`\n⏳ ${label}...`);
  const cleanQuery = query.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const result = execSync(
      `aws athena start-query-execution --query-string "${cleanQuery}" --result-configuration "OutputLocation=${outputLocation}" --output json`,
      { encoding: "utf-8" },
    );
    const parsed = JSON.parse(result);
    console.log(
      `   ✅ Query submitted: ${parsed.QueryExecutionId}`,
    );
    return parsed.QueryExecutionId;
  } catch (err) {
    console.error(`   ❌ Failed: ${err.message}`);
    return null;
  }
}

runAthenaQuery("Creating database", createDbQuery);

// Wait a moment for the database to be created
console.log("   ⏳ Waiting 5s for database creation...");
execSync("timeout /t 5 /nobreak > nul 2>&1 || sleep 5", { stdio: "ignore" });

runAthenaQuery("Creating events table", createTableQuery);

console.log("   ⏳ Waiting 5s for table creation...");
execSync("timeout /t 5 /nobreak > nul 2>&1 || sleep 5", { stdio: "ignore" });

runAthenaQuery("Auto-discovering partitions", repairQuery);

console.log("\n🎉 Athena setup complete!");
console.log(`\nYou can now query your telemetry data in the AWS Athena console:`);
console.log(`  SELECT type, count(*) as total FROM opita_analytics_db.events GROUP BY type ORDER BY total DESC;`);
