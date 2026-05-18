/**
 * Vibe Studio — Production Smoke Tests
 *
 * Runs against https://vibe.opitacode.com (live production).
 * Uses Playwright project "production" with extended timeouts.
 *
 * Test categories:
 * 1. Landing page health & SEO
 * 2. App onboarding (guest flow)
 * 3. Auth flows (login modal, forgot password)
 * 4. Workspace features (guest)
 * 5. API health (billing, core)
 * 6. Pro authenticated flow (real Cognito token)
 * 7. Analytics ingestion
 *
 * Run: npx playwright test --project=production tests/e2e/production-smoke.spec.ts
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────

const PROD_APP = '/app/';
const PROD_API = 'https://api.opitacode.com';

function getE2EToken(): string | null {
  try {
    const tokenPath = path.resolve(process.cwd(), 'playwright/.auth/token.json');
    const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    return data.token || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1. LANDING PAGE — Health & SEO
// ═══════════════════════════════════════════════════════════════════

test.describe('🌐 Landing Page', () => {
  test('Landing carga y muestra hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Vibe Studio/i);

    // Hero heading
    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible({ timeout: 10000 });
  });

  test('Pricing section (#pricing) existe y muestra planes', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForTimeout(1000);

    const pricing = page.locator('#pricing');
    await expect(pricing).toBeAttached();

    // Verify pricing section has visible content (headings, buttons, etc.)
    const pricingContent = pricing.locator('h3, h4, button, [class*="price"]');
    const count = await pricingContent.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('CTA "Comenzar Gratis" / "Abrir Studio" apunta a /app/', async ({ page }) => {
    await page.goto('/');

    const ctaLink = page.locator('a[href="/app/"]').first();
    await expect(ctaLink).toBeAttached({ timeout: 5000 });
  });

  test('Meta tags SEO presentes en landing', async ({ page }) => {
    await page.goto('/');

    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(30);
  });

  test('Landing no tiene errores de consola críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors (e.g., analytics 404 in dev)
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('sendBeacon')
    );
    expect(critical).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. APP ONBOARDING — Guest Flow (NO mocks)
// ═══════════════════════════════════════════════════════════════════

test.describe('🚀 App Onboarding (Guest)', () => {
  test('App carga onboarding con heading "Vibecodea en español"', async ({ page }) => {
    await page.goto(PROD_APP);

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15000 });
    const text = await heading.textContent();
    expect(text).toContain('Vibecodea en español');
  });

  test('Botones "Comenzar sin cuenta" e "Iniciar sesión" visibles', async ({ page }) => {
    await page.goto(PROD_APP);
    await page.waitForTimeout(2000); // Wait for animation

    await expect(page.locator('button:has-text("Comenzar sin cuenta")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Iniciar sesión")')).toBeVisible();
  });

  test('Click "Comenzar sin cuenta" carga workspace', async ({ page }) => {
    await page.goto(PROD_APP);

    const guestBtn = page.locator('button:has-text("Comenzar sin cuenta")');
    await expect(guestBtn).toBeVisible({ timeout: 10000 });
    await guestBtn.click();

    // Wait for workspace (ActivityBar visible)
    await expect(page.locator('[aria-label="Explorador de Archivos"]')).toBeVisible({ timeout: 15000 });
  });

  test('SEO tags presentes en /app/', async ({ page }) => {
    await page.goto(PROD_APP);

    const title = await page.title();
    expect(title).toContain('Vibe Studio');

    await expect(page.locator('meta[property="og:title"]')).toBeAttached();
    await expect(page.locator('link[rel="canonical"]')).toBeAttached();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. AUTH FLOWS — Login Modal & Forgot Password
// ═══════════════════════════════════════════════════════════════════

test.describe('🔐 Auth Flows', () => {
  test('Click "Iniciar sesión" abre modal de login', async ({ page }) => {
    await page.goto(PROD_APP);

    const loginBtn = page.locator('button:has-text("Iniciar sesión")');
    await expect(loginBtn).toBeVisible({ timeout: 10000 });
    await loginBtn.click();

    // Login form should appear
    await expect(page.locator('input[type="email"], input[placeholder*="correo"]')).toBeVisible({ timeout: 5000 });
  });

  test('Login muestra campos de email y contraseña', async ({ page }) => {
    await page.goto(PROD_APP);

    await page.locator('button:has-text("Iniciar sesión")').click();
    await page.waitForTimeout(500);

    await expect(page.locator('input[type="email"], input[placeholder*="correo"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Link "¿Olvidaste tu contraseña?" existe', async ({ page }) => {
    await page.goto(PROD_APP);

    await page.locator('button:has-text("Iniciar sesión")').click();
    await page.waitForTimeout(500);

    const forgotLink = page.locator('button:has-text("Olvidaste"), a:has-text("Olvidaste")');
    await expect(forgotLink).toBeAttached({ timeout: 5000 });
  });

  test('Login con credenciales inválidas muestra error (no crash)', async ({ page }) => {
    await page.goto(PROD_APP);

    await page.locator('button:has-text("Iniciar sesión")').click();
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"], input[placeholder*="correo"]');
    await emailInput.fill('invalid@test.com');

    const passInput = page.locator('input[type="password"]');
    await passInput.fill('wrong-password-123');

    // Submit — find the submit button inside the login modal
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      // Fallback: press Enter in the password field
      await passInput.press('Enter');
    }

    // Wait for error response from Cognito
    await page.waitForTimeout(5000);

    // Page should still be functional (no white screen of death)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. WORKSPACE — Guest Experience
// ═══════════════════════════════════════════════════════════════════

test.describe('🛠️ Workspace (Guest)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PROD_APP);
    const guestBtn = page.locator('button:has-text("Comenzar sin cuenta")');
    await expect(guestBtn).toBeVisible({ timeout: 10000 });
    await guestBtn.click();
    await expect(page.locator('[aria-label="Explorador de Archivos"]')).toBeVisible({ timeout: 15000 });
  });

  test('ActivityBar: todos los botones core visibles', async ({ page }) => {
    await expect(page.locator('[aria-label="Explorador de Archivos"]')).toBeVisible();
    await expect(page.locator('[aria-label="Buscar en Archivos"]')).toBeVisible();
    await expect(page.locator('[aria-label="Configuración"]')).toBeVisible();
    await expect(page.locator('[aria-label="Reportar Bug o Feedback"]')).toBeVisible();
  });

  test('Guest ve CTA de login en el chat, NO textarea', async ({ page }) => {
    await expect(
      page.locator('text="Despierta a Vibe AI para potenciar tu código"')
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('textarea[placeholder*="Escribe"]')).toBeHidden();
  });

  test('Welcome screen muestra templates', async ({ page }) => {
    await expect(page.locator('text="Comienza con un template"')).toBeAttached({ timeout: 10000 });
  });

  test('CommandPalette abre con Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('[aria-label="Buscar comandos y archivos"]')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-label="Buscar comandos y archivos"]')).toBeHidden();
  });

  test('Settings abre y cierra correctamente', async ({ page }) => {
    await page.locator('[aria-label="Configuración"]').click();
    await expect(page.locator('h2:has-text("Conexiones IA")')).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('h2:has-text("Conexiones IA")')).toBeHidden();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. API HEALTH — Backend Endpoints
// ═══════════════════════════════════════════════════════════════════

test.describe('⚡ API Health', () => {
  test('API base URL es accesible (no 5xx)', async ({ request }) => {
    // No dedicated /health endpoint; verify the API router responds
    const res = await request.get(`${PROD_API}/core/auth/me`);
    // 401 means the Lambda is running and auth guard works
    expect(res.status()).toBeLessThan(500);
  });

  test('Chat Lambda health check — providers configurados', async ({ request }) => {
    const res = await request.post(`${PROD_API}/chat/`, {
      data: { action: 'health_check' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.providers).toBeDefined();
    // At least one AI provider must be configured
    const hasProvider = body.providers.deepseek || body.providers.gemini || body.providers.openai;
    expect(hasProvider).toBeTruthy();
    // Auth secrets must be present
    expect(body.auth.hasJwtSecret).toBe(true);
  });

  test('GET /billing/sign sin params retorna 400 (no crash)', async ({ request }) => {
    const res = await request.get(`${PROD_API}/billing/sign`);
    // Should return 400 (missing params), not 500
    expect([400, 401]).toContain(res.status());
  });

  test('POST /core/events/ingest acepta eventos válidos', async ({ request }) => {
    const res = await request.post(`${PROD_API}/core/events/ingest`, {
      data: {
        sessionId: 'e2e-smoke-test',
        events: [
          {
            type: 'page_view',
            source: 'e2e',
            consent: 'basic',
            data: { url: '/e2e-test', test: true },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /core/events/ingest rechaza body vacío', async ({ request }) => {
    const res = await request.post(`${PROD_API}/core/events/ingest`, {
      data: {},
    });
    // Missing sessionId and events → should be rejected
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /core/auth/login con credenciales inválidas retorna error (no crash)', async ({ request }) => {
    const res = await request.post(`${PROD_API}/core/auth/login`, {
      data: { email: 'e2e-fake@test.com', password: 'wrong' },
    });
    // Should be 401 or 400, NOT 500
    expect(res.status()).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. PRO AUTHENTICATED FLOW (requires E2E staging token)
// ═══════════════════════════════════════════════════════════════════

test.describe('👑 Pro User (Authenticated)', () => {
  const token = getE2EToken();

  test.skip(!token, 'Skipped: no E2E token (run global-setup first via staging project)');

  test('Pro user salta onboarding y ve workspace', async ({ page }) => {
    // Inject auth cookie
    await page.addInitScript((jwt) => {
      document.cookie = `opita_id_token=${jwt}; path=/;`;
      localStorage.setItem('vibe-onboarding-done', 'true');
    }, token!);

    await page.goto(PROD_APP);

    // Should skip onboarding, land on workspace
    await expect(page.locator('[aria-label="Explorador de Archivos"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text="Comenzar sin cuenta"')).toBeHidden();
  });

  test('Pro user ve textarea de chat (no CTA)', async ({ page }) => {
    await page.addInitScript((jwt) => {
      document.cookie = `opita_id_token=${jwt}; path=/;`;
      localStorage.setItem('vibe-onboarding-done', 'true');
    }, token!);

    await page.goto(PROD_APP);
    await expect(page.locator('[aria-label="Explorador de Archivos"]')).toBeVisible({ timeout: 15000 });

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await expect(
      page.locator('text="Despierta a Vibe AI para potenciar tu código"')
    ).toBeHidden();
  });

  test('Pro user puede enviar mensaje al chat', async ({ page }) => {
    await page.addInitScript((jwt) => {
      document.cookie = `opita_id_token=${jwt}; path=/;`;
      localStorage.setItem('vibe-onboarding-done', 'true');
    }, token!);

    await page.goto(PROD_APP);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await textarea.fill('Test E2E smoke — ignore this message');
    await textarea.press('Enter');

    // User bubble appears
    const userBubble = page.locator('.justify-end .whitespace-pre-wrap').filter({
      hasText: 'Test E2E smoke',
    });
    await expect(userBubble).toBeVisible({ timeout: 10000 });
  });

  test('GET /billing/sign con userId retorna firma válida', async ({ request }) => {
    const res = await request.get(
      `${PROD_API}/billing/sign?product=VIBE_STUDENT&userId=vibe-tester-01@opitacode.com`
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.publicKey).toBeTruthy();
    expect(body.signature).toBeTruthy();
    expect(body.reference).toContain('VIBE_STUDENT');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. CROSS-CUTTING — Performance & Security Headers
// ═══════════════════════════════════════════════════════════════════

test.describe('🔒 Security & Performance', () => {
  test('Landing retorna en menos de 3 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);
  });

  test('App retorna en menos de 5 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto(PROD_APP);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  test('No mixed content (HTTP in HTTPS)', async ({ page }) => {
    const mixedContent: string[] = [];
    page.on('request', (req) => {
      if (req.url().startsWith('http://') && !req.url().includes('localhost')) {
        mixedContent.push(req.url());
      }
    });

    await page.goto(PROD_APP);
    await page.waitForTimeout(3000);

    expect(mixedContent).toEqual([]);
  });
});
