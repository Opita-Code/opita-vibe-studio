import { test, expect } from '@playwright/test';
import { waitForWorkspace, ensureChatOpen } from '../helpers/setup';

test.describe('Vibe AI - Pruebas de Resiliencia y Fallos', () => {
  
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    const stagingToken = process.env.E2E_STAGING_TOKEN;
    if (!stagingToken) {
      test.skip(true, 'Falta variable E2E_STAGING_TOKEN');
      return;
    }
    await page.addInitScript((token) => {
      localStorage.setItem('vibe-onboarding-done', 'true');
      document.cookie = `opita_session=${token}; path=/;`;
    }, stagingToken);

    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);
  });

  test('Rendimiento UI: Output masivo sin crashear', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    
    // Forzamos al LLM a generar un output excesivamente largo
    const promptText = "Genera un archivo JSON de configuración con 500 propiedades mockeadas (nombres de colores, frutas, ciudades, etc). El archivo debe tener al menos 1000 líneas de largo.";
    await textarea.fill(promptText);
    await page.keyboard.press('Enter');

    // Esperamos que termine de transmitir
    await page.waitForTimeout(60000); // 1 minuto de stream

    // Verificamos que la página no haya explotado (Out of memory / Page crashed)
    // Para ello revisamos que un elemento clave de la UI siga respondiendo
    const settingsBtn = page.locator('[aria-label="Configuración"]');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    
    // Verificamos que el modal de settings abra rápido, indicando que el main thread no está bloqueado permanentemente
    const settingsModal = page.locator('text="Configuración"').first();
    await expect(settingsModal).toBeVisible({ timeout: 2000 });
  });

  test('Manejo de interrupción de red durante stream', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    
    const promptText = "Escribe un ensayo de 5 párrafos sobre la arquitectura de microservicios.";
    await textarea.fill(promptText);
    await page.keyboard.press('Enter');

    // Esperamos 2 segundos a que empiece el stream
    await page.waitForTimeout(2000);

    // Cortamos la red intencionalmente simulando Offline
    await page.context().setOffline(true);

    // Esperamos a que la UI detecte la caída (fetch fallará o el stream se abortará)
    // La UI debería mostrar un mensaje de error ("Error de red" o similar)
    const errorMessage = page.locator('text="Error"');
    await expect(errorMessage).toBeVisible({ timeout: 15000 });

    // Restauramos la red
    await page.context().setOffline(false);
    
    // Verificamos que el input vuelva a estar disponible para reintentar
    await expect(textarea).toBeEnabled();
  });
});
