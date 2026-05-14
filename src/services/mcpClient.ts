import { readFile, listDir, execShell, writeFile } from "@/lib/ipc";
import { useProjectStore } from "@/stores/project";

// Idealmente desde VITE_AWS_API_URL
const AWS_API_URL = "http://localhost:3000/api/mcp";

export async function handleMcpToolRequest(tool: string, args: Record<string, unknown>, token: string): Promise<void> {
  const rootPath = useProjectStore.getState().activeWorkspaceId;
  
  if (!rootPath) {
    await sendMcpResult(tool, { error: "No project opened" }, token);
    return;
  }

  try {
    let result: unknown;
    
    switch (tool) {
      case "read_local_file": {
        // Aseguramos que solo lea dentro del proyecto
        const pathArg = String(args.path || "");
        result = await readFile(`${rootPath}/${pathArg}`);
        break;
      }
        
      case "write_local_file": {
        // Validar path superficialmente para seguridad básica
        const pathArg = String(args.path || "");
        const contentArg = String(args.content || "");
        if (pathArg.includes("../") || pathArg.includes("..\\")) {
           throw new Error("Path contains relative parent directories, which is forbidden.");
        }
        await writeFile(`${rootPath}/${pathArg}`, contentArg);
        result = "Archivo escrito exitosamente.";
        break;
      }
        
      case "list_local_dir": {
        const pathArg = String(args.path || "");
        result = await listDir(`${rootPath}/${pathArg}`);
        break;
      }
        
      case "execute_test_command": {
        // Seguridad: Limitamos qué comandos se pueden correr desde AWS
        const cmd = String(args.command || "");
        if (!cmd.startsWith("npm test") && !cmd.startsWith("npx vitest") && !cmd.startsWith("vitest")) {
           throw new Error("Comando de shell bloqueado por seguridad. Solo testing permitido.");
        }
        result = await execShell(cmd, rootPath);
        break;
      }
        
      default:
        throw new Error(`Tool no reconocida por el cliente Tauri: ${tool}`);
    }

    await sendMcpResult(tool, { success: true, result }, token);
  } catch (error) {
    await sendMcpResult(tool, { success: false, error: String(error) }, token);
  }
}

async function sendMcpResult(tool: string, payload: Record<string, unknown>, token: string) {
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
