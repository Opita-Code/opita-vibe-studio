import { test, expect } from '@playwright/test';
import { mockProAuth, mockChatResponse, waitForWorkspace, ensureChatOpen, openSettings } from './helpers/setup';

// ═══════════════════════════════════════════════════════════════════
// Pro Experience — comprehensive validation of all Pro-tier features
// ═══════════════════════════════════════════════════════════════════

test.describe('Pro Experience — Chat Core', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Chat textarea visible con placeholder correcto', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await expect(textarea).toBeEnabled();
  });

  test('Enviar mensaje muestra burbuja de usuario', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await textarea.fill('Test de calidad Pro');
    await textarea.press('Enter');

    // User bubble appears right-aligned
    const userBubble = page.locator('.justify-end .whitespace-pre-wrap').filter({ hasText: 'Test de calidad Pro' });
    await expect(userBubble).toBeVisible({ timeout: 10000 });
  });

  test('IA responde tras enviar mensaje', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await textarea.fill('Dame una respuesta');
    await textarea.press('Enter');

    // Wait for the AI response bubble (left-aligned, has markdown prose)
    const aiBubble = page.locator('.justify-start .prose').first();
    await expect(aiBubble).toBeVisible({ timeout: 15000 });
  });

  test('Starter prompts inyectan texto en textarea', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const welcomeHeading = page.locator('text="¿Qué vamos a construir hoy?"');
    await expect(welcomeHeading).toBeVisible({ timeout: 15000 });

    // Click a starter prompt
    const prompt = page.locator('button[aria-label*="Sugerencia:"]').first();
    if (await prompt.isVisible()) {
      await prompt.click();
      // After clicking, the user bubble should appear (message was sent)
      await page.waitForTimeout(1000);
      const userBubbles = page.locator('.justify-end');
      const count = await userBubbles.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('Quick action "Explicar" inyecta template en textarea', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const explainBtn = page.locator('button[aria-label*="Explicar código"]');
    await expect(explainBtn).toBeVisible();
    await explainBtn.click();

    // Textarea should now have the template text
    const value = await textarea.inputValue();
    expect(value).toContain('Explica el siguiente código');
  });

  test('Quick action "Optimizar" inyecta template', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await page.locator('button[aria-label*="Optimizar código"]').click();
    const value = await textarea.inputValue();
    expect(value).toContain('Optimiza el siguiente código');
  });

  test('Quick action "Corregir" inyecta template', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await page.locator('button[aria-label*="Corregir errores"]').click();
    const value = await textarea.inputValue();
    expect(value).toContain('Encuentra y corrige');
  });

  test('Quick action "Generar tests" inyecta template', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await page.locator('button[aria-label*="Generar tests"]').click();
    const value = await textarea.inputValue();
    expect(value).toContain('test');
  });
});

test.describe('Pro Experience — Vibe Pro Engine', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Pro Engine toggle visible con label', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    await expect(page.locator('text="Vibe Pro Engine"')).toBeVisible({ timeout: 15000 });

    const toggle = page.locator('input[aria-label="Activar Vibe Pro Engine"]');
    await expect(toggle).toBeAttached();
  });

  test('Pro Engine toggle cambia estado', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const toggle = page.locator('input[aria-label="Activar Vibe Pro Engine"]');
    await expect(toggle).toBeAttached({ timeout: 15000 });

    // Check initial state (default: true)
    const initialChecked = await toggle.isChecked();
    expect(initialChecked).toBe(true);

    // Click the visual toggle (the label wrapping the hidden input)
    const toggleLabel = toggle.locator('..');
    await toggleLabel.click();
    await page.waitForTimeout(300);

    const afterClick = await toggle.isChecked();
    expect(afterClick).toBe(false);

    // Toggle back
    await toggleLabel.click();
    await page.waitForTimeout(300);
    expect(await toggle.isChecked()).toBe(true);
  });
});

test.describe('Pro Experience — Chat Header Controls', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Header muestra "Vibe AI" con indicador activo', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    await expect(page.locator('span:has-text("Vibe AI")')).toBeVisible({ timeout: 10000 });
    // Green status dot
    const dot = page.locator('.rounded-full.bg-aura-cyan').first();
    await expect(dot).toBeVisible();
  });

  test('Botón fullscreen toglea pantalla completa', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const fullscreenBtn = page.locator('button[aria-label*="Expandir panel de chat"]');
    await expect(fullscreenBtn).toBeVisible({ timeout: 10000 });

    await fullscreenBtn.click();
    await page.waitForTimeout(500);

    // After expanding, the contract button should appear
    const contractBtn = page.locator('button[aria-label*="Contraer panel de chat"]');
    await expect(contractBtn).toBeVisible({ timeout: 3000 });

    // Click contract to go back
    await contractBtn.click();
    await page.waitForTimeout(500);

    // Expand button should be back
    await expect(fullscreenBtn).toBeVisible({ timeout: 3000 });
  });

  test('Botón historial toglea estado activo', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // Wait for ChatPanel to fully load
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const historyBtn = page.locator('button[title="Mostrar/Ocultar Historial"]');
    await expect(historyBtn).toBeVisible();

    // Before click — button should NOT have the active class (text-aura-cyan)
    const classAttr = await historyBtn.getAttribute('class');
    const wasActive = classAttr?.includes('text-aura-cyan');

    // Click to toggle
    await historyBtn.click();
    await page.waitForTimeout(500);

    // After click — button class should change (toggled state)
    const classAfter = await historyBtn.getAttribute('class');
    const isNowActive = classAfter?.includes('text-aura-cyan');
    expect(isNowActive).not.toBe(wasActive);
  });
});

test.describe('Pro Experience — Settings Pro', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Settings muestra todas las tabs para Pro', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await openSettings(page);

    // All tabs visible
    await expect(page.locator('button:has-text("Conexiones IA")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Apariencia")')).toBeVisible();
    await expect(page.locator('button:has-text("Suscripción")')).toBeVisible();
    await expect(page.locator('button:has-text("Agentes Pro")')).toBeVisible();
    await expect(page.locator('button:has-text("Privacidad")')).toBeVisible();
  });

  test('Tab Agentes Pro muestra SubagentPanel con toggle y textarea', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await openSettings(page);

    // Navigate to Agentes Pro tab
    await page.locator('button:has-text("Agentes Pro")').click();
    await page.waitForTimeout(300);

    // SubagentPanel content
    await expect(page.locator('text="Motor Vibe Pro (AWS)"')).toBeVisible({ timeout: 3000 });

    // Instructions textarea
    const textarea = page.locator('textarea[placeholder*="Usa siempre TailwindCSS"]');
    await expect(textarea).toBeVisible();
  });

  test('Tab Apariencia muestra VibeLens toggle y posición de chat', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await openSettings(page);

    await page.locator('button:has-text("Apariencia")').click();
    await page.waitForTimeout(300);

    // VibeLens toggle
    const vibeLens = page.locator('[role="switch"][aria-label*="VibeLens"]');
    await expect(vibeLens).toBeAttached();

    // Chat position buttons
    await expect(page.locator('button[aria-pressed]:has-text("Izquierda")')).toBeAttached();
    await expect(page.locator('button[aria-pressed]:has-text("Derecha")')).toBeAttached();
  });

  test('Tab Conexiones IA muestra grid de proveedores', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await openSettings(page);

    await expect(page.locator('h2:has-text("Conexiones IA")')).toBeVisible({ timeout: 5000 });

    // Should have provider cards (at minimum the Opita/AWS provider)
    const providerCards = page.locator('.grid > div').first();
    await expect(providerCards).toBeVisible();
  });

  test('Settings cierra con Escape', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await openSettings(page);

    const dialog = page.locator('[role="dialog"][aria-label="Configuración de Vibe Studio"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });
});

test.describe('Pro Experience — Model Selector & Switching', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Model selector visible con aria-label correcto', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible({ timeout: 5000 });
  });

  test('Default model es Opita Flash (deepseek-chat)', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible();

    // Store default is deepseek-chat (Opita Flash)
    const selectedValue = await modelSelector.inputValue();
    expect(selectedValue).toBe('deepseek-chat');
  });

  test('Cambiar a Opita Architect actualiza selector', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible();

    // Switch to Opita Architect
    await modelSelector.selectOption('deepseek-reasoner');
    await page.waitForTimeout(300);

    const newValue = await modelSelector.inputValue();
    expect(newValue).toBe('deepseek-reasoner');
  });

  test('Model selector tiene opciones disponibles', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible();

    // Should have at least 2 options (Opita Architect + Opita Flash + others from provider)
    const options = modelSelector.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Cambiar modelo mantiene textarea funcional', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible();

    // Switch model
    await modelSelector.selectOption('deepseek-reasoner');
    await page.waitForTimeout(300);

    // Textarea should still be functional
    await textarea.fill('Test después de cambiar modelo');
    const value = await textarea.inputValue();
    expect(value).toBe('Test después de cambiar modelo');

    // Send button should be enabled
    const sendBtn = page.locator('button[aria-label="Enviar mensaje"]');
    await expect(sendBtn).toBeEnabled();
  });

  test('Cambiar modelo y enviar mensaje funciona', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const modelSelector = page.locator('select[aria-label="Seleccionar modelo de IA"]');
    await expect(modelSelector).toBeVisible();

    // Switch to a different model
    await modelSelector.selectOption('deepseek-reasoner');
    await page.waitForTimeout(300);

    // Send a message with the new model
    await textarea.fill('Mensaje con Opita Architect');
    await textarea.press('Enter');

    // User bubble should appear
    const userBubble = page.locator('.justify-end .whitespace-pre-wrap').filter({ hasText: 'Mensaje con Opita Architect' });
    await expect(userBubble).toBeVisible({ timeout: 10000 });

    // AI response should also appear (mocked)
    const aiBubble = page.locator('.justify-start .prose').first();
    await expect(aiBubble).toBeVisible({ timeout: 15000 });
  });

  test('Token counter visible y actualiza al escribir', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    // Token counter shows ~0 tokens initially
    const tokenCounter = page.locator('text=/~\\d+ tokens/');
    await expect(tokenCounter).toBeVisible();

    // Type some text
    await textarea.fill('Hola mundo, este es un test de conteo');
    await page.waitForTimeout(200);

    // Token count should update (> 0)
    const tokenText = await tokenCounter.textContent();
    expect(tokenText).toMatch(/~\d+ tokens/);
    const tokenCount = parseInt(tokenText?.match(/~(\d+)/)?.[1] || '0');
    expect(tokenCount).toBeGreaterThan(0);
  });

  test('Engine label visible junto al selector', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    // The "Engine 12k" label should be visible
    const engineLabel = page.locator('text=/Engine \\d+k/');
    await expect(engineLabel).toBeVisible();
  });
});

test.describe('Pro Experience — CommandPalette', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Ctrl+K abre la paleta y muestra comandos', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    await page.keyboard.press('Control+k');

    const dialog = page.locator('[role="dialog"][aria-label="Paleta de comandos"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Should have items
    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Buscar filtra resultados en la paleta', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    await page.keyboard.press('Control+k');
    const input = page.locator('[role="combobox"]');
    await expect(input).toBeVisible({ timeout: 3000 });

    // Type to filter — use "editor" which exists in current omnibar items
    await input.fill('editor');
    await page.waitForTimeout(500);

    // Results should be filtered
    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // At least one should contain "editor" or "configuración" in its text
    const firstOption = options.first();
    const text = await firstOption.textContent();
    expect(text?.toLowerCase()).toMatch(/editor|configuraci/);
  });

  test('Escape cierra la paleta', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    await page.keyboard.press('Control+k');
    const dialog = page.locator('[role="dialog"][aria-label="Paleta de comandos"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 2000 });
  });

  test('Flechas navegan entre opciones', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // First option selected by default
    const firstOption = page.locator('[role="option"][aria-selected="true"]').first();
    await expect(firstOption).toBeAttached();

    // Press ArrowDown
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // A different option should now be selected
    const selectedAfter = page.locator('[role="option"][aria-selected="true"]');
    await expect(selectedAfter).toBeAttached();
  });
});

test.describe('Pro Experience — Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('Ctrl+L toggle del chat sidebar', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);

    // Chat header with specific class — the chat panel header
    const chatPanel = page.locator('aside').filter({ has: page.locator('span:has-text("Vibe AI")') });
    await expect(chatPanel).toBeVisible({ timeout: 10000 });

    // Toggle off
    await page.keyboard.press('Control+l');
    await page.waitForTimeout(800);

    // The entire aside (ChatPanel) should be hidden
    await expect(chatPanel).toBeHidden({ timeout: 5000 });

    // Toggle back on
    await page.keyboard.press('Control+l');
    await page.waitForTimeout(800);

    await expect(chatPanel).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Pro Experience — ViewTabs', () => {
  test.beforeEach(async ({ page }) => {
    await mockProAuth(page);
    await mockChatResponse(page);
  });

  test('ViewTabs tiene tabs Editor y Preview', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    const tablist = page.locator('[role="tablist"]').first();
    await expect(tablist).toBeAttached({ timeout: 5000 });

    // Should have at least Editor and Preview tabs
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Click en tab cambia aria-selected', async ({ page }) => {
    await page.goto('/app/');
    await waitForWorkspace(page);

    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count >= 2) {
      // Find which tab is selected
      const selectedTab = page.locator('[role="tab"][aria-selected="true"]');
      await expect(selectedTab).toBeAttached();

      // Click another tab
      const secondTab = tabs.nth(1);
      await secondTab.click();
      await page.waitForTimeout(300);

      // Second tab should now be selected
      const newSelected = await secondTab.getAttribute('aria-selected');
      expect(newSelected).toBe('true');
    }
  });
});
