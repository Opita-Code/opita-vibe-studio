import { execShell } from "./ipc";

// ─── Git Status ─────────────────────────────────────────────────

/**
 * Obtiene el nombre de la rama actual del repositorio en `projectPath`.
 * Retorna null si no es un repositorio git o si falla el comando.
 */
export async function getGitBranch(projectPath: string): Promise<string | null> {
  try {
    const result = await execShell("git rev-parse --abbrev-ref HEAD", projectPath);
    if (result.exit_code !== 0) return null;
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Obtiene el estado git de todos los archivos en el repositorio.
 * Retorna un mapa: path → status ("M" modificado, "A" agregado, "D" eliminado, "??" untracked).
 */
export async function getGitStatus(
  projectPath: string,
): Promise<Record<string, string> | null> {
  try {
    const result = await execShell(
      "git status --porcelain --untracked-files=normal",
      projectPath,
    );
    if (result.exit_code !== 0) return null;

    const statusMap: Record<string, string> = {};
    for (const line of result.stdout.split("\n").filter(Boolean)) {
      // Formato:XY <path>
      // X = staging area status, Y = working tree status
      const xy = line.substring(0, 2).trim();
      const filePath = line.substring(3).trim();
      if (filePath) {
        // Tomamos el indicador más significativo (staging > working)
        statusMap[filePath] = xy || "??";
      }
    }
    return statusMap;
  } catch {
    return null;
  }
}
