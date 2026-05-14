import { Resource as SSTResource } from "sst";
import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const Resource = SSTResource as any;

const awsConfig = process.env.LOCALSTACK_ENDPOINT ? {
  endpoint: process.env.LOCALSTACK_ENDPOINT,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
} : {};

const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

interface WompiEvent {
  event: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
      amount_in_cents: number;
      currency: string;
    };
  };
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
}

export async function handler(event: any) {
  try {
    if (event.requestContext.http.method !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}") as WompiEvent;
    
    // 1. Validar firma de Wompi
    const secret = process.env.WOMPI_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Falta WOMPI_WEBHOOK_SECRET en el ambiente");
      return { statusCode: 500, body: "Internal Server Error" };
    }

    const { signature, data } = body;
    const tx = data.transaction;

    // Generar string para el checksum
    // Según doc de Wompi, el string concatena los valores de las properties + timestamp + secret
    let signatureString = "";
    for (const prop of signature.properties) {
      const parts = prop.split('.');
      let val: any = data;
      for (const p of parts) val = val[p];
      signatureString += val;
    }
    signatureString += body.timestamp;
    signatureString += secret;

    const expectedChecksum = crypto.createHash('sha256').update(signatureString).digest('hex');

    if (expectedChecksum !== signature.checksum) {
      console.error("Firma de Wompi inválida", { expectedChecksum, received: signature.checksum });
      return { statusCode: 401, body: "Unauthorized - Invalid Signature" };
    }

    // 2. Procesar el evento
    if (body.event === "transaction.updated" && tx.status === "APPROVED") {
      const refParts = tx.reference.split("_");
      
      let productId = "VIBE_STUDIO";
      let userId = "";
      
      if (refParts.length >= 3) {
        // Formato esperado: PREFIX_OPCIONAL_{userId}_{timestamp}
        userId = refParts[refParts.length - 2];
        const prefixParts = refParts.slice(0, refParts.length - 2);
        productId = prefixParts.join("_");

        if (productId === "VIBE_PRO" || productId === "VIBE_STUDIO") {
          productId = "VIBE_STUDIO";
        }
      } else if (refParts.length === 2) {
        // Fallback poco probable: {PRODUCT}_{userId} sin timestamp
        productId = refParts[0];
        userId = refParts[1];
      } else {
        console.error("Referencia no reconocible, ignorando userId:", tx.reference);
      }

      console.log(`Procesando pago para producto ${productId}, usuario ${userId}`);

      try {
        // A) Registrar transacción
        await docClient.send(new PutCommand({
          TableName: Resource.Transactions.name,
          Item: {
            id: tx.id,
            user_id: userId,
            product_id: productId,
            amount_in_cents: tx.amount_in_cents,
            currency: tx.currency,
            status: tx.status,
            created_at: new Date().toISOString()
          }
        }));

        // B) Actualizar perfil del usuario
        if (productId === "VIBE_STUDIO" || productId === "VIBE_STUDENT") {
          const newPlan = productId === "VIBE_STUDENT" ? "estudiante" : "pro";
          await docClient.send(new UpdateCommand({
            TableName: Resource.Users.name,
            Key: { email: userId }, // El userId que viene de Wompi debe ser el email
            UpdateExpression: "SET #plan = :plan, updated_at = :updated_at",
            ExpressionAttributeNames: {
              "#plan": "plan"
            },
            ExpressionAttributeValues: {
              ":plan": newPlan,
              ":updated_at": new Date().toISOString()
            }
          }));
          console.log(`Usuario ${userId} actualizado a plan ${newPlan}`);
        }
      } catch (dbError) {
        console.error("Error actualizando base de datos:", dbError);
        return { statusCode: 500, body: "Error interno de base de datos" };
      }
    }

    return { statusCode: 200, body: "OK" };
  } catch (err: any) {
    console.error("Error en el webhook de Wompi", err);
    return { statusCode: 500, body: "Error procesando el webhook" };
  }
}
