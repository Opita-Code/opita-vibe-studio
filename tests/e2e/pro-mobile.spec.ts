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

    // Mobile header shows the active tab title — default is "chat" tab = "Vibe AI"
    const header = page.locator('text=Vibe AI');
    await expect(header.first()).toBeVisible({ timeout: 15000 });

    // Bottom nav should be present with tab buttons
    const bottomNav = page.locator('nav[aria-label="Navegación principal"]');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });

    // Should have tab buttons (labels from TABS config in MobileLayout)
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
    await expect(page.locator('nav[aria-label="Navegación principal"]')).toBeVisible({ timeout: 15000 });

    // NOTE: chatHistoryVisible may default to true in staging (fixed in ui.ts, pending deploy).
    // Use force:true to bypass overlay when clicking tabs.
    const hubTab = page.locator('button[aria-label="Ir a Hub"]');
    await expect(hubTab).toBeVisible({ timeout: 5000 });
    await hubTab.click({ force: true });
    await page.waitForTimeout(500);

    // Verify Hub tab is now active
    await expect(hubTab).toHaveAttribute('aria-pressed', 'true');

    // Navigate back to IA
    const iaTab = page.locator('button[aria-label="Ir a IA"]');
    await iaTab.click({ force: true });
    await page.waitForTimeout(500);

    // IA tab should be active again
    await expect(iaTab).toHaveAttribute('aria-pressed', 'true');
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
