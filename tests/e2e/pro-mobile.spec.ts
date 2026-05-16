import { test, expect } from '@playwright/test';
import { mockProAuth, mockChatResponse, VIEWPORTS } from './helpers/setup';

// ═══════════════════════════════════════════════════════════════════
// Pro Mobile — viewport 375x812
//
// Vibe Studio now has a full responsive mobile layout.
// On mobile viewports, users see a tab-based MobileLayout
// with IA, Code, View, Hub, and Settings tabs.
// ═══════════════════════════════════════════════════════════════════

test.describe('Pro Mobile — Responsive Layout', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Mobile layout muestra header y bottom nav', async ({ page }) => {
    await page.goto('/app/');

    // Mobile header should show "Vibe Studio"
    const header = page.locator('text=Vibe Studio');
    await expect(header.first()).toBeVisible({ timeout: 15000 });

    // Bottom nav should be present with tab buttons
    const bottomNav = page.locator('nav[aria-label="Navegación principal"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });

    // Should have tab buttons
    await expect(page.locator('button[aria-label="Ir a IA"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Ir a Code"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Ir a Vista"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Ir a Hub"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Ir a Más"]')).toBeVisible();
  });

  test('Chat tab es el tab por defecto', async ({ page }) => {
    await page.goto('/app/');

    // Wait for the mobile layout
    const bottomNav = page.locator('nav[aria-label="Navegación principal"]');
    await expect(bottomNav).toBeVisible({ timeout: 15000 });

    // IA tab should be active (aria-pressed)
    const iaTab = page.locator('button[aria-label="Ir a IA"]');
    await expect(iaTab).toHaveAttribute('aria-pressed', 'true');

    // Chat textarea should be available
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test('Enviar mensaje en mobile chat', async ({ page }) => {
    await page.goto('/app/');

    // Wait for mobile layout
    await expect(page.locator('nav[aria-label="Navegación principal"]')).toBeVisible({ timeout: 15000 });

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Fill message and send
    await textarea.fill('Mensaje desde mobile');
    await textarea.press('Enter');

    // User bubble
    const userBubble = page.locator('.justify-end .whitespace-pre-wrap').filter({ hasText: 'Mensaje desde mobile' });
    await expect(userBubble).toBeVisible({ timeout: 10000 });

    // Response bubble
    const aiBubble = page.locator('.justify-start .prose').first();
    await expect(aiBubble).toBeVisible({ timeout: 15000 });
  });

  test('Navegar entre tabs', async ({ page }) => {
    await page.goto('/app/');

    // Wait for mobile layout
    await expect(page.locator('nav[aria-label="Navegación principal"]')).toBeVisible({ timeout: 15000 });

    // Click Hub tab
    const hubTab = page.locator('button[aria-label="Ir a Hub"]');
    await hubTab.click();
    await page.waitForTimeout(500);

    // Hub content should be visible (XP, missions, etc.)
    const hubContent = page.locator('text=Nivel').first();
    await expect(hubContent).toBeVisible({ timeout: 5000 });

    // Click back to IA
    const iaTab = page.locator('button[aria-label="Ir a IA"]');
    await iaTab.click();
    await page.waitForTimeout(500);

    // Chat should reappear
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  test('No muestra pantalla de bloqueo (Optimizado para Escritorio)', async ({ page }) => {
    await page.goto('/app/');

    // Should NOT show the old device gate
    const gateText = page.locator('text=Optimizado para Escritorio');
    await expect(gateText).not.toBeVisible({ timeout: 5000 });

    // Should show the mobile layout instead
    await expect(page.locator('nav[aria-label="Navegación principal"]')).toBeVisible({ timeout: 15000 });
  });
});
