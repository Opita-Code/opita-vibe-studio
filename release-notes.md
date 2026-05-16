# 🚀 Vibe Studio v0.1.0 — Foundation Release

Bienvenido a la versión **v0.1.0** de Vibe Studio. 

Como hito fundamental en nuestra arquitectura de producto, este release marca la transición oficial hacia un IDE nativo de escritorio impulsado por IA. Vibe Studio no es solo un editor; es un orquestador de desarrollo autónomo (Agentic IDE) diseñado para el ecosistema de Opita Code.

## 🏗 Pilares Arquitectónicos en esta Versión

- **Motor de Orquestación SDD (Spec-Driven Development):** Flujos de trabajo nativos para planear, diseñar y ejecutar código de manera estructurada antes de modificar el repositorio.
- **Enrutador Multi-Modelo Híbrido:** Soporte integrado para los principales LLMs (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, DeepSeek), permitiendo delegación de tareas según la complejidad cognitiva.
- **Ejecución Autónoma Segura:** Sandboxing local mediante integración profunda con Tauri 2.0 y Node.js, permitiendo lectura/escritura del filesystem local con salvaguardas de usuario.
- **Identidad Centralizada (Cognito):** Sincronización transparente de la capa de autenticación y cuotas (planes Student/Pro) directamente con la nube de Opita Code.
- **Rendimiento Nativo:** Frontend en React compilado sobre un core en Rust (Tauri), logrando un footprint de memoria ultra-bajo en comparación con los IDEs basados en Electron.

---

## 📦 Binarios y Despliegue

La capa de despliegue ha sido automatizada para las tres plataformas principales. Haz clic en la sección de **Assets** al final de esta página para descargar el instalador:

### 🪟 Windows (Recomendado)
- **Ejecutable Base:** `Vibe.Studio_0.1.0_x64-setup.exe` (o `.msi` para despliegues administrados).
- > ⚠️ *Aviso de Confianza (SmartScreen):* Al ser un certificado de firma reciente, Windows Defender puede mostrar la pantalla de "Windows protegió su PC". Haz clic en **Más información** -> **Ejecutar de todas formas**. Revisa la [documentación de arquitectura de instalación](https://github.com/Opita-Code/opita-vibe-studio/blob/main/docs/install/INSTALACION.md) para más detalles.

### 🍎 macOS
- **Apple Silicon (Arquitectura ARM64):** `Vibe.Studio_0.1.0_aarch64.dmg`
- **Intel (Arquitectura x64):** `Vibe.Studio_0.1.0_x64.dmg`

### 🐧 Linux
- **Debian / Ubuntu:** `Vibe.Studio_0.1.0_amd64.deb`
- **RHEL / Fedora:** `Vibe.Studio-0.1.0-1.x86_64.rpm`

---
*Diseñado desde los fundamentos para cambiar la forma en la que construimos software. Bienvenido a la era del código asistido.* ✨
