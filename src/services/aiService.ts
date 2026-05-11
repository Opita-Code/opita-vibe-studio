import type { Message } from "@/lib/types";

// URL por defecto para desarrollo (idealmente vendría de import.meta.env.VITE_AWS_API_URL)
const AWS_API_URL = "http://localhost:3000/api/chat";

export async function* streamAwsSse(
  messages: Message[],
  providerId: string,
  token: string = "dev-token-a-reemplazar"
): AsyncGenerator<{ type: "text" | "error" | "done" | "mcp_tool_request"; content: string; tool?: string; args?: any }> {
  try {
    const response = await fetch(AWS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        projectId: "local-workspace",
        messages,
        providerId,
      })
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}));
      yield { type: "error", content: errorData.error || `HTTP Error ${response.status}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // En caso de que se cierre sin enviar [DONE] explícito
        yield { type: "done", content: "" };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Mantenemos el último fragmento incompleto (si no termina en newline) en el buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          
          if (dataStr === "[DONE]") {
            yield { type: "done", content: "" };
            return; // Termina el generador
          }

          try {
            const parsed = JSON.parse(dataStr);
            
            // Si es un evento MCP (Fase 3), lo emitimos
            if (parsed.type === "mcp_tool_request") {
               yield { 
                 type: "mcp_tool_request", 
                 content: "", 
                 tool: parsed.tool, 
                 args: parsed.args 
               };
            } 
            // Si es texto de chat
            else if (parsed.content) {
              yield { type: "text", content: parsed.content };
            }
          } catch (e) {
            console.warn("SSE JSON Parse Error:", dataStr);
          }
        }
      }
    }
  } catch (err) {
    yield { type: "error", content: `Connection error: ${String(err)}` };
  }
}
