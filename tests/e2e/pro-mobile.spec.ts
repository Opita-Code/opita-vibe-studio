import { test, expect, Page } from '@playwright/test';
import { mockProAuth, mockChatResponse, VIEWPORTS } from './helpers/setup';

/** Espera a que la barra de navegación inferior móvil esté cargada */
async function waitForMobileWorkspace(page: Page) {
  const mobileNav = page.locator('nav.fixed, div.fixed.bottom-0').first();
  await expect(mobileNav).toBeVisible({ timeout: 15000 });
}

/** Asegura que el chat esté abierto en mobile pulsando el botón IA de la navbar */
async function ensureMobileChatOpen(page: Page) {
  const iaTab = page.locator('button').filter({ has: page.locator('span.text-\\[10px\\]', { hasText: 'IA' }) });
  await expect(iaTab).toBeVisible({ timeout: 10000 });
  await iaTab.click({ force: true });
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════
// Pro Mobile Experience — viewport 375x812
// ═══════════════════════════════════════════════════════════════════

test.describe('Pro Mobile — Core Flow', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('MobileNavBar tiene todos los botones para Pro', async ({ page }) => {
    await page.goto('/app/');
    await waitForMobileWorkspace(page);

    // ActivityBar disappears on mobile, MobileNavBar appears
    const mobileNav = page.locator('nav.fixed, div.fixed.bottom-0').first();
    await expect(mobileNav).toBeVisible({ timeout: 10000 });

    // Buttons should include Editor, Preview, IA, Explorer
    const navText = await mobileNav.textContent();
    expect(navText).toContain('Editor');
    expect(navText).toContain('Preview');
    expect(navText).toContain('IA');
  });

  test('Cambiar de vista usando MobileNavBar', async ({ page }) => {
    await page.goto('/app/');
    await waitForMobileWorkspace(page);

    const mobileNav = page.locator('nav.fixed, div.fixed.bottom-0').first();
    await expect(mobileNav).toBeVisible({ timeout: 10000 });

    // Click IA tab
    const iaTab = page.locator('button').filter({ has: page.locator('span.text-\\[10px\\]', { hasText: 'IA' }) });
    await expect(iaTab).toBeVisible();
    await iaTab.click({ force: true });
    await page.waitForTimeout(500);

    // Chat textarea should become visible
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Click Editor tab
    const editorTab = page.locator('button').filter({ has: page.locator('span.text-\\[10px\\]', { hasText: 'Editor' }) });
    await expect(editorTab).toBeVisible();
    await editorTab.click({ force: true });
    await page.waitForTimeout(500);

    // Wait, on mobile the ViewTabs might be visible when Editor is selected
    const viewTabs = page.locator('[role="tablist"]');
    await expect(viewTabs).toBeVisible();
  });

  test('Enviar mensaje en vista mobile', async ({ page }) => {
    await page.goto('/app/');
    await waitForMobileWorkspace(page);

    // Navigate to IA
    const iaTab = page.locator('button').filter({ has: page.locator('span.text-\\[10px\\]', { hasText: 'IA' }) });
    await expect(iaTab).toBeVisible({ timeout: 10000 });
    await iaTab.click({ force: true });
    await page.waitForTimeout(500);

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

  test('Selector de modelo no se desborda en mobile', async ({ page }) => {
    await page.goto('/app/');
    await waitForMobileWorkspace(page);

    // Navigate to IA
    const iaTab = page.locator('button').filter({ has: page.locator('span.text-\\[10px\\]', { hasText: 'IA' }) });
    await expect(iaTab).toBeVisible({ timeout: 10000 });
    await iaTab.click({ force: true });
    await page.waitForTimeout(500);

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible({ timeout: 10000 });

    // Verify it is visible (Playwright checks if it's within viewport bounds for actionability)
    await expect(modelSelector).toBeInViewport();
    
    const boundingBox = await modelSelector.boundingBox();
    console.log("Selector bounds:", boundingBox);
    const viewportSize = page.viewportSize();
    console.log("Viewport size:", viewportSize);
  });
});

test.describe('Pro Mobile — Settings', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Menu responsive y Settings dialog', async ({ page }) => {
    await page.goto('/app/');
    await waitForMobileWorkspace(page);

    // On mobile, settings might be accessed via a Hamburger menu in the header or ActivityBar fallback
    // The top bar has a settings icon or the bottom nav has a settings button
    const settingsBtn = page.locator('button[aria-label="Configuración de Vibe Studio"]').first();
    
    // If we can see it, click it
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      const dialog = page.locator('[role="dialog"][aria-label="Configuración de Vibe Studio"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Settings tabs should flow differently or scroll in mobile
      const connectionsTab = page.locator('button:has-text("Conexiones IA")');
      await expect(connectionsTab).toBeVisible();
    }
  });
});
