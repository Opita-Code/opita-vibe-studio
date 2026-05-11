import * as jose from "jose";
import { streamText, tool, LanguageModelV1 } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

declare const awslambda: any;

const SYSTEM_PROMPT = `Eres Vibe Studio, un agente ingeniero de IA senior enfocado en TDD (Test-Driven Development).
REGLA ESTRICTA 1: NUNCA asumas el contenido de un archivo. Si necesitas modificar algo, usa la herramienta 'read_local_file' primero.
REGLA ESTRICTA 2: Cuando se te pida crear código, DEBES escribir un test primero y usar 'execute_test_command' para correrlo en la máquina del usuario.
REGLA ESTRICTA 3: Solo puedes entregar la respuesta final de código una vez que la herramienta te confirme que el test pasó exitosamente.`;

// Fábrica de modelos Vercel AI SDK
function getModel(providerId: string, customApiKey?: string): LanguageModelV1 {
  switch (providerId) {
    case "deepseek":
      const deepseek = createOpenAI({
        baseURL: "https://api.deepseek.com/v1",
        apiKey: customApiKey || process.env.DEEP_SEEK_KEY,
      });
      return deepseek('deepseek-chat');

    case "openai":
      const openai = createOpenAI({
        apiKey: customApiKey || process.env.OPENAI_API_KEY,
      });
      return openai('gpt-4o');

    case "gemini":
      const google = createGoogleGenerativeAI({
        apiKey: customApiKey || process.env.GEMINI_API_KEY,
      });
      return google('gemini-2.0-flash');

    case "openrouter":
      const openrouter = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: customApiKey || process.env.OPENROUTER_API_KEY,
      });
      return openrouter('openai/gpt-4o-mini');

    default:
      const fallback = createOpenAI({
        baseURL: "https://api.deepseek.com/v1",
        apiKey: process.env.DEEP_SEEK_KEY,
      });
      return fallback('deepseek-chat');
  }
}

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    // 1. Validación JWT
    const authHeader = event.headers?.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Falta token Bearer" }));
      responseStream.end();
      return;
    }

    const token = authHeader.split(" ")[1];
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    try {
      await jose.jwtVerify(token, secret);
    } catch {
      responseStream.setContentType("application/json");
      responseStream.write(JSON.stringify({ error: "Unauthorized: Token inválido" }));
      responseStream.end();
      return;
    }

    // 2. Parse payload
    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];
    const providerId = body.providerId || "deepseek";
    const customApiKey = body.customApiKey; // Modo BYOK (Bring Your Own Key)

    // 3. Vercel AI SDK Core Loop con Multi-Provider
    try {
      const result = streamText({
        model: getModel(providerId, customApiKey),
        system: SYSTEM_PROMPT,
        messages: messages,
        tools: {
          read_local_file: tool({
            description: 'Lee un archivo local de la máquina del usuario para obtener contexto.',
            parameters: z.object({ path: z.string() })
          }),
          execute_test_command: tool({
            description: 'Ejecuta vitest o npm test localmente.',
            parameters: z.object({ command: z.string() }),
          })
        }
      });

      responseStream.setContentType("text/event-stream");
      
      for await (const chunk of result.fullStream) {
        if (chunk.type === "text-delta") {
          const payload = JSON.stringify({ content: chunk.textDelta });
          responseStream.write(`data: ${payload}\n\n`);
        } 
        else if (chunk.type === "tool-call") {
          const payload = JSON.stringify({
            type: "mcp_tool_request",
            tool: chunk.toolName,
            args: chunk.args
          });
          responseStream.write(`data: ${payload}\n\n`);
        }
      }

      responseStream.write("event: done\ndata: [DONE]\n\n");
      responseStream.end();
    } catch (err) {
      responseStream.setContentType("text/event-stream");
      responseStream.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
      responseStream.end();
    }
  }
);
