import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Lee el token de staging desde el archivo escrito por globalSetup.
 * Fallback: process.env.E2E_STAGING_TOKEN
 */
export function getStagingToken(): string | undefined {
  // Ruta fija — la misma que escribe global-setup.ts
  const tokenFile = path.resolve(process.cwd(), 'playwright/.auth/token.json');
  try {
    if (fs.existsSync(tokenFile)) {
      const { token } = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
      if (token) return token;
    }
  } catch {
    // Fallback
  }
  return process.env.E2E_STAGING_TOKEN;
}

/**
 * Inyecta una sesión PRO directamente en el store de auth de Vibe Studio.
 *
 * Estrategia:
 * 1. Crea una cookie `opita_id_token` con un JWT sintético válido que
 *    `restoreSession()` puede decodificar correctamente (tiene email + sub + plan).
 * 2. Si el access token real se provee, se usa como bearer para las llamadas
 *    a Lambda (el backend real lo valida). El JWT sintético solo sirve para
 *    que el frontend inicialice el store.
 *
 * @param page           - Playwright page
 * @param realAccessToken - Access token de Cognito (para llamadas a Lambda)
 * @param email          - Email de la cuenta de staging (default: la tuya)
 * @param plan           - Plan a simular (default: 'pro')
 */
export async function injectStagingSession(
  page: Page,
  realAccessToken: string,
  email = 'nicourrutia98@gmail.com',
  plan: 'free' | 'estudiante' | 'pro' = 'pro'
) {
  // Construir un ID Token sintético que restoreSession() pueda decodificar.
  // restoreSession() solo llama a decodeJWT() — no valida la firma criptográfica.
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
      // auth-token es el que useAgentHandler envía como Bearer a Lambda
      localStorage.setItem('auth-token', accessToken);
      // opita_id_token es lo que restoreSession() busca para parsear el usuario
      document.cookie = `opita_id_token=${idToken}; path=/;`;
    },
    { idToken: syntheticIdToken, accessToken: realAccessToken }
  );
}

/**
 * Espera a que el store de auth esté en modo 'authenticated'.
 * Hace polling sobre el DOM buscando evidencia de sesión activa
 * (el selector de modelo solo aparece cuando hay sesión).
 */
export async function waitForAuthReady(page: Page, timeout = 20000) {
  // El selector de modelo solo se renderiza cuando el usuario está autenticado
  // y ha completado el onboarding.
  await page.locator('[aria-label="Seleccionar modelo de IA"]').waitFor({
    state: 'visible',
    timeout,
  });
}
