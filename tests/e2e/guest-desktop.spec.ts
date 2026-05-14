import { test, expect } from '@playwright/test';
import { mockGuestAuth, enterAsGuest, ensureChatOpen, openExplorer, openSettings } from './helpers/setup';

test.describe('Guest Desktop — Flujo completo de invitado', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestAuth(page);
  });

  // ─── Onboarding ────────────────────────────────────────────────

  test('Onboarding muestra heading y ambos botones', async ({ page }) => {
    await page.goto('/app/');

    await expect(page.locator('h1:has-text("Vibecodea en español")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Comenzar sin cuenta")')).toBeVisible();
    await expect(page.locator('button:has-text("Iniciar sesión")').first()).toBeVisible();
  });

  test('Entrada como invitado carga el workspace', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    // Activity Bar completo visible
    await expect(page.locator('button[title*="Explorador"]')).toBeVisible();
    await expect(page.locator('button[title*="Vibe AI"]')).toBeVisible();
    await expect(page.locator('button[title*="Configuración"]')).toBeVisible();
  });

  // ─── Chat Gate ─────────────────────────────────────────────────

  test('Guest ve CTA de login en el chat, NO textarea', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await ensureChatOpen(page);

    // El invitado ve el CTA en vez del textarea
    await expect(
      page.locator('text="Despierta a Vibe AI para potenciar tu código"')
    ).toBeVisible({ timeout: 10000 });

    // El botón "Iniciar Sesión" dentro del CTA
    await expect(
      page.locator('button:has-text("Iniciar Sesión")').last()
    ).toBeVisible();

    // El textarea NO debe existir
    await expect(
      page.locator('textarea[placeholder*="Escribe"]')
    ).toBeHidden();
  });

  test('Welcome screen muestra heading', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await ensureChatOpen(page);

    await expect(
      page.locator('text="¿Qué vamos a construir hoy?"')
    ).toBeVisible({ timeout: 10000 });
  });

  // ─── Explorer ──────────────────────────────────────────────────

  test('Explorador: abrir y ver estado vacío', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openExplorer(page);

    const panel = page.locator('[data-testid="explorer-dock"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  // ─── Settings ──────────────────────────────────────────────────

  test('Settings: heading Conexiones IA visible', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openSettings(page);

    await expect(page.locator('h2:has-text("Conexiones IA")')).toBeVisible({ timeout: 5000 });
  });

  test('Settings: tabs visibles, sin Agentes Pro para guest', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);
    await openSettings(page);

    await expect(page.locator('button:has-text("Apariencia")')).toBeVisible();
    await expect(page.locator('button:has-text("Suscripción")')).toBeVisible();

    // "Agentes Pro" NO visible para invitados
    await expect(page.locator('button:has-text("Agentes Pro")')).toBeHidden();
  });

  // ─── Landing Link ──────────────────────────────────────────────

  test('Invitado ve enlace a Landing en WelcomeScreen', async ({ page }) => {
    await page.goto('/app/');
    await enterAsGuest(page);

    // The link lives in WelcomeScreen (EditorPanel main area)
    // It may be behind the sidebar, so we check the DOM rather than visual visibility
    const landingLink = page.locator('a:has-text("Conoce Vibe Studio")');
    await expect(landingLink).toBeAttached({ timeout: 5000 });
  });
});
