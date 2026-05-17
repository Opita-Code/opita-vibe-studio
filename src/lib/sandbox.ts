/**
 * Sandbox Manager — Auto-provisions virtual workspaces on demand.
 *
 * When a user interacts with Aura without loading a project,
 * a sandbox workspace is created automatically. Files live in
 * Zustand memory + OPFS persistence — no filesystem permission needed.
 *
 * Sandbox workspaces use the `sandbox://` protocol to distinguish
 * them from template:// (scaffolded) and real (filesystem) workspaces.
 *
 * Quotas are enforced per plan tier to prevent RAM exhaustion.
 */

import { useProjectStore } from "@/stores/project";
import type { FileNode } from "@/lib/types";

// ─── Constants ──────────────────────────────────────────────────

export const SANDBOX_PROTOCOL = "sandbox://";

/** User plan tiers for quota enforcement. */
export type PlanTier = "free" | "student" | "pro";

/** Quota limits per plan. */
export interface SandboxQuota {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
}

const QUOTAS: Record<PlanTier, SandboxQuota> = {
  free:    { maxFiles: 20,  maxTotalBytes: 2 * 1024 * 1024,   maxFileBytes: 200 * 1024 },
  student: { maxFiles: 50,  maxTotalBytes: 10 * 1024 * 1024,  maxFileBytes: 500 * 1024 },
  pro:     { maxFiles: 200, maxTotalBytes: 50 * 1024 * 1024,  maxFileBytes: 2 * 1024 * 1024 },
};

// ─── Detection ──────────────────────────────────────────────────

/** Returns true if the workspace ID is a sandbox workspace. */
export function isSandboxWorkspace(workspaceId: string | null): boolean {
  return typeof workspaceId === "string" && workspaceId.startsWith(SANDBOX_PROTOCOL);
}

// ─── Auto-Provision ─────────────────────────────────────────────

/**
 * Ensures a workspace exists. If none is active, creates a sandbox.
 * Returns the active workspace ID (existing or newly created).
 *
 * This is the key function — called by the tool executor when
 * it detects no workspace is active, instead of throwing an error.
 */
export function ensureSandbox(): string {
  const store = useProjectStore.getState();

  // If a workspace already exists, return it
  if (store.activeWorkspaceId) {
    return store.activeWorkspaceId;
  }

  // Check if there's already a sandbox in the workspaces list
  const existingSandbox = store.workspaces.find(
    (w) => w.id.startsWith(SANDBOX_PROTOCOL),
  );
  if (existingSandbox) {
    store.setActiveWorkspace(existingSandbox.id);
    return existingSandbox.id;
  }

  // Create a new sandbox
  const sandboxId = `${SANDBOX_PROTOCOL}proyecto-${Date.now()}`;
  const sandboxName = "Mi Proyecto";

  const workspace = {
    id: sandboxId,
    path: sandboxId,
    name: sandboxName,
    files: [] as FileNode[],
    isGitRepo: false,
    gitBranch: null,
  };

  // Add workspace to store and activate it
  useProjectStore.setState((state) => ({
    workspaces: [...state.workspaces, workspace],
    activeWorkspaceId: sandboxId,
    isLoading: false,
    statusMessage: "Sandbox creado automáticamente",
  }));

  return sandboxId;
}

// ─── Quota Validation ───────────────────────────────────────────

/**
 * Validates that writing `newContentSize` bytes won't exceed quotas.
 * Throws a user-friendly error if quota would be exceeded.
 *
 * @param plan - User's plan tier
 * @param currentContents - Current fileContents from Zustand
 * @param newContentSize - Size of the new content being written
 * @param isNewFile - Whether this is a new file (vs overwriting existing)
 */
export function validateSandboxQuota(
  plan: PlanTier,
  currentContents: Record<string, string>,
  newContentSize: number,
  isNewFile: boolean,
): void {
  const quota = QUOTAS[plan];

  // Check single file size
  if (newContentSize > quota.maxFileBytes) {
    const maxKB = Math.round(quota.maxFileBytes / 1024);
    const currentKB = Math.round(newContentSize / 1024);
    throw new Error(
      `Archivo demasiado grande (${currentKB} KB). Máximo permitido: ${maxKB} KB en plan ${plan}. ` +
      `Divide el contenido en archivos más pequeños.`,
    );
  }

  // Count existing files and total size
  const entries = Object.entries(currentContents);
  const currentFileCount = entries.length;
  const currentTotalBytes = entries.reduce(
    (sum, [, content]) => sum + new TextEncoder().encode(content).byteLength,
    0,
  );

  // Check file count
  if (isNewFile && currentFileCount >= quota.maxFiles) {
    throw new Error(
      `Límite de archivos alcanzado (${quota.maxFiles} archivos en plan ${plan}). ` +
      `Elimina archivos que ya no necesites o exporta tu proyecto.`,
    );
  }

  // Check total size
  const projectedTotal = currentTotalBytes + newContentSize;
  if (projectedTotal > quota.maxTotalBytes) {
    const maxMB = Math.round(quota.maxTotalBytes / (1024 * 1024));
    const currentMB = (currentTotalBytes / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Almacenamiento lleno (${currentMB} MB de ${maxMB} MB en plan ${plan}). ` +
      `Elimina archivos o exporta tu proyecto para liberar espacio.`,
    );
  }
}

/**
 * Returns the user's plan tier. Falls back to "free" if unknown.
 * Reads from auth store where Cognito custom:plan is stored.
 */
export function getUserPlan(): PlanTier {
  try {
    // Lazy import to avoid circular deps
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/stores/auth");
    const plan = useAuthStore.getState()?.session?.plan;
    if (plan === "VIBE_PRO" || plan === "pro") return "pro";
    if (plan === "VIBE_STUDENT" || plan === "student") return "student";
    return "free";
  } catch {
    return "free";
  }
}

// ─── File Tree Sync ─────────────────────────────────────────────

/**
 * Updates the workspace file tree to reflect a new virtual file.
 * Called after virtualWrite to keep the Explorer panel in sync.
 */
export function syncSandboxFileTree(
  workspaceId: string,
  relativePath: string,
): void {
  const store = useProjectStore.getState();
  const workspace = store.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return;

  const fullPath = `${workspaceId}/${relativePath}`;
  const parts = relativePath.split("/").filter(Boolean);

  // Check if file already exists in tree
  if (findNodeByPath(workspace.files, fullPath)) return;

  // Build the file tree path, creating directories as needed
  const newFiles = [...workspace.files];
  let currentLevel = newFiles;

  for (let i = 0; i < parts.length - 1; i++) {
    const dirName = parts[i];
    const dirPath = `${workspaceId}/${parts.slice(0, i + 1).join("/")}`;

    let dirNode = currentLevel.find(
      (n) => n.type === "directory" && n.name === dirName,
    );
    if (!dirNode) {
      dirNode = {
        name: dirName,
        path: dirPath,
        type: "directory",
        children: [],
      };
      currentLevel.push(dirNode);
    }
    currentLevel = dirNode.children || [];
  }

  // Add the file node
  const fileName = parts[parts.length - 1];
  const existingFile = currentLevel.find(
    (n) => n.type === "file" && n.name === fileName,
  );
  if (!existingFile) {
    currentLevel.push({
      name: fileName,
      path: fullPath,
      type: "file",
      extension: fileName.includes(".")
        ? fileName.split(".").pop()?.toLowerCase()
        : undefined,
    });
  }

  store.updateWorkspaceFiles(workspaceId, newFiles);
}

/** Recursively find a node by path in the file tree. */
function findNodeByPath(
  nodes: FileNode[],
  targetPath: string,
): FileNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}
