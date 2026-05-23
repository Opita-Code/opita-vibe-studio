// ─── Telemetry Stream Processor ─────────────────────────────────
// Triggered by DynamoDB Streams on the AnalyticsEvents table.
// Reads INSERT records, groups them by productId, and writes
// Hive-partitioned JSON files to the OpitaDataLake S3 bucket
// for downstream Athena queries.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource as SSTResource } from "sst";
import { gzipSync } from "node:zlib";

/** Minimal types for DynamoDB Stream events — avoids @types/aws-lambda dependency */
interface DynamoDBStreamEvent {
  Records: Array<{
    eventName?: string;
    dynamodb?: {
      NewImage?: Record<string, any>;
    };
  }>;
}

const Resource = SSTResource as any;
const s3 = new S3Client({});

/**
 * Groups stream records by productId and writes each group as a
 * single JSONL file to S3 under Hive-style partitions:
 *   product_id={id}/year={YYYY}/month={MM}/day={DD}/{timestamp}-{rand}.json
 */
export const handler = async (event: DynamoDBStreamEvent) => {
  const recordsByProduct: Record<string, any[]> = {};

  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    if (!record.dynamodb?.NewImage) continue;

    try {
      const item = unmarshall(record.dynamodb.NewImage as Record<string, any>);

      // Derive productId — field was added in the ingestion upgrade;
      // fall back to source mapping for pre-existing records.
      const productId =
        item.productId ||
        (item.source === "landing" ? "vibe-studio" : "vibe-studio");

      if (!recordsByProduct[productId]) {
        recordsByProduct[productId] = [];
      }

      recordsByProduct[productId].push(item);
    } catch (err) {
      console.error("[telemetry-stream] Failed to unmarshall record:", err);
    }
  }

  // Write one JSONL file per productId batch
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");

  const writes: Promise<any>[] = [];

  for (const [productId, records] of Object.entries(recordsByProduct)) {
    if (records.length === 0) continue;

    const fileContent = records.map((r) => JSON.stringify(r)).join("\n");
    const compressed = gzipSync(Buffer.from(fileContent, "utf-8"));
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `product_id=${productId}/year=${year}/month=${month}/day=${day}/${hour}-${Date.now()}-${rand}.json.gz`;

    writes.push(
      s3
        .send(
          new PutObjectCommand({
            Bucket: Resource.OpitaDataLake.name,
            Key: key,
            Body: compressed,
            ContentType: "application/json",
            ContentEncoding: "gzip",
          }),
        )
        .catch((err: any) =>
          console.error(
            `[telemetry-stream] S3 write failed for ${key}:`,
            err,
          ),
        ),
    );
  }

  await Promise.all(writes);

  const totalRecords = Object.values(recordsByProduct).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  console.log(
    `[telemetry-stream] Archived ${totalRecords} records across ${writes.length} products`,
  );
};
