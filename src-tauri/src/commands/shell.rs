// Vibe-Studio — Comando de ejecución de shell
// Ejecuta comandos del sistema con timeout de 30s

use serde::Serialize;
use std::process::Command;
use std::time::{Duration, Instant};

#[derive(Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Ejecuta un comando del sistema operativo con timeout de 30 segundos
///
/// En Windows usa `cmd /C`, en Unix usa `sh -c`.
/// Retorna stdout, stderr y código de salida.
#[tauri::command]
pub fn exec_shell(cmd: String, cwd: String) -> Result<ShellOutput, String> {
    let shell = if cfg!(target_os = "windows") {
        "cmd"
    } else {
        "sh"
    };
    let flag = if cfg!(target_os = "windows") {
        "/C"
    } else {
        "-c"
    };

    let mut child = Command::new(shell)
        .args([flag, &cmd])
        .current_dir(&cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Error al ejecutar comando: {}", e))?;

    let start = Instant::now();
    let timeout = Duration::from_secs(30);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output =
                    child.wait_with_output().map_err(|e| format!("Error al leer salida: {}", e))?;
                return Ok(ShellOutput {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    exit_code: status.code().unwrap_or(-1),
                });
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("El comando excedió el límite de 30 segundos".to_string());
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                return Err(format!("Error en la ejecución del comando: {}", e));
            }
        }
    }
}
