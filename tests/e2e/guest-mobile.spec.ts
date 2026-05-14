import { test, expect } from '@playwright/test';
import { mockGuestAuth, VIEWPORTS } from './helpers/setup';

/**
 * Selector específico para MobileNavBar.
 * El MobileNavBar usa span.text-[10px] — el ViewTabs usa role="tab".
 * Usamos getByRole('button', { name }) filtrado al container del MobileNavBar.
 */
const mobileNav = (page: import('@playwright/test').Page) =>
  page.locator('nav.fixed, div.fixed.bottom-0').first();

test.describe('Guest Mobile — Viewport 375x812', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('MobileNavBar es visible en mobile', async ({ page }) => {
    await page.goto('/app/');

    // Completar onboarding
    const guestBtn = page.locator('button:has-text("Comenzar sin cuenta")');
    await expect(guestBtn).toBeVisible({ timeout: 10000 });
    await guestBtn.click();

    // MobileNavBar: buscar la barra fija en bottom
    // Usa span con text-[10px] — buscamos botones con esos spans
    const editorNavBtn = page.locator('span.text-\\[10px\\]').filter({ hasText: 'Editor' });
    await expect(editorNavBtn).toBeVisible({ timeout: 10000 });

    const previewNavBtn = page.locator('span.text-\\[10px\\]').filter({ hasText: 'Preview' });
    await expect(previewNavBtn).toBeVisible();
  });

  test('ActivityBar oculto en mobile (solo MobileNavBar)', async ({ page }) => {
    await page.goto('/app/');
    const guestBtn = page.locator('button:has-text("Comenzar sin cuenta")');
    await expect(guestBtn).toBeVisible({ timeout: 10000 });
    await guestBtn.click();

    // Esperar que la MobileNavBar aparezca
    const editorNavBtn = page.locator('span.text-\\[10px\\]').filter({ hasText: 'Editor' });
    await expect(editorNavBtn).toBeVisible({ timeout: 10000 });

    // ActivityBar ahora tiene `hidden md:flex` — no visible en mobile
    const explorerBtn = page.locator('button[aria-label="Explorador de Archivos"]');
    await expect(explorerBtn).toBeHidden();
  });

  test('Tab IA abre chat panel en mobile', async ({ page }) => {
    await page.goto('/app/');
    const guestBtn = page.locator('button:has-text("Comenzar sin cuenta")');
    await expect(guestBtn).toBeVisible({ timeout: 10000 });
    await guestBtn.click();

    const editorNavBtn = page.locator('span.text-\\[10px\\]').filter({ hasText: 'Editor' });
    await expect(editorNavBtn).toBeVisible({ timeout: 10000 });

    // Click en tab "IA" de la MobileNavBar — usamos el botón padre del span
    const iaTab = page.locator('button').filter({ has: page.locator('span.text-\\[10px\\]', { hasText: 'IA' }) });
    if (await iaTab.isVisible()) {
      await iaTab.click({ force: true });
      await page.waitForTimeout(1500);

      // Para guest en mobile, debería ver el CTA o el welcome
      const chatContent = page.locator('text="¿Qué vamos a construir hoy?"');
      await expect(chatContent).toBeVisible({ timeout: 10000 });
    }
  });

  test('Onboarding es responsive en mobile', async ({ page }) => {
    await page.goto('/app/');

    // El heading debe ser visible en mobile
    await expect(
      page.locator('h1:has-text("Vibecodea en español")')
    ).toBeVisible({ timeout: 10000 });

    // Los botones también
    await expect(page.locator('button:has-text("Comenzar sin cuenta")')).toBeVisible();
  });
});
