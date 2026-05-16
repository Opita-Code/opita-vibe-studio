import { test, expect } from '@playwright/test';
import { waitForWorkspace, ensureChatOpen } from '../helpers/setup';

// Nota: Estos tests apuntan al backend REAL de staging.
// Requieren una sesión válida con plan PRO para ejecutar los agentes y usar herramientas.
const MODELS_TO_TEST = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
];

MODELS_TO_TEST.forEach((model) => {
  test.describe(`Vibe AI - Capacidad con ${model.name}`, () => {
    
    test.setTimeout(180000); // 3 minutos para allow deepseek-reasoner

    test.beforeEach(async ({ page }) => {
      const stagingToken = process.env.E2E_STAGING_TOKEN;
      if (!stagingToken) {
        test.skip(true, 'Falta la variable E2E_STAGING_TOKEN');
        return;
      }
      await page.addInitScript((token) => {
        localStorage.setItem('vibe-onboarding-done', 'true');
        document.cookie = `opita_session=${token}; path=/;`;
      }, stagingToken);

      await page.goto('/app/');
      await waitForWorkspace(page);
      await ensureChatOpen(page);

      // Seleccionar el modelo en la UI
      const modelSelectorBtn = page.locator('[aria-label="Seleccionar modelo de IA"]');
      if (await modelSelectorBtn.isVisible()) {
        await modelSelectorBtn.click();
        const option = page.locator(`button:has-text("${model.name}")`);
        if (await option.isVisible()) {
          await option.click();
        } else {
          // Si no lo encuentra por nombre exacto, cerrar dropdown
          await page.mouse.click(0, 0);
        }
      }
    });

    test('Level 1 (Basic): Crear un componente UI aislado', async ({ page }) => {
      const textarea = page.locator('textarea[placeholder*="Escribe"]');
      await expect(textarea).toBeVisible();

      const promptText = `Crea un archivo src/components/CounterE2E_${model.id.replace('-', '_')}.tsx que sea un componente funcional de React. Debe tener un estado de contador que inicie en 0 y un botón para incrementarlo. Solo crea ese archivo.`;
      await textarea.fill(promptText);
      await page.keyboard.press('Enter');
      
      await expect(page.locator(`text=src/components/CounterE2E_${model.id.replace('-', '_')}.tsx`)).toBeVisible({ timeout: 90000 });
      
      const explorerBtn = page.locator('[aria-label="Explorador de Archivos"]');
      await explorerBtn.click();
      await expect(page.locator(`.monaco-list-row:has-text("CounterE2E_${model.id.replace('-', '_')}.tsx")`)).toBeVisible({ timeout: 10000 });
    });

    test('Level 2 (Medium): Crear lógica multi-archivo', async ({ page }) => {
      const textarea = page.locator('textarea[placeholder*="Escribe"]');
      await expect(textarea).toBeVisible();

      const suffix = model.id.replace('-', '_');
      const promptText = `Crea dos archivos: 1. src/utils/mathE2E_${suffix}.ts con una función sumar. 2. src/components/CalculatorE2E_${suffix}.tsx que importe y use esa función sumar. Solo devuelve el código de estos dos archivos.`;
      await textarea.fill(promptText);
      await page.keyboard.press('Enter');

      await expect(page.locator(`text=src/utils/mathE2E_${suffix}.ts`)).toBeVisible({ timeout: 120000 });
      await expect(page.locator(`text=src/components/CalculatorE2E_${suffix}.tsx`)).toBeVisible({ timeout: 120000 });
    });
  });
});
