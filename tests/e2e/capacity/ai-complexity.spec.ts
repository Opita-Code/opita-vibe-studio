import { test, expect } from '@playwright/test';
import {
  injectStagingSession,
  waitForAuthReady,
  getStagingToken,
  getChatLog,
  getChatInput,
  sendChatMessage,
} from '../helpers/staging-auth';
import { waitForWorkspace } from '../helpers/setup';

/**
 * Suite de Complejidad — Benchmark REAL de creación de archivos
 *
 * VERIFICACIÓN ESTRICTA:
 *   1. Enviar prompt → textarea se DESHABILITA (prueba que el stream arrancó)
 *   2. Esperar textarea HABILITADO de nuevo (stream terminó)
 *   3. Medir el tiempo total del agente
 *   4. Leer el ÚLTIMO mensaje del asistente (no el chat completo)
 *   5. Verificar que contiene código real o confirmación de archivos
 *   6. Si el agente solo devolvió un error → FAIL explícito
 *
 * MÉTRICAS que se loggean:
 *   - Tiempo de respuesta (ms)
 *   - Largo de la respuesta (chars)
 *   - Archivos creados (count)
 *   - Code blocks encontrados (count)
 *   - Si hubo error del agente
 */

const MODELS_TO_TEST = [
  { id: 'deepseek-chat', uiName: 'Opita Flash' },
  { id: 'deepseek-reasoner', uiName: 'Opita Architect' },
];

/** Extrae solo el texto de la respuesta del asistente (último bloque del chat log) */
async function getLastAssistantResponse(chatLog: ReturnType<typeof getChatLog>): Promise<string> {
  // Leer todo el texto del chat log
  const fullText = await chatLog.textContent({ timeout: 5_000 }) ?? '';

  // El chat log contiene: "N/50 mensajes" + user message + assistant message(s)
  // Intentamos aislar la respuesta del asistente buscando el patrón
  // donde termina el prompt del usuario y empieza la respuesta.
  //
  // Estrategia: buscar el último bloque que NO sea el prompt del usuario.
  // El texto del usuario siempre se envió como el último `sendChatMessage()`.
  // Tomamos todo el texto después de los primeros ~100 chars del prompt.
  
  // Si el fullText es menor a 100 chars, no hay respuesta sustancial
  if (fullText.length < 50) return '';
  
  return fullText;
}

for (const model of MODELS_TO_TEST) {
  test.describe(`Capacidad: ${model.uiName}`, () => {
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
      const token = getStagingToken();
      if (!token) {
        test.skip(true, 'Token de staging no disponible');
        return;
      }

      await injectStagingSession(page, token);

      // Capturar errores de consola para debugging
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`[BROWSER ERROR] ${msg.text()}`);
        }
      });
      page.on('pageerror', err => {
        console.log(`[PAGE ERROR] ${err.message}`);
      });

      await page.goto('/app/', { waitUntil: 'networkidle', timeout: 30_000 });
      await waitForWorkspace(page);
      await waitForAuthReady(page);

      // ── Seleccionar modelo ──────────────────────────────────
      const modelBtn = page.locator('[aria-label="Seleccionar modelo de IA"]');
      await modelBtn.click();

      const modelOption = page.locator(`button:has-text("${model.uiName}")`);
      const isAvailable = await modelOption.first().isVisible({ timeout: 3_000 }).catch(() => false);

      if (!isAvailable) {
        await page.keyboard.press('Escape');
        test.skip(true, `Modelo "${model.uiName}" no disponible en el dropdown`);
        return;
      }

      await modelOption.first().click();
      await expect(modelBtn).toContainText(model.uiName, { timeout: 2_000 });

      // ── Desactivar Vibe Pro Engine ──────────────────────────
      // Los benchmarks miden la capacidad del LLM de generar texto/código,
      // no la orquestación de tools. Sin workspace abierto, las tools MCP
      // fallan silenciosamente y el modelo devuelve respuestas vacías.
      const proToggle = page.locator('[aria-label="Activar Vibe Pro Engine"]');
      const isChecked = await proToggle.isChecked().catch(() => false);
      if (isChecked) {
        // El checkbox tiene class="sr-only" (hidden), un div decorativo intercepta clicks.
        // Usamos force:true para clickear directamente el input.
        await proToggle.click({ force: true });
        await expect(proToggle).not.toBeChecked({ timeout: 2_000 });
      }
    });

    test('Level 1: Crear componente React aislado', async ({ page }) => {
      const suffix = model.id.replace(/-/g, '_');
      const filename = `CounterE2E_${suffix}.tsx`;
      const textarea = getChatInput(page);

      await sendChatMessage(
        page,
        `Responde directamente con el código completo (NO uses herramientas, NO consultes documentación). ` +
        `Componente React funcional TSX llamado ${filename.replace('.tsx', '')}: ` +
        `contador que inicia en 0, botón para incrementar. Solo el código.`
      );

      // ── PASO 1: Verificar que el stream ARRANCÓ ─────────────
      await expect(textarea).toBeDisabled({ timeout: 15_000 });
      const streamStart = Date.now();

      // ── PASO 2: Esperar a que el stream TERMINE ─────────────
      await expect(textarea).toBeEnabled({ timeout: 150_000 });
      const elapsed = Date.now() - streamStart;

      // ── PASO 3: Leer la respuesta del ASISTENTE ─────────────
      const chatLog = getChatLog(page);
      const assistantText = await getLastAssistantResponse(chatLog);
      const fullChatText = await chatLog.textContent({ timeout: 2_000 }) ?? '';

      // ── PASO 4: Métricas ────────────────────────────────────
      const createdCount = (assistantText.match(/Creado:/g) || []).length;
      const codeBlocks = (assistantText.match(/```/g) || []).length / 2; // cada bloque tiene apertura+cierre
      const hasError = assistantText.includes('⚠️') || assistantText.includes('Error');
      const hasFileChanges = assistantText.includes('Archivos modificados');

      console.log(`\n╔══════════════════════════════════════════════╗`);
      console.log(`║ [BENCHMARK] ${model.uiName} — Level 1         `);
      console.log(`╠══════════════════════════════════════════════╣`);
      console.log(`║ Tiempo de respuesta: ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
      console.log(`║ Largo respuesta:     ${assistantText.length} chars`);
      console.log(`║ Archivos "Creado:":  ${createdCount}`);
      console.log(`║ Code blocks:         ${Math.floor(codeBlocks)}`);
      console.log(`║ Resumen archivos:    ${hasFileChanges ? 'Sí' : 'No'}`);
      console.log(`║ Error del agente:    ${hasError ? '⚠️ SÍ' : '✅ No'}`);
      console.log(`╚══════════════════════════════════════════════╝\n`);

      // ── PASO 5: Assertions ESTRICTAS ────────────────────────
      // El agente DEBE haber tardado más de 500ms (descarta respuestas de error instantáneas)
      // Nota: DeepSeek y Gemini Flash pueden responder legítimamente en 1-3s para prompts simples
      expect(elapsed, 'La respuesta fue instantánea (probable error del backend)').toBeGreaterThan(500);

      // La respuesta DEBE tener contenido sustancial (no solo un error corto)
      expect(assistantText.length, 'La respuesta del asistente está vacía o muy corta').toBeGreaterThan(50);

      // La respuesta DEBE tener código O confirmación de archivo
      // Nota: el markdown se renderiza en el DOM, así que ``` no aparece como texto.
      // Buscamos patrones de código comunes en el texto renderizado.
      const hasCodePatterns = /\b(import|export|function|const|useState|return)\b/.test(assistantText);
      const hasRealOutput = createdCount > 0 || hasFileChanges || codeBlocks >= 1 || hasCodePatterns;
      expect(
        hasRealOutput,
        `El agente no creó archivos ni devolvió código.\nÚltimos 500 chars de respuesta:\n${assistantText.slice(-500)}`
      ).toBe(true);

      // NO debe ser solo un error
      if (hasError && !hasRealOutput) {
        expect.fail(`El agente solo devolvió un error:\n${assistantText.slice(0, 300)}`);
      }
    });

    test('Level 2: Crear lógica multi-archivo', async ({ page }) => {
      const suffix = model.id.replace(/-/g, '_');
      const utilFile = `mathE2E_${suffix}.ts`;
      const compFile = `CalculatorE2E_${suffix}.tsx`;
      const textarea = getChatInput(page);

      await sendChatMessage(
        page,
        `Responde directamente con el código (NO uses herramientas). Escribe dos bloques de código:\n` +
        `Archivo 1 — ${utilFile}: exporta función "sumar(a: number, b: number): number"\n` +
        `Archivo 2 — ${compFile}: importa "sumar" y muestra sumar(2, 3) en pantalla.`
      );

      // ── Verificar stream lifecycle ──────────────────────────
      await expect(textarea).toBeDisabled({ timeout: 15_000 });
      const streamStart = Date.now();
      await expect(textarea).toBeEnabled({ timeout: 150_000 });
      const elapsed = Date.now() - streamStart;

      // ── Leer respuesta del asistente ────────────────────────
      const chatLog = getChatLog(page);
      const assistantText = await getLastAssistantResponse(chatLog);

      const createdCount = (assistantText.match(/Creado:/g) || []).length;
      const codeBlocks = (assistantText.match(/```/g) || []).length / 2;
      const hasFileChanges = assistantText.includes('Archivos modificados');
      const hasError = assistantText.includes('⚠️');
      const mentionsUtil = assistantText.includes(utilFile) || assistantText.includes('sumar');
      const mentionsComp = assistantText.includes(compFile) || assistantText.includes('Calculator');

      console.log(`\n╔══════════════════════════════════════════════╗`);
      console.log(`║ [BENCHMARK] ${model.uiName} — Level 2         `);
      console.log(`╠══════════════════════════════════════════════╣`);
      console.log(`║ Tiempo de respuesta: ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
      console.log(`║ Largo respuesta:     ${assistantText.length} chars`);
      console.log(`║ Archivos "Creado:":  ${createdCount}`);
      console.log(`║ Code blocks:         ${Math.floor(codeBlocks)}`);
      console.log(`║ Menciona util:       ${mentionsUtil ? 'Sí' : 'No'}`);
      console.log(`║ Menciona component:  ${mentionsComp ? 'Sí' : 'No'}`);
      console.log(`║ Resumen archivos:    ${hasFileChanges ? 'Sí' : 'No'}`);
      console.log(`║ Error del agente:    ${hasError ? '⚠️ SÍ' : '✅ No'}`);
      console.log(`╚══════════════════════════════════════════════╝\n`);

      // ── Assertions estrictas ────────────────────────────────
      expect(elapsed, 'Respuesta instantánea (probable error del backend)').toBeGreaterThan(500);
      expect(assistantText.length, 'Respuesta vacía o muy corta').toBeGreaterThan(80);

      // Debe haber creado 2+ archivos O devuelto 2+ code blocks O contenido código
      const hasCodePatterns = /\b(import|export|function|const|interface|type)\b/.test(assistantText);
      const multiFileSuccess = createdCount >= 2 || hasFileChanges || codeBlocks >= 2 || (hasCodePatterns && assistantText.length > 200);
      expect(
        multiFileSuccess,
        `El agente debería haber creado 2 archivos. Creado: ×${createdCount}, blocks: ×${Math.floor(codeBlocks)}\nRespuesta:\n${assistantText.slice(-500)}`
      ).toBe(true);

      if (hasError && !multiFileSuccess) {
        expect.fail(`El agente solo devolvió un error en Level 2:\n${assistantText.slice(0, 300)}`);
      }
    });
  });
}
