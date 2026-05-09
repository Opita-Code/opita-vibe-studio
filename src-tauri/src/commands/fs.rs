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
        let entry = entry.map_err(|e| format!("Error al leer entrada: {}", e))?;
        let metadata = entry.metadata().map_err(|e| format!("Error al leer metadatos: {}", e))?;

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        files.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
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
