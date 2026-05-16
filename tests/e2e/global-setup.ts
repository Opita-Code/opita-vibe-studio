import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright Global Setup — Auto-refresh E2E Staging Token
 *
 * Se ejecuta UNA VEZ antes de cualquier test.
 * Obtiene un token fresco de Cognito via AWS CLI y lo escribe en .env
 * para que todos los tests lo lean via process.env.E2E_STAGING_TOKEN.
 *
 * Usuario: vibe-tester-01@opitacode.com (plan: pro)
 * Validez del token: 24 horas
 */

const USER_POOL_ID = 'us-east-1_LItAcj2Aa';
const CLIENT_ID = '4b5sluoilcrtuq67qbu4528htl';
const E2E_USERNAME = 'vibe-tester-01@opitacode.com';
const E2E_PASSWORD = 'VibeE2E#2026!';

/** Ruta donde escribimos el token para que los workers lo lean */
export const TOKEN_FILE = path.resolve(process.cwd(), 'playwright/.auth/token.json');

export default async function globalSetup() {
  console.log('\n🔑 [E2E Setup] Obteniendo token fresco de Cognito...');

  try {
    const result = execSync(
      `aws cognito-idp initiate-auth` +
      ` --auth-flow USER_PASSWORD_AUTH` +
      ` --client-id ${CLIENT_ID}` +
      ` --auth-parameters USERNAME=${E2E_USERNAME},PASSWORD=${E2E_PASSWORD}` +
      ` --query "AuthenticationResult.IdToken"` +
      ` --output text`,
      { encoding: 'utf-8' }
    ).trim();

    if (!result || result === 'None') {
      throw new Error('AWS CLI devolvió un token vacío');
    }

    // Escribir en archivo para que los workers lo lean (process.env no se propaga)
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token: result, fetchedAt: Date.now() }), 'utf-8');

    // También en process.env para el proceso actual
    process.env.E2E_STAGING_TOKEN = result;

    // Actualizar .env
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    if (envContent.includes('E2E_STAGING_TOKEN=')) {
      envContent = envContent.replace(/E2E_STAGING_TOKEN=.*/g, `E2E_STAGING_TOKEN=${result}`);
    } else {
      envContent += `\nE2E_STAGING_TOKEN=${result}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    console.log(`✅ [E2E Setup] Token obtenido (válido 24h). Usuario: ${E2E_USERNAME}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ [E2E Setup] No se pudo obtener token de Cognito: ${msg}`);
    console.error('   Asegúrate de tener AWS CLI configurado (aws configure).');
  }
}
