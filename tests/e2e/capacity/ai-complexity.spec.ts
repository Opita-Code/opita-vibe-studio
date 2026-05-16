import { test, expect } from '@playwright/test';
import {
  injectStagingSession,
  waitForAuthReady,
  getStagingToken,
  getChatLog,
  sendChatMessage,
} from '../helpers/staging-auth';
import { waitForWorkspace } from '../helpers/setup';

/**
 * Suite de Complejidad — Benchmark de creación de archivos por modelo
 *
 * Modelos bajo test (nombres en la UI, ver registry.ts):
 *   - "Opita Flash"     → deepseek-chat   (rápido, menos razonamiento)
 *   - "Opita Architect" → deepseek-reasoner (CoT extendido, más lento)
 *
 * Qué mide:
 *   Level 1: Crear un solo archivo React → el agente emite file_changed
 *            → useAgentHandler.ts L278 escribe: "✅ Creado: `filename`"
 *   Level 2: Crear 2 archivos con dependencia entre ellos.
 *
 * Cómo detectamos éxito:
 *   El chat log (role="log") contiene el texto "Creado:" seguido del nombre
 *   del archivo. Alternativamente, el resumen "Archivos modificados:" al final
 *   (useAgentHandler.ts L321-323) también confirma la creación.
 */

const MODELS_TO_TEST = [
  { id: 'deepseek-chat', uiName: 'Opita Flash' },
  { id: 'deepseek-reasoner', uiName: 'Opita Architect' },
];

for (const model of MODELS_TO_TEST) {
  test.describe(`Capacidad: ${model.uiName}`, () => {
    test.setTimeout(180_000); // 3 min — Reasoner necesita tiempo de CoT

    test.beforeEach(async ({ page }) => {
      const token = getStagingToken();
      if (!token) {
        test.skip(true, 'Token de staging no disponible');
        return;
      }

      await injectStagingSession(page, token);
      await page.goto('/app/');
      await waitForWorkspace(page);
      await waitForAuthReady(page);

      // ── Seleccionar modelo ──────────────────────────────────
      const modelBtn = page.locator('[aria-label="Seleccionar modelo de IA"]');
      await modelBtn.click();

      // El dropdown es un div absoluto con botones por modelo.
      // Cada botón contiene el texto del nombre del modelo.
      const modelOption = page.locator(
        `button:has-text("${model.uiName}")`
      );

      // Esperar a que el dropdown se anime y el botón sea visible
      const isAvailable = await modelOption.first().isVisible({ timeout: 3_000 }).catch(() => false);

      if (!isAvailable) {
        await page.keyboard.press('Escape');
        test.skip(true, `Modelo "${model.uiName}" no disponible en el dropdown`);
        return;
      }

      await modelOption.first().click();
      // Verificar que el botón ahora muestra el modelo seleccionado
      await expect(modelBtn).toContainText(model.uiName, { timeout: 2_000 });
    });

    test('Level 1: Crear componente React aislado', async ({ page }) => {
      const suffix = model.id.replace(/-/g, '_');
      const filename = `CounterE2E_${suffix}.tsx`;

      const textarea = await sendChatMessage(
        page,
        `Crea SOLO el archivo src/components/${filename}. ` +
        `Debe ser un componente React funcional con un contador que inicia en 0 ` +
        `y un botón para incrementarlo.`
      );

      // Esperar a que el agente termine
      await expect(textarea).toBeEnabled({ timeout: 150_000 });

      // Verificar éxito: el chat log debe contener referencia al archivo
      const chatLog = getChatLog(page);
      const chatText = await chatLog.textContent({ timeout: 5_000 }) ?? '';

      // useAgentHandler L278: "✅ Creado: `filename`"
      // O L321: "- `filename` (created)" en el resumen final
      const fileReferenced = chatText.includes(filename) ||
        chatText.includes(`Creado`) ||
        chatText.includes('Archivos modificados');

      expect(fileReferenced, `El chat debería mencionar "${filename}" o confirmar creación`).toBe(true);
    });

    test('Level 2: Crear lógica multi-archivo', async ({ page }) => {
      const suffix = model.id.replace(/-/g, '_');
      const utilFile = `mathE2E_${suffix}.ts`;
      const compFile = `CalculatorE2E_${suffix}.tsx`;

      const textarea = await sendChatMessage(
        page,
        `Crea exactamente dos archivos:\n` +
        `1. src/utils/${utilFile} — exporta una función "sumar(a: number, b: number): number"\n` +
        `2. src/components/${compFile} — importa "sumar" y muestra el resultado de sumar(2, 3) en pantalla.`
      );

      // Esperar a que el agente termine
      await expect(textarea).toBeEnabled({ timeout: 150_000 });

      // Verificar que ambos archivos aparezcan en el chat
      const chatLog = getChatLog(page);
      const chatText = await chatLog.textContent({ timeout: 5_000 }) ?? '';

      expect(chatText, `Chat debería mencionar ${utilFile}`).toContain(utilFile);
      expect(chatText, `Chat debería mencionar ${compFile}`).toContain(compFile);
    });
  });
}
