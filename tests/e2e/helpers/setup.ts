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
  // Block auth API calls
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email, plan: 'pro' } }),
    })
  );
  
  // Skip onboarding
  await page.addInitScript(() => {
    localStorage.setItem('vibe-onboarding-done', 'true');
  });
  
  // After React mounts, inject auth state
  await page.addInitScript((testEmail: string) => {
    // Poll until Zustand store is ready
    const injectAuth = () => {
      try {
        // Access the auth store's internal setState
        const stores = (window as any).__zustand_stores__;
        if (stores?.auth) {
          stores.auth.setState({
            authMode: 'authenticated',
            user: { email: testEmail, plan: 'pro' },
            plan: 'pro',
            hasCompletedOnboarding: true,
            sessionDetected: true,
          });
          return;
        }
      } catch {}
      setTimeout(injectAuth, 100);
    };
    // Start polling after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(injectAuth, 500));
    } else {
      setTimeout(injectAuth, 500);
    }
  }, email);
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
  // Just wait for the chat content to be present
  const chatContent = page.locator('text="Despierta a Vibe AI para potenciar tu código"');
  const textarea = page.locator('textarea');
  
  // Either the guest CTA or the pro textarea should be visible
  try {
    await expect(chatContent.or(textarea.first())).toBeVisible({ timeout: 5000 });
  } catch {
    // Chat might need toggling via focus mode
    const focusBtn = page.locator('[aria-label="Modo Enfoque Multi-Chat"]');
    if (await focusBtn.isVisible()) {
      // We might be in fullscreen, try to exit
      const exitBtn = page.locator('[aria-label="Salir de modo enfoque"]');
      if (await exitBtn.isVisible()) {
        await exitBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }
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
  
  // Now the WelcomeScreen should be visible with template cards
  // Each template card is a <button> containing <h3>templateName</h3>
  const templateH3 = page.locator(`h3:has-text("${templateName}")`);
  await expect(templateH3).toBeVisible({ timeout: 5000 });
  
  // Click the parent button (the card)
  await templateH3.click();
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
