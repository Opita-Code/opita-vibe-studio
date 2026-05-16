import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ─── Token Management ──────────────────────────────────────────

/**
 * Lee el token de staging desde el archivo escrito por globalSetup.
 * Fallback: process.env.E2E_STAGING_TOKEN
 */
export function getStagingToken(): string | undefined {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const tokenFile = path.resolve(__dirname, '../../..', 'playwright/.auth/token.json');
  try {
    if (fs.existsSync(tokenFile)) {
      const { token } = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
      if (token) return token;
    }
  } catch {
    // Fallback silencioso
  }
  return process.env.E2E_STAGING_TOKEN;
}

/**
 * Inyecta una sesión válida en Vibe Studio para E2E testing.
 *
 * El token proviene de `global-setup.ts` que autentica con Cognito
 * via `aws cognito-idp initiate-auth` — es un ID Token real con
 * firma RSA válida, email, plan, y sub.
 *
 * Flujo:
 * 1. Se inyecta como cookie `opita_id_token` (addInitScript)
 * 2. `restoreSession()` (sso.ts) lo decodifica → extrae email, plan
 * 3. `session.token` = este mismo token → streamSSE lo envía como Bearer
 * 4. Lambda verifica la firma via JWKS de Cognito → acepta
 *
 * No necesita JWTs sintéticos, monkeypatching, ni hacks de store.
 */
export async function injectStagingSession(
  page: Page,
  cognitoIdToken: string,
) {
  await page.addInitScript(
    (token) => {
      // Marcar onboarding como completado para saltar la intro
      localStorage.setItem('vibe-onboarding-done', 'true');
      // Inyectar el ID Token real de Cognito como cookie
      // restoreSession() lo lee, lo decodifica, y lo usa como session.token
      document.cookie = `opita_id_token=${token}; path=/;`;
    },
    cognitoIdToken
  );
}

// ─── Auth Ready ────────────────────────────────────────────────

/**
 * Espera a que el store de auth esté en modo 'authenticated'.
 *
 * Señal: el botón "Seleccionar modelo de IA" solo se renderiza
 * cuando el usuario está autenticado y completó el onboarding.
 */
export async function waitForAuthReady(page: Page, timeout = 25_000) {
  await page.locator('[aria-label="Seleccionar modelo de IA"]').waitFor({
    state: 'visible',
    timeout,
  });
}

// ─── Chat Helpers ──────────────────────────────────────────────

/**
 * Obtiene el contenedor de mensajes del chat.
 * El ChatPanel renderiza un `<div role="log" aria-label="Mensajes del chat">`.
 */
export function getChatLog(page: Page) {
  return page.getByRole('log', { name: /mensajes/i });
}

/**
 * Localiza el textarea de input del chat.
 * Placeholder real: "Escribe, pega imágenes o arrastra archivos aquí..."
 */
export function getChatInput(page: Page) {
  return page.locator('textarea[placeholder*="Escribe"]');
}

/**
 * Envía un mensaje de chat y espera a que el stream empiece.
 * Retorna el textarea para assertions posteriores.
 */
export async function sendChatMessage(page: Page, message: string) {
  const textarea = getChatInput(page);
  await expect(textarea).toBeEnabled({ timeout: 10_000 });
  await textarea.fill(message);
  await page.keyboard.press('Enter');
  return textarea;
}

/**
 * Espera a que el agente termine de responder.
 * Señal: el textarea vuelve a estar enabled (isStreaming=false).
 */
export async function waitForAgentDone(page: Page, timeout = 120_000) {
  const textarea = getChatInput(page);
  await expect(textarea).toBeEnabled({ timeout });
}
