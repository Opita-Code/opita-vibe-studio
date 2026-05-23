import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Resource as SSTResource } from "sst";
import * as fs from "node:fs";
import * as path from "node:path";

const Resource = SSTResource as any;
const s3Client = new S3Client({});

export interface CoupledProject {
  projectId: string;
  path: string;
  coupledAt: number;
}

export interface ProjectRegistry {
  activeProjects: CoupledProject[];
}

export interface ProjectManifest {
  projectId: string;
  name: string;
  description: string;
  resources?: Record<string, string>;
  capabilities?: Array<{
    name: string;
    description: string;
    parameters: any;
  }>;
}

export async function loadRegistry(): Promise<ProjectRegistry> {
  try {
    const bucket = Resource.VibeStorage.name;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: "admin/coupled-projects.json",
    });
    const response = await s3Client.send(command);
    const bodyStr = await response.Body?.transformToString();
    if (bodyStr) {
      return JSON.parse(bodyStr);
    }
  } catch (e: any) {
    if (e.name !== "NoSuchKey" && e.code !== "NoSuchKey") {
      console.error("Error loading registry from S3:", e);
    }
  }
  return { activeProjects: [] };
}

export async function saveRegistry(registry: ProjectRegistry): Promise<void> {
  const bucket = Resource.VibeStorage.name;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: "admin/coupled-projects.json",
    Body: JSON.stringify(registry, null, 2),
    ContentType: "application/json",
  });
  await s3Client.send(command);
}

export async function loadProjectManifest(projectId: string): Promise<ProjectManifest | null> {
  try {
    const bucket = Resource.VibeStorage.name;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `admin/projects/${projectId}/opita-ops.json`,
    });
    const response = await s3Client.send(command);
    const bodyStr = await response.Body?.transformToString();
    if (bodyStr) {
      return JSON.parse(bodyStr);
    }
  } catch (e: any) {
    console.error(`Error loading manifest for project ${projectId} from S3:`, e);
  }
  return null;
}

export async function saveProjectManifest(projectId: string, manifest: ProjectManifest): Promise<void> {
  const bucket = Resource.VibeStorage.name;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: `admin/projects/${projectId}/opita-ops.json`,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: "application/json",
  });
  await s3Client.send(command);
}

export async function coupleProject(
  projectId: string,
  localPath: string
): Promise<{ success: boolean; message: string; manifest?: ProjectManifest }> {
  let manifest: ProjectManifest;

  // 1. Try to read manifest from local path
  try {
    const manifestPath = path.resolve(localPath, "opita-ops.json");
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, "utf-8");
      manifest = JSON.parse(content);
    } else {
      throw new Error(`Manifest file not found at: ${manifestPath}`);
    }
  } catch (e: any) {
    // If local fs fails, fallback: check if we already have it in S3
    const existing = await loadProjectManifest(projectId);
    if (existing) {
      manifest = existing;
    } else {
      return {
        success: false,
        message: `No se pudo acoplar el proyecto: no se encontró opita-ops.json en la ruta local y tampoco existe un manifiesto previo en la nube. Detalles: ${e.message}`,
      };
    }
  }

  // 2. Validate manifest fields
  if (manifest.projectId !== projectId) {
    return {
      success: false,
      message: `El projectId en opita-ops.json (${manifest.projectId}) no coincide con el solicitado (${projectId}).`,
    };
  }

  // 3. Save manifest to S3
  await saveProjectManifest(projectId, manifest);

  // 4. Update coupled projects list in S3
  const registry = await loadRegistry();
  // Remove if already exists to avoid duplicates
  registry.activeProjects = registry.activeProjects.filter((p) => p.projectId !== projectId);
  registry.activeProjects.push({
    projectId,
    path: localPath,
    coupledAt: Date.now(),
  });
  await saveRegistry(registry);

  return {
    success: true,
    message: `Proyecto ${manifest.name} acoplado con éxito.`,
    manifest,
  };
}

export async function decoupleProject(projectId: string): Promise<{ success: boolean; message: string }> {
  const registry = await loadRegistry();
  const exists = registry.activeProjects.some((p) => p.projectId === projectId);
  if (!exists) {
    return {
      success: false,
      message: `El proyecto ${projectId} no está acoplado actualmente.`,
    };
  }

  registry.activeProjects = registry.activeProjects.filter((p) => p.projectId !== projectId);
  await saveRegistry(registry);

  // Delete project manifest from S3
  try {
    const bucket = Resource.VibeStorage.name;
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: `admin/projects/${projectId}/opita-ops.json`,
    }));
  } catch (e) {
    console.warn(`Failed to delete manifest for decoupled project ${projectId} from S3:`, e);
  }

  return {
    success: true,
    message: `Proyecto ${projectId} desacoplado con éxito.`,
  };
}
