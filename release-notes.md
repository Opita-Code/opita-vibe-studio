# 🔧 Vibe Studio v0.2.1 — Hotfix: Logout Session Cleanup

Corrección de un bug donde cerrar sesión no limpiaba correctamente los datos de autenticación del navegador.

## 🐛 Bug Fix

- **Logout no limpiaba cookies de Cognito:** El botón "Cerrar sesión" llamaba al reset del store Zustand pero NO eliminaba las cookies `opita_id_token`, `opita_access_token` y `opita_refresh_token`. Al recargar, la sesión se restauraba automáticamente.
- **localStorage de sesión persistía:** Los keys `auth-token` y `vibe-guest-email` sobrevivían al cierre de sesión.
- **PrivacyPanel "Eliminar datos" tampoco limpiaba cookies:** El flujo de eliminación de datos usaba el mismo logout incorrecto.

### Archivos corregidos
- `src/components/layout/ActivityBar.tsx` — Ahora usa `sso.logout()` completo
- `src/auth/sso.ts` — Limpia localStorage de sesión además de cookies
- `src/components/settings/PrivacyPanel.tsx` — Usa `sso.logout()` en vez del store

> 💡 Datos de trabajo (BYOK keys, sync, onboarding, chat sessions) se preservan correctamente al cerrar sesión.

## 📦 Binarios

Descarga el instalador desde la sección **Assets**:

### 🪟 Windows
- `Vibe.Studio_0.2.1_x64-setup.exe` / `.msi`
- > ⚠️ SmartScreen puede mostrar aviso de confianza. Clic en **Más información** → **Ejecutar de todas formas**.

### 🍎 macOS
- **Apple Silicon:** `Vibe.Studio_0.2.1_aarch64.dmg`
- **Intel:** `Vibe.Studio_0.2.1_x64.dmg`

### 🐧 Linux
- **Debian/Ubuntu:** `Vibe.Studio_0.2.1_amd64.deb`
- **RHEL/Fedora:** `Vibe.Studio-0.2.1-1.x86_64.rpm`

---
*Seguridad primero. Rendimiento siempre. Bienvenido a v0.2.1.* 🔧✨
