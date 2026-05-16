import { test, expect } from '@playwright/test';
import { mockGuestAuth, VIEWPORTS } from './helpers/setup';

test.describe('Guest Mobile — Viewport 375x812', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('Guest en mobile ve onboarding o workspace (no bloqueo)', async ({ page }) => {
    await page.goto('/app/');

    // Should NOT show "Optimizado para Escritorio" anymore
    const gateText = page.locator('text=Optimizado para Escritorio');
    await expect(gateText).not.toBeVisible({ timeout: 10000 });

    // Should show either onboarding or workspace (depending on onboarding state)
    // Guest users who haven't completed onboarding see the onboarding flow
    // Guest users who have completed it see the mobile layout
    const mobileLayout = page.locator('nav[aria-label="Navegación principal"]');
    const onboarding = page.locator('text=Vibe Studio').first();
    
    // One of these should be visible
    await expect(onboarding).toBeVisible({ timeout: 15000 });
  });
});
