use tauri::{AppHandle, Emitter, Listener};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use std::sync::{Arc, Mutex};

pub fn spawn_auth_server(app: AppHandle) {
    // Almacenar el state esperado para validación CSRF
    let expected_state: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    // Escuchar cuando el frontend inicia un flujo OAuth con un state específico
    let state_ref = expected_state.clone();
    app.listen("oauth_set_state", move |event| {
        if let Some(state) = event.payload().strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
            *state_ref.lock().unwrap() = Some(state.to_string());
        }
    });

    tauri::async_runtime::spawn(async move {
        // Enlazar al puerto 1455 (requerido por el client_id de OpenCode)
        if let Ok(listener) = TcpListener::bind("127.0.0.1:1455").await {
            loop {
                if let Ok((mut socket, _)) = listener.accept().await {
                    let app_clone = app.clone();
                    let state_ref = expected_state.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut buffer = [0; 2048];
                        if let Ok(bytes_read) = socket.read(&mut buffer).await {
                            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
                            
                            // Parsear "GET /auth/callback..."
                            if let Some(line) = request.lines().next() {
                                if line.starts_with("GET /auth/callback") {
                                    if line.contains("error=") {
                                        let html = r#"
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <title>Error de Autenticación</title>
                                            <style>
                                                body { font-family: system-ui, sans-serif; background: #08080A; color: #E2E8F0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                                                .box { background: #2D1A1A; padding: 2rem; border-radius: 12px; border: 1px solid #5C2B2B; text-align: center; }
                                                h2 { color: #F87171; margin-top: 0; }
                                            </style>
                                        </head>
                                        <body>
                                            <div class="box">
                                                <h2>Ocurrió un problema</h2>
                                                <p>La autenticación falló o fue cancelada.</p>
                                                <p>Puedes cerrar esta pestaña y volver a intentarlo en Vibe Studio.</p>
                                            </div>
                                        </body>
                                        </html>
                                        "#;
                                        
                                        let response = format!("HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}", html.len(), html);
                                        let _ = socket.write_all(response.as_bytes()).await;
                                        return;
                                    }

                                    // Extraer state y code del query string
                                    let callback_state = line.split("state=").nth(1).and_then(|s| s.split(&[' ', '&'][..]).next());
                                    let code = line.split("code=").nth(1).and_then(|s| s.split(&[' ', '&'][..]).next());

                                    // Validar state contra el esperado (previene CSRF)
                                    let state_valid = match (callback_state, state_ref.lock().unwrap().as_deref()) {
                                        (Some(received), Some(expected)) => received == expected,
                                        _ => false,
                                    };

                                    if !state_valid {
                                        let html = r#"
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <title>Error de Seguridad</title>
                                            <style>
                                                body { font-family: system-ui, sans-serif; background: #08080A; color: #E2E8F0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                                                .box { background: #2D1A1A; padding: 2rem; border-radius: 12px; border: 1px solid #5C2B2B; text-align: center; }
                                                h2 { color: #F87171; margin-top: 0; }
                                            </style>
                                        </head>
                                        <body>
                                            <div class="box">
                                                <h2>Solicitud inválida</h2>
                                                <p>El parámetro de seguridad no coincide. Vuelve a intentar desde Vibe Studio.</p>
                                            </div>
                                        </body>
                                        </html>
                                        "#;
                                        let response = format!("HTTP/1.1 403 Forbidden\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}", html.len(), html);
                                        let _ = socket.write_all(response.as_bytes()).await;
                                        return;
                                    }

                                    // Limpiar el state esperado después de validar
                                    *state_ref.lock().unwrap() = None;

                                    if let Some(code) = code {
                                        // Emitir el código al frontend de Vibe Studio
                                        let _ = app_clone.emit("oauth_code", code);
                                        
                                        // Responder al navegador para cerrar la pestaña
                                        let html = r#"
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <title>Autenticación Exitosa</title>
                                            <style>
                                                body { font-family: system-ui, sans-serif; background: #08080A; color: #E2E8F0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                                                .box { background: #1E293B; padding: 2rem; border-radius: 12px; border: 1px solid #334155; text-align: center; }
                                                h2 { color: #22D3EE; margin-top: 0; }
                                            </style>
                                        </head>
                                        <body>
                                            <div class="box">
                                                <h2>¡Autenticación exitosa!</h2>
                                                <p>Ya puedes cerrar esta pestaña y volver a Vibe Studio.</p>
                                                <script>window.close();</script>
                                            </div>
                                        </body>
                                        </html>
                                        "#;
                                        
                                        let response = format!(
                                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
                                            html.len(),
                                            html
                                        );
                                        
                                        let _ = socket.write_all(response.as_bytes()).await;
                                        return;
                                    }
                                }
                            }
                            
                            let response = "HTTP/1.1 404 NOT FOUND\r\nContent-Length: 9\r\n\r\nNot Found";
                            let _ = socket.write_all(response.as_bytes()).await;
                        }
                    });
                }
            }
        }
    });
}
