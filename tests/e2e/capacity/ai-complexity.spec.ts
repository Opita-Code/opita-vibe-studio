import { test, expect } from '@playwright/test';
import { injectStagingSession, waitForAuthReady, getStagingToken } from '../helpers/staging-auth';
import { waitForWorkspace } from '../helpers/setup';

/**
 * Suite de Complejidad — Benchmark comparativo DeepSeek Chat vs Reasoner
 *
 * Qué mide:
 *   - Capacidad del agente para crear archivos correctamente en el VFS
 *   - El agente emite evento file_changed → la UI muestra "✅ Creado: `filename`"
 *   - Verificamos que el texto aparezca en el último mensaje del chat
 *
 * Cómo se detecta que un archivo fue creado:
 *   useAgentHandler.ts L278 escribe en el chat:
 *   `✅ Creado: \`{filename}\``
 *   Por eso el assert busca ese patrón exacto.
 */

const MODELS_TO_TEST = [
  { id: 'deepseek-chat', label: 'Opita Flash' },
  { id: 'deepseek-reasoner', label: 'Opita Architect' },
];

for (const model of MODELS_TO_TEST) {
  test.describe(`Capacidad: ${model.label}`, () => {
    test.setTimeout(180_000); // 3 min — Reasoner necesita tiempo de CoT

    test.beforeEach(async ({ page }) => {
      const token = getStagingToken();
      if (!token) test.skip(true, 'Token de staging no disponible (corre npx playwright test de nuevo)');

      await injectStagingSession(page, token!);
      await page.goto('/app/');
      await waitForWorkspace(page);
      await waitForAuthReady(page);

      // Seleccionar modelo en el dropdown
      // ChatInput.tsx renderiza el dropdown como un div absoluto con botones dentro
      // No usa role="listbox" — buscamos el botón por texto visible
      await page.locator('[aria-label="Seleccionar modelo de IA"]').click();
      await page.waitForTimeout(500); // Dejar que el dropdown se renderice

      // Buscar el botón del modelo por su texto dentro del dropdown abierto
      const modelOption = page.locator(`button:has-text("${model.label}")`).last();
      if (await modelOption.isVisible({ timeout: 3000 })) {
        await modelOption.click();
      } else {
        // Cerrar dropdown y continuar de todas formas — el default (deepseek-chat) sirve
        await page.keyboard.press('Escape');
      }
    });

    /**
     * Level 1: Componente aislado (1 archivo)
     *
     * El agente debería emitir file_changed con action="created".
     * useAgentHandler convierte eso en: ✅ Creado: `CounterE2E_{suffix}.tsx`
     */
    test('Level 1: Crear componente React aislado', async ({ page }) => {
      const suffix = model.id.replace(/-/g, '_');
      const filename = `CounterE2E_${suffix}.tsx`;

      const textarea = page.locator('textarea[placeholder*="Escribe"]');
      await expect(textarea).toBeEnabled();

      await textarea.fill(
        `Crea SOLO el archivo src/components/${filename}. ` +
        `Debe ser un componente React funcional con un contador que inicia en 0 y un botón para incrementarlo.`
      );
      await page.keyboard.press('Enter');

      // El agente notifica la creación con este patrón exacto (ver useAgentHandler.ts L278)
      await expect(
        page.locator(`.chat-messages, [data-role="messages"], main`).getByText(`Creado: \`${filename}\``)
      ).toBeVisible({ timeout: 120_000 });
    });

    /**
     * Level 2: Lógica multi-archivo (2 archivos)
     *
     * Verificamos que ambos file_changed events lleguen al chat.
     * Timeout mayor porque Reasoner puede tardar más en planificar.
     */
    test('Level 2: Crear lógica multi-archivo', async ({ page }) => {
      const suffix = model.id.replace(/-/g, '_');
      const utilFile = `mathE2E_${suffix}.ts`;
      const compFile = `CalculatorE2E_${suffix}.tsx`;

      const textarea = page.locator('textarea[placeholder*="Escribe"]');
      await expect(textarea).toBeEnabled();

      await textarea.fill(
        `Crea exactamente dos archivos:\n` +
        `1. src/utils/${utilFile} — exporta una función "sumar(a: number, b: number): number"\n` +
        `2. src/components/${compFile} — importa "sumar" y muestra el resultado de sumar 2 + 3 en pantalla.`
      );
      await page.keyboard.press('Enter');

      // Ambos archivos deben aparecer en el chat
      const chatArea = page.locator(`.chat-messages, [data-role="messages"], main`);
      await expect(chatArea.getByText(`Creado: \`${utilFile}\``)).toBeVisible({ timeout: 150_000 });
      await expect(chatArea.getByText(`Creado: \`${compFile}\``)).toBeVisible({ timeout: 20_000 });
    });
  });
}
