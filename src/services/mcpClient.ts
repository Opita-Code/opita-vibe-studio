import { useProjectStore } from "@/stores/project";

// ─── Config ────────────────────────────────────────────────────

const AWS_API_URL = import.meta.env.VITE_AWS_API_URL
  ? `${import.meta.env.VITE_AWS_API_URL}/mcp`
  : "";

/** Check if we're running inside Tauri (IPC available). */
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

// ─── Path Validation ───────────────────────────────────────────

const BLOCKED_SEGMENTS = ["..", "~", "%2e%2e"];

function validateMcpPath(rootPath: string, relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (BLOCKED_SEGMENTS.some((seg) => lower.includes(seg))) {
    throw new Error("Path contains forbidden segments (path traversal attempt blocked).");
  }
  if (relativePath.startsWith("/") || /^[a-zA-Z]:/.test(relativePath)) {
    throw new Error("Absolute paths are forbidden. Use project-relative paths.");
  }
  const sep = rootPath.includes("\\") ? "\\" : "/";
  return `${rootPath}${sep}${relativePath.replace(/\//g, sep)}`;
}

// ─── Tool Handler ──────────────────────────────────────────────

export async function handleMcpToolRequest(
  tool: string,
  args: Record<string, unknown>,
  token: string,
): Promise<void> {
  const rootPath = useProjectStore.getState().activeWorkspaceId;
  
  if (!rootPath) {
    await sendMcpResult(tool, { error: "No project opened" }, token);
    return;
  }

  // Only execute IPC commands if we're in Tauri
  if (!isTauriEnv()) {
    console.warn("[MCP] Tauri IPC not available — running in browser mode. Skipping tool:", tool);
    await sendMcpResult(tool, { error: "Tauri IPC not available in browser mode." }, token);
    return;
  }

  try {
    // Dynamic import of IPC only when Tauri is available
    const { readFile, listDir, execShell, writeFile } = await import("@/lib/ipc");
    let result: unknown;
    
    switch (tool) {
      case "read_local_file": {
        const pathArg = String(args.path || "");
        const fullPath = validateMcpPath(rootPath, pathArg);
        result = await readFile(fullPath);
        break;
      }
        
      case "write_local_file": {
        const pathArg = String(args.path || "");
        const contentArg = String(args.content || "");
        const fullPath = validateMcpPath(rootPath, pathArg);
        await writeFile(fullPath, contentArg);
        result = "Archivo escrito exitosamente.";
        break;
      }
        
      case "list_local_dir": {
        const pathArg = String(args.path || "");
        const fullPath = validateMcpPath(rootPath, pathArg);
        result = await listDir(fullPath);
        break;
      }
        
      case "execute_test_command": {
        // Seguridad: Limitamos qué comandos se pueden correr desde AWS
        const cmd = String(args.command || "");
        const ALLOWED_PREFIXES = ["npm test", "npx vitest", "vitest", "npm run test", "npm run lint"];
        if (!ALLOWED_PREFIXES.some((prefix) => cmd.startsWith(prefix))) {
           throw new Error("Comando de shell bloqueado por seguridad. Solo testing/linting permitido.");
        }
        result = await execShell(cmd, rootPath);
        break;
      }
        
      default:
        throw new Error(`Tool no reconocida por el cliente MCP: ${tool}`);
    }

    await sendMcpResult(tool, { success: true, result }, token);
  } catch (error) {
    await sendMcpResult(tool, { success: false, error: String(error) }, token);
  }
}

// ─── Result Sender ─────────────────────────────────────────────

async function sendMcpResult(
  tool: string,
  payload: Record<string, unknown>,
  token: string,
) {
  if (!AWS_API_URL) {
    console.warn("[MCP] No AWS API URL configured — cannot send result for:", tool);
    return;
  }

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
