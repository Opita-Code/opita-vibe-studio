// Vibe-Studio — Comandos de proyecto
// Diálogo para abrir carpeta, validación de estructura

use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct ProjectValidation {
    pub is_valid: bool,
    pub name: String,
    pub file_count: usize,
    pub has_config: bool,
}

/// Abre el diálogo nativo para seleccionar una carpeta
#[tauri::command]
pub async fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app.dialog().file().blocking_pick_folder();

    match path {
        Some(p) => Ok(Some(p.to_string())),
        None => Ok(None),
    }
}

/// Valida que una ruta sea un proyecto válido
/// Verifica que existe, es un directorio, y cuenta archivos
#[tauri::command]
pub fn validate_project(path: String) -> Result<ProjectValidation, String> {
    let p = Path::new(&path);

    if !p.exists() {
        return Err("La ruta no existe".to_string());
    }
    if !p.is_dir() {
        return Err("La ruta no es un directorio".to_string());
    }

    let mut file_count = 0;
    let mut has_config = false;

    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.flatten() {
            if entry.path().is_file() {
                file_count += 1;
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "package.json" || name == "index.html" || name == "config.yaml" {
                    has_config = true;
                }
            }
        }
    }

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(ProjectValidation {
        is_valid: true,
        name,
        file_count,
        has_config,
    })
}
