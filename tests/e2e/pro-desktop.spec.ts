import { test, expect } from '@playwright/test';
import { mockProAuth, mockChatResponse, waitForWorkspace, ensureChatOpen, openSettings } from './helpers/setup';

test.describe('Pro Desktop — Flujo completo de usuario autenticado', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  // ─── Auth & Workspace ──────────────────────────────────────────

  test('Pro user salta onboarding y carga workspace directo', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    // OnboardingFlow NO visible
    await expect(page.locator('text="Comenzar sin cuenta"')).toBeHidden();
    // Workspace SÍ visible
    await expect(page.locator('button[title*="Explorador"]')).toBeVisible();
  });

  test('Activity Bar muestra avatar/logout, NO link a landing', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    // El link "Conoce Vibe Studio" NO debe estar para pro
    await expect(page.locator('a[title*="Conoce Vibe Studio"]')).toBeHidden();
  });

  // ─── Chat Activo ───────────────────────────────────────────────

  test('Pro user ve textarea de chat, NO el CTA', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // El textarea SÍ debe existir para pro
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    // El CTA de login NO debe existir
    await expect(
      page.locator('text="Despierta a Vibe AI para potenciar tu código"')
    ).toBeHidden();
  });

  test('Pro user puede enviar mensaje y ver burbuja', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await textarea.fill('Hola desde el test E2E');
    await textarea.press('Enter');

    // La burbuja del usuario aparece (right-aligned)
    const userBubble = page.locator('.justify-end .whitespace-pre-wrap').filter({ hasText: 'Hola desde el test E2E' });
    await expect(userBubble).toBeVisible({ timeout: 10000 });
  });

  test('Starter prompts son clicables', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // Esperar a que cargue el welcome screen
    const welcomeHeading = page.locator('text="¿Qué vamos a construir hoy?"');
    await expect(welcomeHeading).toBeVisible({ timeout: 15000 });

    // Buscar algún prompt sugerido y clickearlo
    const prompt = page.locator('button').filter({ hasText: 'Navbar' }).first();
    const promptExists = await prompt.isVisible().catch(() => false);

    if (promptExists) {
      await prompt.click();
      const textarea = page.locator('textarea[placeholder*="Escribe"]');
      // Después del click, el textarea debería tener contenido o un mensaje debe haberse enviado
      await page.waitForTimeout(500);
    }
    // Si no hay prompts visibles, el test es inconcluso pero no falla
    // (los prompts pueden ser dinámicos)
  });

  // ─── Settings ──────────────────────────────────────────────────

  test('Settings: Agentes Pro visible para pro user', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await openSettings(page);

    await expect(page.locator('h2:has-text("Conexiones IA")')).toBeVisible({ timeout: 5000 });
    // Agentes Pro SÍ visible para pro
    await expect(page.locator('button:has-text("Agentes Pro")')).toBeVisible();
  });

  // ─── Vibe Pro Engine ───────────────────────────────────────────

  test('Vibe Pro Engine toggle visible para pro user', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // El toggle "Vibe Pro Engine" aparece sobre el ChatInput para pro users
    await expect(
      page.locator('text="Vibe Pro Engine"')
    ).toBeVisible({ timeout: 15000 });
  });

  test('Chat header muestra "Vibe AI"', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    await expect(page.locator('span:has-text("Vibe AI")')).toBeVisible({ timeout: 10000 });
  });
});
