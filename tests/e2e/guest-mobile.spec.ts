import { test, expect } from '@playwright/test';
import { mockGuestAuth, VIEWPORTS } from './helpers/setup';

test.describe('Guest Mobile — Viewport 375x812', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('Guest en mobile ve onboarding o workspace (no bloqueo)', async ({ page }) => {
    await page.goto('/app/');

    // Should NOT show the old device gate
    const gateText = page.locator('text=Optimizado para Escritorio');
    await expect(gateText).not.toBeVisible({ timeout: 10000 });

    // Guest without completed onboarding sees OnboardingFlow which shows "Vibecodea en español"
    // Guest who completed onboarding sees the mobile layout
    // Either way: the page renders (no device gate)
    const onboarding = page.locator('h1:has-text("Vibecodea en español")');
    const mobileNav = page.locator('nav[aria-label="Navegación principal"]');
    await expect(onboarding.or(mobileNav)).toBeVisible({ timeout: 15000 });
  });
});
