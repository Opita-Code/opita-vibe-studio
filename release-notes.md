# 🔒 Vibe Studio v0.2.0 — Security & Polish Release

Actualización de seguridad y estabilidad que reemplaza la v0.1.0.

> ⚠️ **Esta versión invalida la v0.1.0.** Si estás en una versión anterior, actualiza inmediatamente.

## 🛡️ Seguridad

- **CORS Hardening:** Eliminación del comodín `*` en todas las cabeceras CORS del backend. Ahora solo se aceptan orígenes explícitos (`vibe.opitacode.com`, `localhost`).
- **CSP Tauri Endurecido:** Content Security Policy reforzada en el cliente de escritorio para prevenir inyección de scripts externos.
- **Error Sanitization:** Los errores del backend ya no exponen stack traces ni rutas internas al cliente.

## 🏗 Arquitectura & Backend

- **API Router Unificado:** Todas las APIs ahora sirven desde `api.opitacode.com` a través de `sst.aws.Router`, eliminando la dependencia de URLs volátiles de Lambda.
- **Motor de Gamificación:** Sistema completo de XP, niveles, misiones diarias/semanales generadas por IA, rachas y recompensas de cuota.
- **Billing Pipeline:** Integración estable con Wompi para checkout y gestión de suscripciones desde `cuenta.opitacode.com`.

## 📱 Experiencia Móvil (PWA)

- **Progressive Web App:** Instalación nativa ("Añadir a pantalla de inicio") en Android con `manifest.webmanifest`.
- **Viewport Optimizado:** `interactive-widget=resizes-content` para que el teclado virtual de Android no tape los inputs.
- **Mobile Layout Completo:** Eliminación del bloqueo "MobileNotSupportedScreen". Ahora el IDE es completamente funcional en móvil.

## ✨ UX Premium

- **Micro-Interacciones:** Animaciones spring con Framer Motion en CommandPalette, SettingsPanel, ModeButtons y AgentStepAccordion.
- **Rendimiento Editor:** Selectores granulares de Zustand en EditorPanel para evitar re-renders innecesarios de Monaco Editor.
- **Transparencia del Agente:** UI colapsable para logs de razonamiento de la IA con indicador de progreso.

## 📦 Binarios

Descarga el instalador desde la sección **Assets**:

### 🪟 Windows
- `Vibe.Studio_0.2.0_x64-setup.exe` / `.msi`
- > ⚠️ SmartScreen puede mostrar aviso de confianza. Clic en **Más información** → **Ejecutar de todas formas**.

### 🍎 macOS
- **Apple Silicon:** `Vibe.Studio_0.2.0_aarch64.dmg`
- **Intel:** `Vibe.Studio_0.2.0_x64.dmg`

### 🐧 Linux
- **Debian/Ubuntu:** `Vibe.Studio_0.2.0_amd64.deb`
- **RHEL/Fedora:** `Vibe.Studio-0.2.0-1.x86_64.rpm`

---
*Seguridad primero. Rendimiento siempre. Bienvenido a v0.2.0.* 🔒✨
