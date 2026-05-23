import { Page, expect } from '@playwright/test';

// ─── Viewports ─────────────────────────────────────────────────

export const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 812 },
};

// ─── Auth Mocks ────────────────────────────────────────────────

/**
 * Configura un usuario no autenticado (invitado).
 * - /auth/me → 401
 * - localStorage limpio (sin onboarding completado)
 */
export async function mockGuestAuth(page: Page) {
  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 401 })
  );
}

/**
 * Configura un usuario PRO autenticado.
 * The auth store uses Zustand (not persisted), so we:
 * 1. Skip onboarding via localStorage
 * 2. After page load, inject auth state via window.__VIBE_TEST_AUTH__
 */
export async function mockProAuth(page: Page, email = 'owner@opitacode.com') {
  // Skip onboarding
  await page.addInitScript(() => {
    localStorage.setItem('vibe-onboarding-done', 'true');
  });
  
  // Create a dummy JWT that decodeJWT in sso.ts can parse
  const payloadStr = JSON.stringify({
    email,
    plan: 'pro',
    sub: 'user-1234'
  });
  const dummyJwt = `header.${btoa(payloadStr)}.signature`;

  // Inject the cookie before page loads so detectSession picks it up
  await page.addInitScript((jwt) => {
    document.cookie = `opita_id_token=${jwt}; path=/;`;
  }, dummyJwt);
}

// ─── Chat SSE Mock ─────────────────────────────────────────────

/**
 * Intercepta las Lambda URLs de AWS para simular respuestas de IA.
 * Devuelve un SSE stream con el contenido dado.
 */
export async function mockChatResponse(page: Page, content = 'Respuesta de prueba de la IA') {
  await page.route('https://*.lambda-url.*.on.aws/**', async (route) => {
    const sseBody = `data: {"content": "${content}"}\n\ndata: [DONE]\n\n`;
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    });
  });
}

// ─── Navigation Helpers ────────────────────────────────────────

/** Navega al workspace como invitado — el workspace carga directamente sin onboarding gate */
export async function enterAsGuest(page: Page) {
  await waitForWorkspace(page);
}

/** Espera a que el workspace esté listo (ActivityBar con botón de explorador) */
export async function waitForWorkspace(page: Page) {
  // REAL selector: aria-label="Explorador de Archivos"
  await page.locator('[aria-label="Explorador de Archivos"]').waitFor({
    state: 'visible',
    timeout: 15000,
  });
}

/**
 * Asegura que el chat sea visible.
 * 
 * En el layout chat-first, el ChatPanel (SidebarSlot) siempre se renderiza.
 * Solo necesitamos verificar que el contenido del chat sea visible.
 */
export async function ensureChatOpen(page: Page) {
  // Chat-first layout: chat is always visible
  // Wait for the guest CTA or the pro textarea to appear
  const chatContent = page.locator('text="Despierta a Vibe AI para potenciar tu código"');
  const textarea = page.locator('textarea');
  await expect(chatContent.or(textarea.first())).toBeVisible({ timeout: 8000 });
}

/** Abre el panel de explorador */
export async function openExplorer(page: Page) {
  // REAL selector: aria-label="Explorador de Archivos"
  const explorerBtn = page.locator('[aria-label="Explorador de Archivos"]');
  await explorerBtn.click();
  await page.waitForTimeout(300);
}

/** Abre el panel de settings */
export async function openSettings(page: Page) {
  // REAL selector: aria-label="Configuración"
  const settingsBtn = page.locator('[aria-label="Configuración"]');
  await settingsBtn.click();
  await page.waitForTimeout(500);
}

/** Selecciona un template desde el WelcomeScreen */
export async function selectTemplate(page: Page, templateName: string) {
  // Default activeView is "preview" which hides the WelcomeScreen.
  // Switch to editor view by clicking "Cerrar vista previa" if needed.
  const closePreview = page.locator('[aria-label="Cerrar vista previa"]');
  if (await closePreview.isVisible().catch(() => false)) {
    await closePreview.click();
    await page.waitForTimeout(500);
  }

  // Map display names to data-testid template chip IDs
  const chipIds: Record<string, string> = {
    'Landing React':       'react-landing',
    'Portfolio Personal':  'portfolio',
    'App de Tareas':       'todo-app',
    'Dashboard':           'dashboard',
  };
  const chipId = chipIds[templateName] ?? templateName.toLowerCase().replace(/\s+/g, '-');
  const chip = page.locator(`[data-testid="template-chip-${chipId}"]`);
  await expect(chip).toBeVisible({ timeout: 5000 });
  await chip.click();
  // Wait for scaffoldTemplate to process
  await page.waitForTimeout(1500);
}

/** Espera a que el preview iframe esté presente */
export async function waitForPreview(page: Page) {
  await page.locator('iframe').first().waitFor({
    state: 'attached',
    timeout: 15000,
  });
}
