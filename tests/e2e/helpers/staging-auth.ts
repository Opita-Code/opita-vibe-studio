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

// ─── Session Injection ─────────────────────────────────────────

/**
 * Inyecta una sesión PRO válida en Vibe Studio.
 *
 * Estrategia dual:
 * 1. Cookie `opita_id_token` con JWT sintético → `restoreSession()` lo parsea
 *    sin validar firma (solo llama `decodeJWT()`).
 * 2. `localStorage['auth-token']` con el access token real → las llamadas
 *    a Lambda lo envían como `Bearer` y el backend SÍ lo valida.
 */
export async function injectStagingSession(
  page: Page,
  realAccessToken: string,
  email = 'nicourrutia98@gmail.com',
  plan: 'free' | 'estudiante' | 'pro' = 'pro'
) {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: '54a864c8-8041-709c-ccc3-be80c7a3585a',
      email,
      given_name: 'Nico',
      'custom:plan': plan,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  ).replace(/=/g, '');
  const syntheticIdToken = `${header}.${payload}.fake_signature`;

  await page.addInitScript(
    ({ idToken, accessToken }) => {
      localStorage.setItem('vibe-onboarding-done', 'true');
      localStorage.setItem('auth-token', accessToken);
      document.cookie = `opita_id_token=${idToken}; path=/;`;
    },
    { idToken: syntheticIdToken, accessToken: realAccessToken }
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
