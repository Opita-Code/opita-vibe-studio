// Vibe Studio — Comandos del sistema de archivos
// Operaciones: leer, escribir, listar, crear directorios, eliminar

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_at: u64,
}

/// Lee el contenido de un archivo como texto UTF-8
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Error al leer archivo: {}", e))
}

/// Escribe contenido en un archivo (crea directorios padre si no existen)
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Error al crear directorios: {}", e))?;
    }
    fs::write(&path, &content).map_err(|e| format!("Error al escribir archivo: {}", e))
}

/// Lista el contenido de un directorio
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let entries =
        fs::read_dir(&path).map_err(|e| format!("Error al leer directorio: {}", e))?;

    let mut files = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // Skip entries we can't read (e.g. permission denied)
        };

        // OneDrive "Files On-Demand": metadata may fail for cloud-only files.
        // Fall back to defaults instead of failing the entire directory listing.
        let metadata = entry.metadata().ok();

        let modified_at = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // file_type() is cheaper than metadata() and works for OneDrive placeholders
        let is_dir = metadata
            .as_ref()
            .map(|m| m.is_dir())
            .unwrap_or_else(|| entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false));

        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

        files.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            size,
            modified_at,
        });
    }

    // Ordenar: directorios primero, luego archivos, alfabéticamente
    files.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(files)
}

/// Crea un directorio (y todos los padres necesarios)
#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Error al crear directorio: {}", e))
}

/// Elimina un archivo o directorio (eliminación recursiva para directorios)
#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Error al eliminar directorio: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Error al eliminar archivo: {}", e))
    }
}

/// Renombra o mueve un archivo o directorio
#[tauri::command]
pub fn rename_entry(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Error al renombrar: {}", e))
}
