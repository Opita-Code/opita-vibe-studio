use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub fn spawn_auth_server(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Enlazar al puerto 1455 (requerido por el client_id de OpenCode)
        if let Ok(listener) = TcpListener::bind("127.0.0.1:1455").await {
            loop {
                if let Ok((mut socket, _)) = listener.accept().await {
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut buffer = [0; 1024];
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
                                    } else if let Some(code) = line.split("code=").nth(1).and_then(|s| s.split(&[' ', '&'][..]).next()) {
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
