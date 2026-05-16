import { test, expect } from '@playwright/test';
import { injectStagingSession, waitForAuthReady } from '../helpers/staging-auth';
import { waitForWorkspace } from '../helpers/setup';

/**
 * Suite de Resiliencia — UI bajo carga y fallos de red
 *
 * Qué mide:
 *   1. Output masivo: El agente genera ~1000 líneas de texto.
 *      → verificamos que la UI no crashee y el main thread siga respondiendo
 *        (el botón de Configuración abre su panel en < 3s).
 *
 *   2. Interrupción de red durante stream:
 *      → cortamos la conexión 2s después de iniciar el stream.
 *      → el agente appendea "⚠️ Error de conexión" al mensaje (ver useAgentHandler.ts L197-201).
 *      → verificamos que el textarea vuelva a estar enabled (el usuario puede reintentar).
 *
 * Selectores basados en el código real:
 *   - useAgentHandler.ts L196-202: el error se agrega al chat como texto "⚠️ Error de conexión"
 *     o con el mensaje de la excepción.
 *   - El textarea se deshabilita durante isStreaming y vuelve a habilitarse en el finally.
 */

test.describe('Resiliencia: UI bajo carga y fallos de red', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    const token = process.env.E2E_STAGING_TOKEN;
    if (!token) test.skip(true, 'E2E_STAGING_TOKEN no definido');

    await injectStagingSession(page, token!);
    await page.goto('/app/');
    await waitForWorkspace(page);
    await waitForAuthReady(page);
  });

  test('Output masivo: UI no crashea con 1000 líneas de contenido', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeEnabled();

    await textarea.fill(
      'Genera un JSON de configuración con 500 propiedades mockeadas. ' +
      'Cada propiedad debe tener clave única y un valor string aleatorio de al menos 10 caracteres. ' +
      'Devuelve solo el JSON sin explicación.'
    );
    await page.keyboard.press('Enter');

    // Esperamos a que el stream termine — el textarea vuelve a habilitarse
    await expect(textarea).toBeEnabled({ timeout: 90_000 });

    // Verificamos que el main thread no esté bloqueado:
    // El botón de configuración debe responder en < 3s
    const settingsBtn = page.locator('[aria-label="Configuración"]');
    await expect(settingsBtn).toBeVisible();
    
    const start = Date.now();
    await settingsBtn.click();
    
    // Algún elemento del panel de settings debe aparecer rápido
    await expect(
      page.locator('text="Configuración"').or(page.locator('[role="dialog"]'))
    ).toBeVisible({ timeout: 3_000 });
    
    const elapsed = Date.now() - start;
    console.log(`[RESILIENCE] Settings panel abrió en ${elapsed}ms tras output masivo`);
    expect(elapsed).toBeLessThan(3000);
  });

  test('Interrupción de red: El agente reporta error y libera el input', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeEnabled();

    await textarea.fill(
      'Escribe un ensayo detallado de 10 párrafos sobre la historia de la arquitectura de software.'
    );
    await page.keyboard.press('Enter');

    // Esperar a que empiece el stream (textarea se deshabilita)
    await expect(textarea).toBeDisabled({ timeout: 10_000 });

    // Cortar la red a mitad del stream
    await page.waitForTimeout(2_500);
    await page.context().setOffline(true);

    // Esperar a que el agente detecte el fallo y libere el textarea
    // useAgentHandler finally{} siempre llama setStreaming(false) → textarea vuelve enabled
    await expect(textarea).toBeEnabled({ timeout: 30_000 });

    // Restaurar red para no afectar otros tests
    await page.context().setOffline(false);

    // Verificar que haya un mensaje de error en el chat
    // useAgentHandler L201: appendToLastMessage(`\n\n⚠️ ${errorMsg}`)
    const chatArea = page.locator('.chat-messages, [data-role="messages"], main');
    const bodyText = await chatArea.textContent() ?? '';
    expect(bodyText).toMatch(/⚠️|Error|error/);
  });
});
