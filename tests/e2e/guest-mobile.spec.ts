import { test, expect } from '@playwright/test';
import { mockGuestAuth, VIEWPORTS } from './helpers/setup';

test.describe('Guest Mobile — Viewport 375x812', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('Muestra pantalla de dispositivo no soportado en mobile', async ({ page }) => {
    await page.goto('/app/');

    // El usuario debería ver directamente la pantalla de no soportado
    const heading = page.locator('h1:has-text("Optimizado para Escritorio")');
    await expect(heading).toBeVisible({ timeout: 10000 });

    const description = page.locator('p', { hasText: 'diseñada para fluir con pantallas amplias' });
    await expect(description).toBeVisible();
    
    const backLink = page.locator('a:has-text("Volver al Inicio")');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/');
  });
});
