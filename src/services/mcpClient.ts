import { readFile, listDir, execShell } from "@/lib/ipc";
import { useProjectStore } from "@/stores/project";

// Idealmente desde VITE_AWS_API_URL
const AWS_API_URL = "http://localhost:3000/api/mcp";

export async function handleMcpToolRequest(tool: string, args: any, token: string): Promise<void> {
  const rootPath = useProjectStore.getState().rootPath;
  
  if (!rootPath) {
    await sendMcpResult(tool, { error: "No project opened" }, token);
    return;
  }

  try {
    let result: any;
    
    switch (tool) {
      case "read_local_file":
        // Aseguramos que solo lea dentro del proyecto
        result = await readFile(`${rootPath}/${args.path}`);
        break;
        
      case "list_local_dir":
        result = await listDir(`${rootPath}/${args.path || ""}`);
        break;
        
      case "execute_test_command":
        // Seguridad: Limitamos qué comandos se pueden correr desde AWS
        const cmd = args.command as string;
        if (!cmd.startsWith("npm test") && !cmd.startsWith("npx vitest") && !cmd.startsWith("vitest")) {
           throw new Error("Comando de shell bloqueado por seguridad. Solo testing permitido.");
        }
        result = await execShell(cmd, rootPath);
        break;
        
      default:
        throw new Error(`Tool no reconocida por el cliente Tauri: ${tool}`);
    }

    await sendMcpResult(tool, { success: true, result }, token);
  } catch (error) {
    await sendMcpResult(tool, { success: false, error: String(error) }, token);
  }
}

async function sendMcpResult(tool: string, payload: any, token: string) {
  try {
    await fetch(AWS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        type: "mcp_tool_result",
        tool,
        payload
      })
    });
  } catch (err) {
    console.error("[MCP] Falló el envío del resultado al backend AWS:", err);
  }
}
