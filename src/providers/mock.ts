import type { ChatChunk } from "@/lib/types";

/**
 * Proveedor mock para streaming de prueba en Phase 3.
 * Devuelve un saludo en español carácter por carácter.
 * Será reemplazado por proveedores reales en Phase 4.
 */
export async function* mockStreamResponse(): AsyncGenerator<ChatChunk> {
  const response = "Hola, soy Opita Vibe. ¿En qué te puedo ayudar?";

  for (const char of response) {
    yield { type: "text", content: char };
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  yield { type: "done", content: "" };
}
