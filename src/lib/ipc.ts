import { invoke } from "@tauri-apps/api/core";

// ─── Window State ───────────────────────────────────────────────

/** Alterna entre maximizado y restaurado */
export function toggleMaximize(): Promise<void> {
  return invoke("toggle_maximize");
}

/** Minimiza la ventana */
export function minimizeWindow(): Promise<void> {
  return invoke("minimize_window");
}

/** Cierra la ventana (oculta a la bandeja) */
export function closeWindow(): Promise<void> {
  return invoke("close_window");
}

/** Alterna pantalla completa */
export function toggleFullscreen(): Promise<void> {
  return invoke("toggle_fullscreen");
}

// ─── File System ─────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: number;
}

/** Lee el contenido de un archivo como texto */
export function readFile(path: string): Promise<string> {
  return invoke("read_file", { path });
}

/** Escribe contenido en un archivo */
export function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

/** Lista el contenido de un directorio */
export function listDir(path: string): Promise<FileEntry[]> {
  return invoke("list_dir", { path });
}

/** Crea un directorio (y padres) */
export function createDir(path: string): Promise<void> {
  return invoke("create_dir", { path });
}

/** Elimina un archivo o directorio */
export function deleteEntry(path: string): Promise<void> {
  return invoke("delete_entry", { path });
}

export function renameEntry(oldPath: string, newPath: string): Promise<void> {
  return invoke("rename_entry", { oldPath, newPath });
}

// ─── Shell ───────────────────────────────────────────────────────

export interface ShellOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
}

/** Ejecuta un comando del sistema */
export function execShell(cmd: string, cwd: string): Promise<ShellOutput> {
  return invoke("exec_shell", { cmd, cwd });
}

// ─── Project ─────────────────────────────────────────────────────

export interface ProjectValidation {
  is_valid: boolean;
  name: string;
  file_count: number;
  has_config: boolean;
}

/** Abre el diálogo para seleccionar carpeta */
export function openFolderDialog(): Promise<string | null> {
  return invoke("open_folder_dialog");
}

/** Valida la estructura de un proyecto */
export function validateProject(path: string): Promise<ProjectValidation> {
  return invoke("validate_project", { path });
}
