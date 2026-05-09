// Vibe Studio — Opita Code
// Vibecodea en español. Aprende sin darte cuenta.

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("¡Hola, {}! Bienvenido a Vibe Studio.", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error al ejecutar Vibe Studio");
}
