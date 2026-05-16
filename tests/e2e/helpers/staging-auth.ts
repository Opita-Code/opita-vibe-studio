import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Lee el token de staging desde el archivo escrito por globalSetup.
 * Fallback: process.env.E2E_STAGING_TOKEN
 */
export function getStagingToken(): string | undefined {
  // ESM: __dirname no existe, usamos import.meta.url
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // helpers/ → e2e/ → tests/ → project root
  const tokenFile = path.resolve(__dirname, '../../..', 'playwright/.auth/token.json');
  console.log('[getStagingToken] __dirname:', __dirname);
  console.log('[getStagingToken] tokenFile:', tokenFile);
  console.log('[getStagingToken] exists:', fs.existsSync(tokenFile));
  try {
    if (fs.existsSync(tokenFile)) {
      const { token } = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
      console.log('[getStagingToken] token found, length:', token?.length);
      if (token) return token;
    }
  } catch (e) {
    console.log('[getStagingToken] error:', e);
  }
  console.log('[getStagingToken] process.env token:', process.env.E2E_STAGING_TOKEN?.slice(0, 20));
  return process.env.E2E_STAGING_TOKEN;
}

/**
 * Inyecta la sesión de staging usando el ID Token real de Cognito.
 *
 * El global-setup obtiene el ID Token (no el Access Token) porque:
 * - La Lambda valida la firma via JWKS de Cognito → necesita token real
 * - restoreSession() en sso.ts lee opita_id_token y decodifica email/plan
 *
 * @param page    - Playwright page
 * @param idToken - ID Token de Cognito (obtenido por global-setup)
 */
export async function injectStagingSession(page: Page, idToken: string) {
  await page.addInitScript((token) => {
    localStorage.setItem('vibe-onboarding-done', 'true');
    // opita_id_token: usado por restoreSession() para parsear el usuario Y
    // enviado como cookie en los fetch con credentials:include a la Lambda
    document.cookie = `opita_id_token=${token}; path=/; domain=dev.opitacode.com`;
    document.cookie = `opita_id_token=${token}; path=/;`;
  }, idToken);
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
