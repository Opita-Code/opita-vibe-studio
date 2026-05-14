// Vibe Studio — Opita Code
// Vibecodea en español. Aprende sin darte cuenta.

use tauri::Manager;

mod commands;
mod auth_server;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("¡Hola, {}! Bienvenido a Vibe Studio.", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Spawn OAuth PKCE redirect server
            auth_server::spawn_auth_server(app.handle().clone());

            // Build tray menu
            let _ = app.tray_by_id("main").map(|tray| {
                let _ = tray.on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_dir,
            commands::fs::create_dir,
            commands::fs::delete_entry,
            commands::fs::rename_entry,
            commands::project::open_folder_dialog,
            commands::project::validate_project,
            commands::shell::exec_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar Vibe Studio");
}
