import { test, expect } from '@playwright/test';
import { mockGuestAuth, mockProAuth, mockChatResponse, enterAsGuest, waitForWorkspace, ensureChatOpen, openSettings } from './helpers/setup';

// ═══════════════════════════════════════════════════════════════════
// Accessibility E2E — validates ARIA attributes across all components
// ═══════════════════════════════════════════════════════════════════

test.describe('A11y — Onboarding & LoginScreen', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('OnboardingFlow: decorative orbs are aria-hidden', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('h1:has-text("Vibecodea en español")')).toBeVisible({ timeout: 10000 });

    // Background orbs should be aria-hidden
    const hiddenOrbs = page.locator('.animate-blob[aria-hidden="true"]');
    await expect(hiddenOrbs.first()).toBeAttached();
  });
});

test.describe('A11y — ActivityBar & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('ActivityBar has toolbar role and labeled buttons', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    // ActivityBar should have role=toolbar
    const toolbar = page.locator('[role="toolbar"]');
    await expect(toolbar).toBeAttached({ timeout: 5000 });

    // Core buttons should have aria-labels
    await expect(page.locator('button[aria-label="Explorador de Archivos"]')).toBeAttached();
    await expect(page.locator('button[aria-label="Vibe AI Chat"]')).toBeAttached();
    await expect(page.locator('button[aria-label="Configuración"]')).toBeAttached();
  });

  test('ActivityBar buttons have aria-pressed state', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    const chatBtn = page.locator('button[aria-label="Vibe AI Chat"]');
    // Chat sidebar starts open, so button should be pressed
    const pressed = await chatBtn.getAttribute('aria-pressed');
    expect(pressed).toBeTruthy();
  });
});

test.describe('A11y — Settings Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('Settings opens as a proper dialog with role and aria-modal', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openSettings(page);

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute('aria-label', 'Configuración de Vibe Studio');
  });

  test('Settings dialog closes on Escape', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openSettings(page);

    const dialog = page.locator('[role="dialog"][aria-label="Configuración de Vibe Studio"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test('VibeLens toggle has role=switch and aria-checked', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openSettings(page);

    // Navigate to Apariencia tab to find VibeLens
    await page.locator('button:has-text("Apariencia")').click();
    await page.waitForTimeout(300);

    const vibeLensSwitch = page.locator('[role="switch"][aria-label*="VibeLens"]');
    await expect(vibeLensSwitch).toBeAttached();

    const checked = await vibeLensSwitch.getAttribute('aria-checked');
    expect(['true', 'false']).toContain(checked);
  });

  test('Chat position buttons have aria-pressed', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openSettings(page);

    await page.locator('button:has-text("Apariencia")').click();
    await page.waitForTimeout(300);

    const leftBtn = page.locator('button[aria-pressed]:has-text("Izquierda")');
    const rightBtn = page.locator('button[aria-pressed]:has-text("Derecha")');

    // One should be pressed, the other not
    const leftPressed = await leftBtn.getAttribute('aria-pressed');
    const rightPressed = await rightBtn.getAttribute('aria-pressed');
    expect(leftPressed !== rightPressed).toBeTruthy();
  });
});

test.describe('A11y — ChatInput & MessageList', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('MessageList has role=log with aria-live', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const log = page.locator('[role="log"][aria-live="polite"]');
    await expect(log).toBeAttached({ timeout: 10000 });
  });

  test('ChatInput quick action buttons have aria-labels', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // ChatInput is inside lazy-loaded ChatPanel — wait for textarea first
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await expect(page.locator('button[aria-label*="Explicar c\u00f3digo"]')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('button[aria-label*="Optimizar c\u00f3digo"]')).toBeAttached();
    await expect(page.locator('button[aria-label*="Corregir errores"]')).toBeAttached();
    await expect(page.locator('button[aria-label*="Generar tests"]')).toBeAttached();
  });

  test('Send button has aria-label', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    await expect(
      page.locator('button[aria-label="Enviar mensaje"]')
    ).toBeAttached({ timeout: 10000 });
  });

  test('Starter prompt buttons have aria-labels', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const starterBtn = page.locator('button[aria-label*="Sugerencia:"]').first();
    await expect(starterBtn).toBeAttached({ timeout: 10000 });
  });
});

test.describe('A11y — ViewTabs', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('ViewTabs has role=tablist with labeled tabs', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    const tablist = page.locator('[role="tablist"][aria-label*="Editor"]');
    await expect(tablist).toBeAttached({ timeout: 5000 });

    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('ViewTabs: active tab has aria-selected=true', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    const selectedTab = page.locator('[role="tab"][aria-selected="true"]');
    await expect(selectedTab).toBeAttached({ timeout: 5000 });
  });
});

test.describe('A11y — CommandPalette', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  test('CommandPalette opens with Ctrl+K as a dialog', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    await page.keyboard.press('Control+k');

    const dialog = page.locator('[role="dialog"][aria-label="Paleta de comandos"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Has combobox input
    const combobox = page.locator('[role="combobox"][aria-label*="Buscar"]');
    await expect(combobox).toBeVisible();

    // Has listbox results
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeAttached();
  });

  test('CommandPalette closes on Escape', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    await page.keyboard.press('Control+k');
    const dialog = page.locator('[role="dialog"][aria-label="Paleta de comandos"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test('CommandPalette items have role=option with aria-selected', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toBeAttached({ timeout: 3000 });

    // First option should be selected by default
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('A11y — Pro Engine Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Vibe Pro Engine toggle has aria-label', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // The toggle is an input[type=checkbox] with sr-only class, not a button
    const toggle = page.locator('input[aria-label="Activar Vibe Pro Engine"]');
    await expect(toggle).toBeAttached({ timeout: 15000 });
  });
});
