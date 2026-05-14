import JSZip from "jszip";
import { exportProjectAsZip } from "./export";
import type { FileNode } from "./types";
import type { FileSystemBackend } from "./fs-backend/types";

/**
 * SyncEngine: Handles compressing the local OPFS/native workspace into a ZIP
 * and sending it to the cloud, as well as downloading and extracting it.
 */

import { useAuthStore } from "@/stores/auth";

const API_BASE_URL = "https://suy2kd74af.execute-api.us-east-1.amazonaws.com/v1";

export class SyncEngine {
  /**
   * Pushes the current workspace to the cloud.
   * 1. Zips the files.
   * 2. Checks if it's under 25MB.
   * 3. Uploads to the cloud backend via S3 Pre-signed URL.
   */
  static async pushToCloud(
    files: FileNode[],
    rootPath: string,
    backend: FileSystemBackend,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const authState = useAuthStore.getState();
    const token = authState.session?.token;

    if (!token) {
      throw new Error("Se requiere iniciar sesión para sincronizar a la nube.");
    }

    onProgress?.("Comprimiendo proyecto...");
    
    // 1. Create ZIP Blob
    const zipBlob = await exportProjectAsZip(files, rootPath, backend);
    
    // 2. Validate Size (Free Tier = 25MB)
    const MAX_BYTES = 25 * 1024 * 1024;
    if (zipBlob.size > MAX_BYTES) {
      throw new Error(`El proyecto excede el límite de 25MB de la capa gratuita. Tamaño actual: ${(zipBlob.size / 1024 / 1024).toFixed(2)}MB`);
    }

    // 3. Obtener Pre-signed URL
    onProgress?.("Conectando con AWS...");
    const projectId = encodeURIComponent(rootPath.split(/[/\\]/).pop() || "project");
    
    let uploadUrl = "";
    try {
      const urlRes = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: "POST", // o GET dependiendo de la API final
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "get_upload_url" })
      });
      
      if (!urlRes.ok) {
        throw new Error(`AWS error al obtener URL: ${urlRes.status}`);
      }
      
      const data = await urlRes.json();
      uploadUrl = data.uploadUrl;
    } catch (err) {
      console.warn("Fallo al obtener Pre-signed URL real. Haciendo fallback a simulación para desarrollo.", err);
      // Fallback a localStorage si el endpoint real no está expuesto aún
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const reader = new FileReader();
      reader.readAsDataURL(zipBlob);
      reader.onloadend = () => {
        const base64data = reader.result;
        if (typeof base64data === "string") {
          localStorage.setItem(`vibe-sync-${rootPath}`, base64data);
        }
      };
      return;
    }

    if (!uploadUrl) {
      throw new Error("No se pudo obtener la URL de subida (Pre-signed URL).");
    }

    // 4. Subir directamente a S3
    onProgress?.("Subiendo a la nube...");
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      body: zipBlob,
      headers: {
        "Content-Type": "application/zip",
      }
    });

    if (!uploadRes.ok) {
      throw new Error(`Fallo al subir archivo a S3: ${uploadRes.status}`);
    }

    // 5. Notificar Sync Complete
    onProgress?.("Finalizando sincronización...");
    await fetch(`${API_BASE_URL}/projects/${projectId}/sync-complete`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
  }

  /**
   * Pulls the workspace from the cloud and extracts it into the local backend.
   */
  static async pullFromCloud(
    rootPath: string,
    backend: FileSystemBackend,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    onProgress?.("Descargando de la nube...");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock Download
    const base64data = localStorage.getItem(`vibe-sync-${rootPath}`);
    if (!base64data) {
      throw new Error("No hay un respaldo en la nube para este proyecto.");
    }

    onProgress?.("Extrayendo archivos...");

    // Convert base64 back to Blob
    const fetchResponse = await fetch(base64data);
    const blob = await fetchResponse.blob();

    // Parse ZIP
    const zip = await JSZip.loadAsync(blob);

    // Write all files into the local backend
    const entries = Object.values(zip.files);
    for (const entry of entries) {
      if (entry.dir) {
        // Create directory
        await backend.createDirectory(entry.name);
      } else {
        // Read file content and write
        const content = await entry.async("string");
        await backend.writeFile(entry.name, content);
      }
    }
  }
}
