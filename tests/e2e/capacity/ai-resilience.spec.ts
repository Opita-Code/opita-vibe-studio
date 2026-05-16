import { test, expect } from '@playwright/test';
import {
  injectStagingSession,
  waitForAuthReady,
  getStagingToken,
  getChatLog,
  getChatInput,
  sendChatMessage,
  waitForAgentDone,
} from '../helpers/staging-auth';
import { waitForWorkspace } from '../helpers/setup';

/**
 * Suite de Resiliencia — UI bajo carga y fallos de red
 *
 * Test 1 — Output masivo:
 *   El agente genera una respuesta muy larga (~500 propiedades JSON).
 *   Verificamos que:
 *   a) El stream completa sin crash (textarea vuelve a enabled).
 *   b) El main thread responde: el dialog de Configuración abre en <3s.
 *
 * Test 2 — Interrupción de red:
 *   Cortamos la red a mitad del stream.
 *   Verificamos que:
 *   a) El textarea se libera (finally{} en useAgentHandler L204-210).
 *   b) El chat muestra un mensaje de error con "⚠️"
 *      (useAgentHandler L196-202 o aiService L193).
 *
 * Selectores confirmados en el código:
 *   - Chat log: <div role="log" aria-label="Mensajes del chat">
 *   - Textarea: <textarea placeholder="Escribe, pega imágenes...">
 *   - Settings button: <button aria-label="Configuración">
 *   - Settings dialog: <div role="dialog" aria-label="Configuración de Vibe Studio">
 *   - Error text: "⚠️ Error de red" (aiService.ts L193, stream-client.ts L238)
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
    await sendChatMessage(
      page,
      'Genera un JSON de configuración con 500 propiedades mockeadas. ' +
      'Cada propiedad debe tener clave única y un valor string aleatorio. ' +
      'Devuelve solo el JSON sin explicación.'
    );

    // Esperar a que el stream termine
    await waitForAgentDone(page, 120_000);

    // ── Verificar responsividad del main thread ────────────
    const settingsBtn = page.locator('[aria-label="Configuración"]');
    await expect(settingsBtn).toBeVisible();

    const start = Date.now();
    await settingsBtn.click();

    // El dialog de configuración tiene un aria-label específico
    const settingsDialog = page.getByRole('dialog', { name: /configuración/i });
    await expect(settingsDialog).toBeVisible({ timeout: 3_000 });

    const elapsed = Date.now() - start;
    console.log(`[RESILIENCE] Settings dialog abrió en ${elapsed}ms tras output masivo`);
    expect(elapsed, 'El dialog de configuración debería abrir en <3s').toBeLessThan(3_000);
  });

  test('Interrupción de red: reporta error y libera el input', async ({ page }) => {
    const textarea = await sendChatMessage(
      page,
      'Escribe un ensayo detallado de 10 párrafos sobre la historia de la arquitectura de software.'
    );

    // Esperar a que empiece el stream (textarea se deshabilita)
    await expect(textarea).toBeDisabled({ timeout: 10_000 });

    // Cortar la red a mitad del stream
    // Esperamos un poco para que el stream esté activo
    await page.waitForTimeout(2_000);
    await page.context().setOffline(true);

    // El finally{} de useAgentHandler (L204-210) SIEMPRE libera el textarea
    await expect(textarea).toBeEnabled({ timeout: 30_000 });

    // Restaurar red inmediatamente para no afectar otros tests
    await page.context().setOffline(false);

    // Verificar que el chat muestre un mensaje de error
    // Patrones reales del código:
    //   - aiService.ts L193: "Error de red. Verifica tu conexión a internet..."
    //   - useAgentHandler.ts L201: "⚠️ ${errorMsg}"
    const chatLog = getChatLog(page);
    const chatText = await chatLog.textContent({ timeout: 5_000 }) ?? '';

    const hasErrorIndicator =
      chatText.includes('⚠️') ||
      chatText.includes('Error de red') ||
      chatText.includes('Error de conexión') ||
      /error/i.test(chatText);

    expect(hasErrorIndicator, 'El chat debería mostrar un indicador de error de red').toBe(true);
  });
});
