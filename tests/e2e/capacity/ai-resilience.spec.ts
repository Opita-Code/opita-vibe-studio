import { test, expect } from '@playwright/test';
import {
  injectStagingSession,
  waitForAuthReady,
  getStagingToken,
  getChatLog,
  getChatInput,
  sendChatMessage,
} from '../helpers/staging-auth';
import { waitForWorkspace } from '../helpers/setup';

/**
 * Suite de Resiliencia — Verificación ESTRICTA
 *
 * VERIFICACIÓN:
 *   1. Output masivo: el agente DEBE generar una respuesta larga (>500 chars).
 *      Si solo devuelve un error corto, el test FALLA — no estaríamos
 *      probando resiliencia de UI, estaríamos probando un error de red.
 *   2. Interrupción de red: se verifica el ciclo completo
 *      (disabled → offline → enabled → error message).
 */

test.describe('Resiliencia: UI bajo carga y fallos de red', () => {
  test.setTimeout(150_000);

  test.beforeEach(async ({ page }) => {
    const token = getStagingToken();
    if (!token) {
      test.skip(true, 'Token de staging no disponible');
      return;
    }

    await injectStagingSession(page, token);
    await page.goto('/app/');
    await waitForWorkspace(page);
    await waitForAuthReady(page);
  });

  test('Output masivo: UI no crashea con respuesta larga', async ({ page }) => {
    const textarea = getChatInput(page);

    await sendChatMessage(
      page,
      'Genera un JSON de configuración con 500 propiedades mockeadas. ' +
      'Cada propiedad debe tener clave única y un valor string aleatorio. ' +
      'Devuelve solo el JSON sin explicación.'
    );

    // ── Verificar que el stream ARRANCÓ ─────────────────────
    await expect(textarea).toBeDisabled({ timeout: 15_000 });
    const streamStart = Date.now();

    // ── Esperar a que termine ───────────────────────────────
    await expect(textarea).toBeEnabled({ timeout: 120_000 });
    const elapsed = Date.now() - streamStart;

    // ── Verificar que la respuesta es LARGA (no un error) ──
    const chatLog = getChatLog(page);
    const chatText = await chatLog.textContent({ timeout: 2_000 }) ?? '';

    // Restar el largo del prompt (~200 chars) para medir solo la respuesta
    const responseLength = chatText.length - 200;

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║ [RESILIENCE] Output masivo                    `);
    console.log(`╠══════════════════════════════════════════════╣`);
    console.log(`║ Tiempo de stream:    ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
    console.log(`║ Largo total chat:    ${chatText.length} chars`);
    console.log(`║ Largo respuesta:     ~${responseLength} chars`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    // La respuesta debe ser sustancial — si fue <500 chars, no estamos
    // probando resiliencia de UI, estamos viendo un error
    expect(
      responseLength,
      `La respuesta es muy corta (${responseLength} chars). Probablemente el agente devolvió un error en vez de generar el JSON masivo.`
    ).toBeGreaterThan(500);

    // ── Verificar responsividad del main thread ────────────
    const settingsBtn = page.locator('[aria-label="Configuración"]');
    await expect(settingsBtn).toBeVisible();

    const uiStart = Date.now();
    await settingsBtn.click();

    const settingsDialog = page.getByRole('dialog', { name: /configuración/i });
    await expect(settingsDialog).toBeVisible({ timeout: 3_000 });

    const uiElapsed = Date.now() - uiStart;
    console.log(`[RESILIENCE] Settings dialog abrió en ${uiElapsed}ms tras output masivo`);
    expect(uiElapsed, 'El dialog de configuración debería abrir en <3s').toBeLessThan(3_000);
  });

  test('Interrupción de red: reporta error y libera el input', async ({ page }) => {
    const textarea = getChatInput(page);

    await sendChatMessage(
      page,
      'Escribe un ensayo detallado de 10 párrafos sobre la historia de la arquitectura de software.'
    );

    // ── Verificar que el stream ARRANCÓ ─────────────────────
    await expect(textarea).toBeDisabled({ timeout: 15_000 });

    // Esperar un poco para que el stream esté activo
    await page.waitForTimeout(2_000);

    // ── Cortar la red ──────────────────────────────────────
    await page.context().setOffline(true);
    console.log('[RESILIENCE] Red cortada a los ~2s del stream');

    // ── El finally{} de useAgentHandler SIEMPRE libera ─────
    await expect(textarea).toBeEnabled({ timeout: 30_000 });

    // Restaurar red
    await page.context().setOffline(false);

    // ── Verificar mensaje de error ─────────────────────────
    const chatLog = getChatLog(page);
    const chatText = await chatLog.textContent({ timeout: 2_000 }) ?? '';

    const hasError =
      chatText.includes('⚠️') ||
      chatText.includes('Error de red') ||
      chatText.includes('Error de conexión') ||
      /error/i.test(chatText);

    console.log(`[RESILIENCE] Error detectado en chat: ${hasError}`);
    console.log(`[RESILIENCE] Largo del chat tras corte: ${chatText.length} chars`);

    expect(hasError, 'El chat debería mostrar un indicador de error de red').toBe(true);
  });
});
