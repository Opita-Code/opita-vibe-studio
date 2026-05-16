import { test, expect } from '@playwright/test';
import { waitForWorkspace, ensureChatOpen } from '../helpers/setup';

// Nota: Estos tests apuntan al backend REAL de staging.
// Requieren una sesión válida con plan PRO para ejecutar los agentes y usar herramientas.
test.describe('Vibe AI - Pruebas de Capacidad (Complejidad)', () => {
  
  // Usamos un timeout largo porque dependemos de la latencia real del LLM
  test.setTimeout(120000); 

  test.beforeEach(async ({ page }) => {
    // 1. Necesitamos inyectar un token válido de Staging para evitar 401 en la Lambda.
    // En un entorno de CI real, esto vendría de un secreto o un login por API.
    const stagingToken = process.env.E2E_STAGING_TOKEN;
    
    if (!stagingToken) {
      test.skip(true, 'Falta la variable de entorno E2E_STAGING_TOKEN para probar contra Staging real');
      return;
    }

    // Inyectar la sesión en la app
    await page.addInitScript((token) => {
      localStorage.setItem('vibe-onboarding-done', 'true');
      document.cookie = `opita_session=${token}; path=/;`;
    }, stagingToken);

    await page.goto('/app/');
    await waitForWorkspace(page);
    await ensureChatOpen(page);
  });

  test('Level 1 (Basic): Crear un componente UI aislado', async ({ page }) => {
    // Buscar el textarea (asumiendo que estamos logueados como Pro)
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible();

    // Enviar el prompt
    const promptText = "Crea un archivo src/components/CounterE2E.tsx que sea un componente funcional de React. Debe tener un estado de contador que inicie en 0 y un botón para incrementarlo. Solo crea ese archivo.";
    await textarea.fill(promptText);
    await page.keyboard.press('Enter');

    // Esperar a que el proceso del Agente termine.
    // El agente muestra "Revisando tu proyecto...", luego "Ejecutando herramientas", etc.
    // Finalmente debería mostrar una burbuja indicando finalización.
    // Podemos esperar a que el botón de enviar vuelva a estar habilitado o esperar a un texto específico.
    
    // Verificamos que se muestre el archivo modificado/creado en la UI
    await expect(page.locator('text=src/components/CounterE2E.tsx')).toBeVisible({ timeout: 60000 });
    
    // Validamos en el explorador que el archivo exista
    const explorerBtn = page.locator('[aria-label="Explorador de Archivos"]');
    await explorerBtn.click();
    await expect(page.locator('.monaco-list-row:has-text("CounterE2E.tsx")')).toBeVisible({ timeout: 10000 });
  });

  test('Level 2 (Medium): Crear lógica multi-archivo', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Escribe"]');
    await expect(textarea).toBeVisible();

    const promptText = "Crea dos archivos: 1. src/utils/mathE2E.ts con una función sumar. 2. src/components/CalculatorE2E.tsx que importe y use esa función sumar. Solo devuelve el código de estos dos archivos.";
    await textarea.fill(promptText);
    await page.keyboard.press('Enter');

    // Validamos que ambas modificaciones se reporten
    await expect(page.locator('text=src/utils/mathE2E.ts')).toBeVisible({ timeout: 90000 });
    await expect(page.locator('text=src/components/CalculatorE2E.tsx')).toBeVisible({ timeout: 90000 });
  });

});
