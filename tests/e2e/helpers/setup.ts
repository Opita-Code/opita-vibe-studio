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
 * - /auth/me → 200 con user profile
 * - onboarding marcado como completado
 */
export async function mockProAuth(page: Page, email = 'owner@opitacode.com') {
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { email, plan: 'pro' },
      }),
    })
  );
  // Pro user siempre tiene onboarding completado
  await page.addInitScript(() => {
    localStorage.setItem('vibe-onboarding-done', 'true');
  });
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

/** Completa el onboarding como invitado clicando "Comenzar sin cuenta" */
export async function enterAsGuest(page: Page) {
  const guestBtn = page.locator('button:has-text("Comenzar sin cuenta")');
  await expect(guestBtn).toBeVisible({ timeout: 10000 });
  await guestBtn.click();
  // Esperar a que el workspace cargue (ActivityBar visible)
  await waitForWorkspace(page);
}

/** Espera a que el workspace esté listo (ActivityBar con botón de explorador) */
export async function waitForWorkspace(page: Page) {
  await page.locator('button[title*="Explorador"]').waitFor({
    state: 'visible',
    timeout: 15000,
  });
}

/**
 * Asegura que el sidebar de chat esté abierto.
 * 
 * NOTA: El store inicializa activeSidebar: "chat", por lo que
 * el primer click en el botón "Vibe AI Chat" lo CIERRA.
 * Esta función maneja ese toggle.
 */
export async function ensureChatOpen(page: Page) {
  const chatBtn = page.locator('button[title*="Vibe AI"]');

  // Buscamos "Vibe AI" header text que aparece dentro del ChatPanel
  const chatHeader = page.locator('text="Vibe AI"').first();

  const headerVisible = await chatHeader.isVisible().catch(() => false);
  if (headerVisible) return; // Ya está abierto

  // Primer click — puede cerrar o abrir
  await chatBtn.click();
  await page.waitForTimeout(500);

  const nowVisible = await chatHeader.isVisible().catch(() => false);
  if (nowVisible) return;

  // Si lo cerró, clickear de nuevo para abrirlo
  await chatBtn.click();
  await page.waitForTimeout(1000);
}

/** Abre el panel de explorador */
export async function openExplorer(page: Page) {
  const explorerBtn = page.locator('button[title*="Explorador"]');
  await explorerBtn.click();
  await page.waitForTimeout(300);
}

/** Abre el panel de settings */
export async function openSettings(page: Page) {
  const settingsBtn = page.locator('button[title*="Configuración"]');
  await settingsBtn.click();
  await page.waitForTimeout(500);
}
